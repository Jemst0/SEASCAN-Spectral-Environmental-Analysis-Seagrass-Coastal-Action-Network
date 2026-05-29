from __future__ import annotations

import base64
import io
import json
import os
import tempfile
import zipfile
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Tuple

import numpy as np
import scipy.io as sio
import tifffile
import torch
import torch.nn as nn
from fastapi import FastAPI, File, HTTPException, UploadFile, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from PIL import Image
from scipy import signal
import jwt

from database import (
    init_auth_db,
    save_classification,
    get_study_area,
    get_classifications_for_study_area,
    get_all_study_areas,
    get_all_classifications,
    delete_classification,
    update_classification,
    get_classification_by_id,
    create_user,
    get_user_by_username,
    update_user_last_login,
    list_users,
    set_active_user_db,
)
from geospatial import extract_geospatial_metadata, find_first_geotiff
from auth_utils import hash_password, verify_password, create_access_token, decode_access_token
from upload_utils import extract_uploaded_files

app = FastAPI(title="SEASCAN Coastal Classifier UI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_auth_db()
    ensure_default_users()

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_FOLDER = PROJECT_ROOT / "Coastal_Area_NRG"
DATA_FOLDER = Path(os.environ.get("SEASCAN_DATA_DIR", str(DEFAULT_DATA_FOLDER)))
MAT_FILE = Path(os.environ.get("SEASCAN_MODEL_MAT", str(DATA_FOLDER / "Coastal_Area_Classifier.mat")))
PTH_FILE = Path(os.environ.get("SEASCAN_MODEL_PTH", str(DATA_FOLDER / "coastal_classifier_pytorch.pth")))

BAND_LABELS = ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B09", "B11", "B12"]

JWT_SECRET = os.environ.get("SEASCAN_JWT_SECRET", "dev-secret-change-me")
JWT_EXPIRES_MIN = int(os.environ.get("SEASCAN_JWT_EXPIRES_MIN", "480"))
ADMIN_USERNAME = os.environ.get("SEASCAN_ADMIN_USER")
ADMIN_PASSWORD = os.environ.get("SEASCAN_ADMIN_PASS")
USER_USERNAME = os.environ.get("SEASCAN_USER_USER")
USER_PASSWORD = os.environ.get("SEASCAN_USER_PASS")
ROLE_ADMIN = "admin"
ROLE_USER = "user"

auth_scheme = HTTPBearer()


class Coastal1DCNN(nn.Module):
    def __init__(self, num_bands: int = 16, num_classes: int = 4):
        super().__init__()
        self.num_bands = num_bands
        self.conv1 = nn.Conv1d(1, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm1d(32)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool1d(kernel_size=2, stride=2)

        self.conv2 = nn.Conv1d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm1d(64)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.MaxPool1d(kernel_size=2, stride=2)

        self.conv3 = nn.Conv1d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm1d(128)
        self.relu3 = nn.ReLU()

        self.flatten = nn.Flatten()
        self.fc1 = nn.Linear(128 * 4, 256)
        self.relu_fc1 = nn.ReLU()
        self.dropout = nn.Dropout(0.4)
        self.fc_out = nn.Linear(256, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x.view(-1, 1, self.num_bands)
        x = self.pool1(self.relu1(self.bn1(self.conv1(x))))
        x = self.pool2(self.relu2(self.bn2(self.conv2(x))))
        x = self.relu3(self.bn3(self.conv3(x)))
        x = self.flatten(x)
        x = self.dropout(self.relu_fc1(self.fc1(x)))
        return self.fc_out(x)


def _bootstrap_user(username: Optional[str], password: Optional[str], role: str) -> None:
    if not username or not password:
        return
    existing = get_user_by_username(username)
    if existing:
        return
    password_hash = hash_password(password)
    create_user(username=username, password_hash=password_hash, role=role)


def ensure_default_users() -> None:
    """Create admin/user accounts from environment variables if missing."""
    if not list_users() and not (ADMIN_USERNAME and ADMIN_PASSWORD):
        print("Warning: No users configured. Set SEASCAN_ADMIN_USER/SEASCAN_ADMIN_PASS to bootstrap accounts.")
    _bootstrap_user(ADMIN_USERNAME, ADMIN_PASSWORD, ROLE_ADMIN)
    _bootstrap_user(USER_USERNAME, USER_PASSWORD, ROLE_USER)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)) -> dict:
    token = credentials.credentials
    try:
        payload = decode_access_token(token, JWT_SECRET)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    set_active_user_db(user["username"])

    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _find_tiffs_in_dir(path: Path) -> List[Path]:
    """Return sorted .tif/.tiff files in a directory tree."""
    return sorted([p for p in path.rglob("*") if p.is_file() and p.suffix.lower() in (".tif", ".tiff")])


def _load_model_and_norm():
    """Load model weights and normalization parameters."""
    if not MAT_FILE.exists() or not PTH_FILE.exists():
        raise FileNotFoundError(f"Model artifacts not found in {DATA_FOLDER}")

    mat = sio.loadmat(str(MAT_FILE))
    mu = np.asarray(mat["mu"], dtype=np.float32).reshape(1, -1)
    sigma = np.asarray(mat["sigma"], dtype=np.float32).reshape(1, -1)
    num_bands = int(np.squeeze(mat["numBands"]))
    num_classes = int(np.squeeze(mat["numClasses"]))

    model = Coastal1DCNN(num_bands=num_bands, num_classes=num_classes)
    state = torch.load(str(PTH_FILE), map_location="cpu")
    model.load_state_dict(state)
    model.eval()
    return model, mu, sigma, num_bands, num_classes


def _build_stack_from_files(files: List[Path]) -> Tuple[np.ndarray, Optional[Path]]:
    """Load band files into a stack and return a true-color path if present."""
    band_data = {}
    true_color_path: Optional[Path] = None

    for label in BAND_LABELS:
        matched = None
        for p in files:
            upper_name = p.name.upper()
            if label.upper() in upper_name and "TRUE" not in upper_name:
                matched = p
                break
        if matched is None:
            raise ValueError(f"Missing required band file for {label}")
        image = tifffile.imread(matched)
        if image.ndim > 2:
            image = image[..., 0]
        band_data[label] = image.astype(np.float32)

    for p in files:
        if "TRUE" in p.name.upper():
            true_color_path = p
            break

    rows, cols = next(iter(band_data.values())).shape
    stack = np.zeros((rows, cols, len(BAND_LABELS)), dtype=np.float32)
    for index, label in enumerate(BAND_LABELS):
        stack[:, :, index] = band_data[label]

    return stack, true_color_path


def _compute_features(stack: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Compute spectral indices and land/water masks from a band stack."""
    b02 = stack[:, :, 1]
    b03 = stack[:, :, 2]
    b04 = stack[:, :, 3]
    b08 = stack[:, :, 7]
    b11 = stack[:, :, 10]

    eps = 1e-8
    ndvi = (b08 - b04) / (b08 + b04 + eps)
    ndwi = (b03 - b08) / (b03 + b08 + eps)
    mndwi = (b03 - b11) / (b03 + b11 + eps)
    brightness = (b02 + b03 + b04) / 3.0

    full_stack = np.concatenate(
        [stack, ndvi[..., None], ndwi[..., None], mndwi[..., None], brightness[..., None]],
        axis=2,
    )

    water_mask = (ndwi > 0.02) | (mndwi > 0.02)
    land_mask = ~water_mask
    return full_stack, ndwi, mndwi, water_mask, land_mask


def _make_rgb(stack: np.ndarray, true_color_path: Optional[Path]) -> np.ndarray:
    """Generate an RGB preview from a true-color file or band stack."""
    if true_color_path is not None:
        rgb = tifffile.imread(true_color_path)
        if rgb.ndim > 3:
            rgb = rgb[..., 0]
        if rgb.dtype != np.uint8:
            rgb = np.asarray(rgb, dtype=np.float32)
            rgb = rgb - np.nanmin(rgb)
            max_val = np.nanmax(rgb)
            if max_val > 0:
                rgb = (rgb / max_val * 255).astype(np.uint8)
            else:
                rgb = np.zeros((*rgb.shape[:2], 3), dtype=np.uint8)
        return rgb

    b04 = stack[:, :, 3]
    b03 = stack[:, :, 2]
    b02 = stack[:, :, 1]
    rgb = np.stack([b04, b03, b02], axis=2).astype(np.float32)
    rgb = rgb - np.nanmin(rgb)
    max_val = np.nanmax(rgb)
    if max_val > 0:
        rgb = (rgb / max_val * 255).astype(np.uint8)
    else:
        rgb = np.zeros((*rgb.shape[:2], 3), dtype=np.uint8)
    return rgb


def classify_folder(data_folder: str | Path) -> dict:
    """Classify a folder containing Sentinel-2 band TIFFs."""
    data_folder = Path(data_folder)
    if not data_folder.is_dir():
        raise FileNotFoundError(f"Data folder does not exist: {data_folder}")

    tiff_files = _find_tiffs_in_dir(data_folder)
    if not tiff_files:
        raise FileNotFoundError(f"No TIFF files found in {data_folder}")

    model, mu, sigma, num_bands, num_classes = _load_model_and_norm()
    stack_12, true_color_path = _build_stack_from_files(tiff_files)
    full_stack, ndwi, mndwi, water_mask, land_mask = _compute_features(stack_12)

    rows, cols, feature_count = full_stack.shape
    features = full_stack.reshape(rows * cols, feature_count)
    features_z = (features - mu) / (sigma + 1e-8)

    preds = np.zeros((features.shape[0],), dtype=np.uint8)
    max_confidences = np.zeros((features.shape[0],), dtype=np.float32)
    batch_size = 16384
    with torch.no_grad():
        for offset in range(0, features_z.shape[0], batch_size):
            batch = features_z[offset : offset + batch_size]
            batch_tensor = torch.from_numpy(batch.astype(np.float32))
            logits = model(batch_tensor)
            probs = torch.softmax(logits, dim=1)
            maxp, batch_preds = torch.max(probs.data, 1)
            preds[offset : offset + len(batch_preds)] = (batch_preds.cpu().numpy() + 1).astype(np.uint8)
            max_confidences[offset : offset + len(batch_preds)] = maxp.cpu().numpy()

    classified = preds.reshape(rows, cols)

    # Keep the same cleanup logic as the MATLAB/Notebook flow.
    classified_clean = classified.copy()
    unlabeled_mask = np.ones_like(classified_clean, dtype=bool)

    inland_mask = (ndwi < -0.05) & (~water_mask) & unlabeled_mask
    classified_clean[inland_mask & (classified_clean == 2)] = 0

    water_strong_mask = water_mask & (ndwi > 0) & unlabeled_mask
    classified_clean[water_strong_mask & (classified_clean == 2)] = 3

    kernel = np.ones((11, 11))
    coastal_buffer_mask = signal.convolve2d(water_mask.astype(float), kernel, mode="same") > 0
    inland_far_mask = ~coastal_buffer_mask & unlabeled_mask
    classified_clean[inland_far_mask & ((classified_clean == 2) | (classified_clean == 3))] = 0

    classified = classified_clean

    rgb = _make_rgb(stack_12, true_color_path)
    if rgb.ndim == 2:
        rgb = np.stack([rgb, rgb, rgb], axis=2)

    overlay = np.zeros_like(rgb, dtype=np.uint8)
    overlay[(classified == 1) & water_mask] = [0, 255, 0]
    overlay[(classified == 2) & water_mask] = [255, 255, 0]
    overlay[(classified == 3) & water_mask] = [0, 115, 255]
    overlay[(classified == 4) & water_mask] = [255, 255, 255]

    alpha = 0.5
    blend = rgb.astype(np.float32).copy()
    overlay_mask = water_mask & np.any(overlay > 0, axis=2)
    if np.any(overlay_mask):
        base_px = blend[overlay_mask]
        overlay_px = overlay[overlay_mask].astype(np.float32)
        blend[overlay_mask] = (1 - alpha) * base_px + alpha * overlay_px
    blend = np.clip(blend, 0, 255).astype(np.uint8)

    img = Image.fromarray(blend)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode("ascii")

    coastal_mask = ~land_mask
    total_coastal_pixels = int(np.sum(coastal_mask))
    seagrass_count = int(np.sum((classified == 1) & coastal_mask))
    sand_count = int(np.sum((classified == 2) & coastal_mask))
    water_count = int(np.sum((classified == 3) & coastal_mask))
    cloud_count = int(np.sum(classified == 4))

    stats = {
        "totalCoastalPixels": total_coastal_pixels,
        "seagrassPixels": seagrass_count,
        "sandPixels": sand_count,
        "waterPixels": water_count,
        "cloudPixels": cloud_count,
        "imageSize": [int(rows), int(cols)],
        "numBands": int(num_bands),
        "numClasses": int(num_classes),
    }

    # compute average model confidence (percent) over coastal pixels if per-pixel confidences were computed
    try:
        if max_confidences is not None and max_confidences.size == features.shape[0]:
            conf_array = max_confidences.reshape(rows, cols)
            # average only across coastal mask (where coastal_mask True)
            if coastal_mask is not None:
                mask = coastal_mask
            else:
                mask = np.ones_like(conf_array, dtype=bool)
            if np.any(mask):
                avg_conf = float(np.nanmean(conf_array[mask])) * 100.0
                stats["avgConfidencePercent"] = round(avg_conf, 2)
    except Exception:
        pass

    # Try to extract pixel area (m^2) from GeoTIFF metadata if available
    try:
        first_tiff = tiff_files[0]
        meta = extract_geospatial_metadata(str(first_tiff))
        if meta and meta.get("pixel_area_sqm"):
            stats["pixelAreaSqM"] = float(meta.get("pixel_area_sqm"))
    except Exception:
        pass

    return {
        "image_base64": image_base64,
        "stats": stats,
    }


@app.post("/predict")
async def predict(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    _: dict = Depends(get_current_user),
):
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        if file is not None:
            content = await file.read()
            saved_files = extract_uploaded_files([(file.filename or "upload", content)], tmp_dir)
        elif files:
            uploads = [(upload.filename or "band.tiff", await upload.read()) for upload in files]
            saved_files = extract_uploaded_files(uploads, tmp_dir)
        else:
            raise HTTPException(status_code=400, detail="No files uploaded")

        if not saved_files:
            raise HTTPException(status_code=400, detail="No TIFF files found in uploaded content")

        return classify_folder(tmp_dir)
    finally:
        try:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


@app.post("/metadata")
async def extract_metadata(file: Optional[UploadFile] = File(None), _: dict = Depends(get_current_user)):
    """Extract geospatial metadata from uploaded TIFF file."""
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        filename = file.filename or "band.tiff"
        content = await file.read()
        
        if filename.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                archive.extractall(tmp_dir)
            tiff_path = find_first_geotiff(str(tmp_dir))
            if not tiff_path:
                return {
                    "metadata": None,
                    "message": "No TIFF files found in ZIP - using default metadata",
                    "filename": filename,
                }
        elif filename.lower().endswith((".tif", ".tiff")):
            target = tmp_dir / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            tiff_path = str(target)
        else:
            raise HTTPException(status_code=400, detail="Upload a .zip or .tif/.tiff file")
        
        # Try to extract metadata, but don't fail if it's not a proper GeoTIFF
        metadata = None
        try:
            metadata = extract_geospatial_metadata(tiff_path)
        except Exception as extract_err:
            # If metadata extraction fails, just return None - the file might not have geospatial data
            print(f"Warning: Could not extract geospatial metadata: {extract_err}")
        
        return {
            "metadata": metadata,
            "filename": filename,
            "message": "Metadata extracted successfully" if metadata else "File does not have geospatial metadata - you can still classify"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        # Even on general errors, return a success with no metadata
        print(f"Metadata extraction error: {e}")
        return {
            "metadata": None,
            "message": f"Skipping metadata extraction: {str(e)}",
            "filename": file.filename or "unknown"
        }


class SaveClassificationRequest(BaseModel):
    study_area_name: str
    study_area_location: Optional[str] = None
    study_area_bounds: Optional[dict] = None
    crs: Optional[str] = None
    uploaded_filename: str = "unknown"
    status: Optional[str] = None
    detection_type: Optional[str] = None
    affected_area_size: Optional[float] = None
    affected_area_unit: Optional[str] = None
    confidence_score: Optional[float] = None
    avg_confidence_percent: Optional[float] = None
    source: Optional[str] = None
    classification_date: Optional[str] = None
    water_pixels: int = 0
    seagrass_pixels: int = 0
    sand_pixels: int = 0
    cloud_pixels: int = 0
    total_pixels: int = 0
    pixel_area_sqm: Optional[float] = None
    classified_image_base64: str = ""
    notes: str = ""


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str


class UpdateClassificationRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


@app.post("/auth/login")
async def login(payload: LoginRequest):
    """Authenticate a user and return an access token."""
    user = get_user_by_username(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(
        username=user["username"],
        role=user["role"],
        secret=JWT_SECRET,
        expires_minutes=JWT_EXPIRES_MIN,
    )
    update_user_last_login(user["id"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"username": user["username"], "role": user["role"]},
    }


@app.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Return the current authenticated user."""
    return {"user": {"username": user["username"], "role": user["role"]}}


@app.post("/auth/users")
async def create_user_endpoint(payload: UserCreateRequest, _: dict = Depends(require_admin)):
    """Create a new user account (admin only)."""
    role = payload.role.strip().lower()
    if role not in (ROLE_ADMIN, ROLE_USER):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")

    existing = get_user_by_username(payload.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    user_id = create_user(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=role,
    )
    return {"id": user_id, "username": payload.username, "role": role}


@app.get("/auth/users")
async def list_users_endpoint(_: dict = Depends(require_admin)):
    """List user accounts (admin only)."""
    return {"users": list_users()}


@app.post("/save-classification")
async def save_classification_endpoint(
    request: SaveClassificationRequest,
    _: dict = Depends(get_current_user),
):
    """Save a classification result to the database."""
    try:
        if not request.study_area_name.strip():
            raise ValueError("Study area name is required")
        
        classification_id = save_classification(
            study_area_name=request.study_area_name,
            study_area_location=request.study_area_location or "Not specified",
            study_area_bounds=request.study_area_bounds,
            crs=request.crs,
            uploaded_filename=request.uploaded_filename,
            status=request.status,
            detection_type=request.detection_type,
            affected_area_size=request.affected_area_size,
            affected_area_unit=request.affected_area_unit,
            confidence_score=request.confidence_score,
            avg_confidence_percent=request.avg_confidence_percent,
            source=request.source,
            classification_date=request.classification_date,
            water_pixels=request.water_pixels,
            seagrass_pixels=request.seagrass_pixels,
            sand_pixels=request.sand_pixels,
            cloud_pixels=request.cloud_pixels,
            total_pixels=request.total_pixels,
            pixel_area_sqm=request.pixel_area_sqm,
            classified_image_base64=request.classified_image_base64,
            notes=request.notes,
        )
        
        return {
            "status": "saved",
            "classification_id": classification_id,
            "study_area_name": request.study_area_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save classification: {str(e)}")


@app.get("/study-areas")
async def list_study_areas(_: dict = Depends(get_current_user)):
    """Get all study areas and their statistics."""
    try:
        areas = get_all_study_areas()
        return {"study_areas": areas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve study areas: {str(e)}")


@app.get("/study-areas/{study_area_name}")
async def get_study_area_info(study_area_name: str, _: dict = Depends(get_current_user)):
    """Get info for a specific study area."""
    try:
        area = get_study_area(study_area_name)
        if not area:
            raise HTTPException(status_code=404, detail=f"Study area '{study_area_name}' not found")
        
        classifications = get_classifications_for_study_area(study_area_name)
        
        return {
            "study_area": area,
            "classifications": classifications,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve study area: {str(e)}")


@app.get("/classifications")
async def list_classifications(_: dict = Depends(get_current_user)):
    """Get all classifications across study areas."""
    try:
        classifications = get_all_classifications()
        return {"classifications": classifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve classifications: {str(e)}")


@app.delete("/classification/{classification_id}")
async def delete_classification_endpoint(
    classification_id: int,
    _: dict = Depends(require_admin),
):
    """Delete a classification record."""
    try:
        success = delete_classification(classification_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Classification {classification_id} not found")
        
        return {"status": "deleted", "classification_id": classification_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete classification: {str(e)}")


@app.patch("/classification/{classification_id}")
async def update_classification_endpoint(
    classification_id: int,
    request: UpdateClassificationRequest,
    _: dict = Depends(require_admin),
):
    """Update classification status or notes."""
    try:
        success = update_classification(classification_id, status=request.status, notes=request.notes)
        if not success:
            raise HTTPException(status_code=404, detail=f"Classification {classification_id} not found or nothing to update")

        return {"status": "updated", "classification_id": classification_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update classification: {str(e)}")


@app.post("/export-analytics-pdf")
async def export_analytics_pdf(payload: dict, _: dict = Depends(get_current_user)):
    """Generate a PDF report for selected classifications or a study area.

    Payload options:
    - ids: list of classification IDs
    - study_area: string name of study area to include all classifications
    - metric: one of 'water', 'seagrass', 'sand', 'cloud', 'total' (defaults to 'water')
    """
    try:
        ids = payload.get("ids")
        study_area = payload.get("study_area")
        metric = payload.get("metric", "water")

        records = []
        if ids:
            for cid in ids:
                rec = get_classification_by_id(int(cid))
                if rec:
                    records.append(rec)
        elif study_area:
            records = get_classifications_for_study_area(study_area)
        else:
            raise HTTPException(status_code=400, detail="Provide 'ids' or 'study_area' in payload")

        def parse_record_date(value):
            if isinstance(value, datetime):
                return value
            if isinstance(value, str):
                try:
                    normalized = value.replace("Z", "+00:00")
                    return datetime.fromisoformat(normalized)
                except Exception:
                    return None
            return None

        def get_record_date(rec):
            return rec.get("classification_date") or rec.get("created_at") or rec.get("timestamp")

        # Build trend series (oldest -> newest)
        records = sorted(records, key=lambda r: parse_record_date(get_record_date(r)) or datetime.max)
        dates = [get_record_date(r) for r in records]
        # normalize to readable labels
        labels = [d.split("T")[0] if isinstance(d, str) else str(d) for d in dates]
        key_map = {
            "water": "water_pixels",
            "seagrass": "seagrass_pixels",
            "sand": "sand_pixels",
            "cloud": "cloud_pixels",
            "total": "total_pixels",
        }
        data_key = key_map.get(metric, "water_pixels")
        values = [int(r.get(data_key) or 0) for r in records]

        # lazy imports for plotting/pdf
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.utils import ImageReader
        from reportlab.pdfbase import pdfmetrics
        from reportlab.lib import colors

        # create chart image
        fig, ax = plt.subplots(figsize=(8, 3))
        ax.plot(labels, values, marker="o", linestyle="-", color="#4A9EFF")
        ax.set_title(f"Trend: {metric.capitalize()} Pixels")
        ax.set_xlabel("Date")
        ax.set_ylabel("Pixels")
        plt.xticks(rotation=45, ha="right")
        plt.tight_layout()
        chart_buf = io.BytesIO()
        fig.savefig(chart_buf, format="png", dpi=150)
        plt.close(fig)
        chart_buf.seek(0)

        # Create PDF and embed chart and records
        pdf_buf = io.BytesIO()
        c = canvas.Canvas(pdf_buf, pagesize=letter)
        width, height = letter
        margin_x = 40
        margin_top = 50
        margin_bottom = 50
        content_width = width - (margin_x * 2)
        title = f"SEASCAN Trend Report - {study_area or 'Selection'}"
        timestamp = datetime.utcnow().replace(microsecond=0).isoformat()
        img = ImageReader(chart_buf)
        chart_height = 200
        legend_items = [
            ("Seagrass", colors.Color(0 / 255, 255 / 255, 0 / 255)),
            ("Sand", colors.Color(255 / 255, 255 / 255, 0 / 255)),
            ("Water", colors.Color(0 / 255, 115 / 255, 255 / 255)),
            ("Cloud", colors.Color(255 / 255, 255 / 255, 255 / 255)),
        ]

        def wrap_text(text: str, font_name: str, font_size: int, max_width: float):
            words = text.split()
            lines = []
            current = ""
            for word in words:
                test_line = f"{current} {word}".strip()
                if pdfmetrics.stringWidth(test_line, font_name, font_size) <= max_width:
                    current = test_line
                else:
                    if current:
                        lines.append(current)
                        current = word
                    else:
                        lines.append(word)
                        current = ""
            if current:
                lines.append(current)
            return lines

        def draw_page_header(include_chart: bool, is_continued: bool):
            header_title = f"{title} (continued)" if is_continued else title
            c.setFont("Helvetica-Bold", 16)
            c.drawString(margin_x, height - margin_top, header_title)
            c.setFont("Helvetica", 10)
            c.drawString(margin_x, height - margin_top - 16, f"Generated: {timestamp} UTC")
            y_cursor = height - margin_top - 32
            if include_chart:
                c.drawImage(img, margin_x, y_cursor - chart_height, width=content_width, height=chart_height)
                y_cursor = y_cursor - chart_height - 12
                legend_box = 9
                legend_gap = 12
                legend_text_gap = 4
                legend_y = y_cursor
                cursor_x = margin_x
                c.setFont("Helvetica", 8)
                for label, color in legend_items:
                    c.setFillColor(color)
                    c.setStrokeColor(colors.black)
                    c.rect(cursor_x, legend_y - legend_box, legend_box, legend_box, fill=1, stroke=1)
                    c.setFillColor(colors.black)
                    c.drawString(cursor_x + legend_box + legend_text_gap, legend_y - legend_box + 1, label)
                    cursor_x += legend_box + legend_text_gap + pdfmetrics.stringWidth(label, "Helvetica", 8) + legend_gap
                y_cursor = legend_y - legend_box - 12
            else:
                y_cursor -= 8
            return y_cursor

        y = draw_page_header(include_chart=True, is_continued=False)

        title_font = ("Helvetica-Bold", 9)
        body_font = ("Helvetica", 8)
        title_line_height = 12
        body_line_height = 11
        thumb_w = 120
        thumb_h = 80
        thumb_gap = 8
        record_gap = 10

        # list records
        for rec in records:
            record_title = f"#{rec.get('id')} — {rec.get('study_area_name')} — {rec.get('classification_date') or rec.get('created_at')}"
            detail_line = (
                f"Water: {rec.get('water_pixels')}, Seagrass: {rec.get('seagrass_pixels')}, "
                f"Sand: {rec.get('sand_pixels')}, Clouds: {rec.get('cloud_pixels')}, "
                f"Total: {rec.get('total_pixels')}, PixelArea(m^2): {rec.get('pixel_area_sqm') or 'N/A'}"
            )
            detail_lines = wrap_text(detail_line, body_font[0], body_font[1], content_width - 8)
            img_b64 = rec.get('classified_image_base64')
            has_thumb = bool(img_b64)
            required_height = title_line_height + (len(detail_lines) * body_line_height) + record_gap
            if has_thumb:
                required_height += thumb_h + thumb_gap

            if y - required_height < margin_bottom:
                c.showPage()
                y = draw_page_header(include_chart=False, is_continued=True)

            c.setFont(title_font[0], title_font[1])
            c.drawString(margin_x, y, record_title)
            y -= title_line_height

            c.setFont(body_font[0], body_font[1])
            for line in detail_lines:
                c.drawString(margin_x + 8, y, line)
                y -= body_line_height

            # thumbnail
            if img_b64:
                try:
                    img_data = base64.b64decode(img_b64.split(',')[-1])
                    thumb = ImageReader(io.BytesIO(img_data))
                    c.drawImage(thumb, margin_x + 8, y - thumb_h, width=thumb_w, height=thumb_h)
                    y -= thumb_h + thumb_gap
                except Exception:
                    y -= 4
            else:
                y -= 4

            y -= record_gap

        c.save()
        pdf_buf.seek(0)

        return Response(content=pdf_buf.read(), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=seascan_trend_report.pdf"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("classifier_ui:app", host="0.0.0.0", port=8000, reload=False)


