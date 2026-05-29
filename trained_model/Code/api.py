import os
import io
import base64
import zipfile
import re
import torch
import torch.nn as nn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import scipy.io as sio
import h5py
import numpy as np
import tifffile
from PIL import Image
from sklearn.preprocessing import StandardScaler

app = FastAPI(title="SEASCAN Classifier Backend")

# Allow the React frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optional: Path to the original MAT file (just showing where it loads from)
DEFAULT_DATA_FOLDER = os.path.join(os.path.dirname(__file__), "..", "Coastal_Area_NRG")
DATA_FOLDER = os.environ.get("SEASCAN_DATA_DIR", DEFAULT_DATA_FOLDER)
MODEL_PATH = os.environ.get(
    "SEASCAN_MODEL_MAT",
    os.path.join(DATA_FOLDER, "Coastal_Area_Classifier.mat"),
)
PYTORCH_MODEL_PATH = os.environ.get(
    "SEASCAN_MODEL_PTH",
    os.path.join(DATA_FOLDER, "coastal_classifier_pytorch.pth"),
)

class Coastal1DCNN(nn.Module):
    def __init__(self, num_bands=16, num_classes=4):
        super(Coastal1DCNN, self).__init__()
        self.num_bands = num_bands
        
        # Conv Block 1: [B, 1, 16] -> [B, 32, 16] -> pool -> [B, 32, 8]
        self.conv1 = nn.Conv1d(1, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm1d(32)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool1d(kernel_size=2, stride=2)
        
        # Conv Block 2: [B, 32, 8] -> [B, 64, 8] -> pool -> [B, 64, 4]
        self.conv2 = nn.Conv1d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm1d(64)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.MaxPool1d(kernel_size=2, stride=2)
        
        # Conv Block 3: [B, 64, 4] -> [B, 128, 4]
        self.conv3 = nn.Conv1d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm1d(128)
        self.relu3 = nn.ReLU()
        
        # Flatten and FC layers
        self.flatten = nn.Flatten()
        self.fc1 = nn.Linear(128 * 4, 256)
        self.relu_fc1 = nn.ReLU()
        self.dropout = nn.Dropout(0.4)
        self.fc_out = nn.Linear(256, num_classes)
    
    def forward(self, x):
        # Input: [B, 16]
        # Reshape to [B, 1, 16] for Conv1d
        x = x.view(-1, 1, self.num_bands)
        
        # Conv blocks with pooling
        x = self.pool1(self.relu1(self.bn1(self.conv1(x))))
        x = self.pool2(self.relu2(self.bn2(self.conv2(x))))
        x = self.relu3(self.bn3(self.conv3(x)))
        
        # FC layers
        x = self.flatten(x)
        x = self.dropout(self.relu_fc1(self.fc1(x)))
        x = self.fc_out(x)
        
        return x

device = torch.device('cpu')  # Use CPU for inference
model = Coastal1DCNN(num_bands=16, num_classes=4).to(device)
mu_vals = None
sigma_vals = None
scaler = None
trained_model_available = False
trained_class_names: list[str] = []

BAND_PATTERN = re.compile(r"(B(?:0[1-9]|1[12]|8A))", re.IGNORECASE)


def extract_band_key(filename: str) -> str | None:
    match = BAND_PATTERN.search(filename)
    if not match:
        return None
    return match.group(1).upper()


def to_unit_range(arr: np.ndarray) -> np.ndarray:
    lo = np.percentile(arr, 2)
    hi = np.percentile(arr, 98)
    if hi <= lo:
        return np.zeros_like(arr, dtype=np.float32)
    normalized = (arr - lo) / (hi - lo)
    return np.clip(normalized, 0.0, 1.0).astype(np.float32)


def classify_bands(bands: dict[str, np.ndarray]) -> np.ndarray:
    # Use common shape in case one band differs by a pixel margin
    min_h = min(v.shape[0] for v in bands.values())
    min_w = min(v.shape[1] for v in bands.values())

    for key in list(bands.keys()):
        bands[key] = bands[key][:min_h, :min_w]

    blue = to_unit_range(bands["B02"])
    green = to_unit_range(bands["B03"])
    red = to_unit_range(bands["B04"])
    nir = to_unit_range(bands["B08"])
    swir1 = to_unit_range(bands.get("B11", bands["B08"]))
    cirrus = to_unit_range(bands.get("B01", bands["B02"]))

    eps = 1e-6
    ndvi = (nir - red) / (nir + red + eps)
    ndwi = (green - nir) / (green + nir + eps)
    brightness = (red + green + blue) / 3.0

    class_map = np.full((min_h, min_w), 2, dtype=np.uint8)  # 2 = Sand baseline

    cloud_mask = (cirrus > 0.65) | ((blue > 0.72) & (brightness > 0.70))
    water_mask = (ndwi > 0.10) & (nir < 0.45) & (~cloud_mask)
    seagrass_mask = water_mask & (ndvi > 0.03) & (swir1 < 0.55)

    class_map[water_mask] = 0
    class_map[seagrass_mask] = 1
    class_map[cloud_mask] = 3

    return class_map


def encode_class_map_png(class_map: np.ndarray) -> str:
    # 0 Water, 1 Seagrass, 2 Sand, 3 Clouds
    palette = np.array(
        [
            [74, 158, 255],   # Water
            [61, 220, 132],   # Seagrass
            [232, 201, 122],  # Sand
            [255, 255, 255],  # Cloud
        ],
        dtype=np.uint8,
    )

    rgb = palette[class_map]
    image = Image.fromarray(rgb, mode="RGB")
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _load_class_names(raw_class_names) -> list[str]:
    flattened = np.asarray(raw_class_names).reshape(-1)
    names: list[str] = []
    for item in flattened:
        if isinstance(item, bytes):
            names.append(item.decode("utf-8"))
            continue
        if isinstance(item, np.ndarray):
            if item.size == 1:
                item = item.item()
            else:
                item = item.reshape(-1)[0]
        names.append(str(item))
    return [name.strip() for name in names if name is not None and str(name).strip()]


def normalize_class_map(class_map: np.ndarray) -> np.ndarray:
    """Normalize labels to the canonical UI order: 0 Water, 1 Seagrass, 2 Sand, 3 Clouds.

    The training notebook uses 1-based labels in this order:
    1=Seagrass, 2=Sand, 3=Water, 4=Clouds.
    The fallback spectral classifier already uses the canonical 0-based order.
    """
    normalized = class_map.astype(np.int16)

    if normalized.min() >= 0 and normalized.max() <= 3:
        return normalized.astype(np.uint8)

    if normalized.min() >= 1 and normalized.max() <= 4:
        if trained_class_names:
            canonical_by_name = {
                "Water": 0,
                "Seagrass": 1,
                "Sand": 2,
                "Clouds": 3,
            }
            remapped = np.empty_like(normalized, dtype=np.uint8)
            for model_index, class_name in enumerate(trained_class_names, start=1):
                if class_name not in canonical_by_name:
                    raise ValueError(f"Unsupported class name in MAT file: {class_name}")
                remapped[normalized == model_index] = canonical_by_name[class_name]
            return remapped

        remapped = np.empty_like(normalized, dtype=np.uint8)
        remapped[normalized == 1] = 1  # Seagrass
        remapped[normalized == 2] = 2  # Sand
        remapped[normalized == 3] = 0  # Water
        remapped[normalized == 4] = 3  # Clouds
        return remapped

    unique_labels = np.unique(normalized)
    raise ValueError(f"Unexpected class labels in class map: {unique_labels.tolist()}")


def build_class_stats(class_map: np.ndarray) -> dict[str, int]:
    total_pixels = int(class_map.size)
    water_pixels = int((class_map == 0).sum())
    seagrass_pixels = int((class_map == 1).sum())
    sand_pixels = int((class_map == 2).sum())
    cloud_pixels = int((class_map == 3).sum())

    return {
        "totalCoastalPixels": total_pixels,
        "waterPixels": water_pixels,
        "seagrassPixels": seagrass_pixels,
        "sandPixels": sand_pixels,
        "cloudPixels": cloud_pixels,
    }


def classify_with_cnn(band_arrays: dict[str, np.ndarray]) -> np.ndarray:
    """Use trained CNN model to classify pixel values."""
    global model, device, mu_vals, sigma_vals, scaler
    
    if not trained_model_available or mu_vals is None or sigma_vals is None:
        return None
    
    # Normalize like training
    min_h = min(v.shape[0] for v in band_arrays.values())
    min_w = min(v.shape[1] for v in band_arrays.values())
    
    band_order = ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B09", "B11", "B12"]
    
    # Build 12-band feature matrix
    features_raw = []
    for band_label in band_order:
        if band_label in band_arrays:
            band_data = band_arrays[band_label][:min_h, :min_w]
            features_raw.append(band_data)
    
    if len(features_raw) < 12:
        return None
    
    # Stack to [H, W, 12]
    band_matrix_raw = np.stack(features_raw, axis=2).astype(np.float32)
    
    # Compute spectral indices
    B02 = band_matrix_raw[:,:,1]
    B03 = band_matrix_raw[:,:,2]
    B04 = band_matrix_raw[:,:,3]
    B08 = band_matrix_raw[:,:,7]
    B11 = band_matrix_raw[:,:,10]
    
    eps = 1e-8
    NDVI = (B08 - B04) / (B08 + B04 + eps)
    NDWI = (B03 - B08) / (B03 + B08 + eps)
    MNDWI = (B03 - B11) / (B03 + B11 + eps)
    Brightness = (B02 + B03 + B04) / 3.0
    
    # Build 16-band feature matrix
    band_matrix = np.concatenate([
        band_matrix_raw,
        NDVI[..., np.newaxis],
        NDWI[..., np.newaxis],
        MNDWI[..., np.newaxis],
        Brightness[..., np.newaxis]
    ], axis=2)
    
    rows, cols, num_bands = band_matrix.shape
    
    # Standardize
    features_flat = band_matrix.reshape(rows * cols, num_bands)
    features_z = (features_flat - mu_vals) / (sigma_vals + 1e-8)
    
    # Predict with CNN
    X_torch = torch.from_numpy(features_z.astype(np.float32)).to(device)
    
    model.eval()
    with torch.no_grad():
        outputs = model(X_torch)
        probs = torch.softmax(outputs, dim=1)
        predicted = torch.argmax(outputs, dim=1)
    
    predicted_np = predicted.cpu().numpy() + 1  # Convert to 1-indexed
    probs_np = probs.cpu().numpy()
    
    # Apply probability-based correction
    cloud_idx = 3  # 1-indexed
    sand_idx = 1   # 1-indexed
    
    is_cloud = (predicted_np == cloud_idx)
    low_conf = probs_np[:, 3] < 0.5  # 0-indexed cloud
    sand_high = probs_np[:, 1] > 0.5  # 0-indexed sand
    flip_mask = is_cloud & low_conf & sand_high
    
    predicted_np[flip_mask] = sand_idx
    
    # Reshape back to image
    class_map = predicted_np.reshape(rows, cols)
    return class_map

@app.on_event("startup")
async def load_model():
    global mu_vals, sigma_vals, scaler, trained_model_available, trained_class_names
    print(f"Loading MATLAB network weights from: {MODEL_PATH}")
    try:
        try:
            # Try to load with scipy.io first
            mat_data = sio.loadmat(MODEL_PATH)
            mu_vals = mat_data['mu'].flatten()
            sigma_vals = mat_data['sigma'].flatten()
            if 'classNames' in mat_data:
                trained_class_names = _load_class_names(mat_data['classNames'])
        except (NotImplementedError, KeyError):
            # Handle MATLAB v7.3 HDF5 files
            with h5py.File(MODEL_PATH, 'r') as mat_data:
                mu_vals = np.array(mat_data['mu']).flatten()
                sigma_vals = np.array(mat_data['sigma']).flatten()
                if 'classNames' in mat_data:
                    trained_class_names = _load_class_names(np.array(mat_data['classNames']))
                
        print(f"Extracted MU and SIGMA from MAT file.")
        if trained_class_names:
            print(f"Loaded class order from MAT file: {trained_class_names}")
        
        # Try to load PyTorch model if available
        if os.path.exists(PYTORCH_MODEL_PATH):
            try:
                model.load_state_dict(torch.load(PYTORCH_MODEL_PATH, map_location=device))
                model.eval()
                trained_model_available = True
                print(f"✓ Loaded trained PyTorch model from: {PYTORCH_MODEL_PATH}")
                print(f"✓ Using trained CNN for inference")
            except Exception as e:
                print(f"Could not load PyTorch model: {e}")
                print(f"Will use spectral fallback classifier")
                trained_model_available = False
        else:
            print(f"PyTorch model not found at {PYTORCH_MODEL_PATH}")
            print(f"Will use spectral fallback classifier")
            trained_model_available = False
            
    except Exception as e:
        print(f"Model load notice: {e}")

@app.post("/predict")
async def predict_coastal_area(files: list[UploadFile] = File(...)):
    """
    Endpoint for the React UI to upload the 12 Sentinel-2 TIFF bands or a ZIP file.
    """
    processed_files = []
    band_arrays: dict[str, np.ndarray] = {}
    
    # Handle ZIP extraction vs direct TIFF uploads
    for file in files:
        if file.filename.lower().endswith(".zip"):
            try:
                # Read zip file in memory
                content = await file.read()
                with zipfile.ZipFile(io.BytesIO(content)) as z:
                    # Filter for TIFF inside the ZIP
                    tiff_files = [n for n in z.namelist() if n.lower().endswith((".tiff", ".tif"))]
                    for name in tiff_files:
                        processed_files.append(name)
                        band_key = extract_band_key(name)
                        if not band_key:
                            continue
                        band_raw = z.read(name)
                        band_arr = tifffile.imread(io.BytesIO(band_raw))
                        if band_arr.ndim > 2:
                            band_arr = band_arr[..., 0]
                        band_arrays[band_key] = band_arr.astype(np.float32)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Bad zip file: {str(e)}")
        elif file.filename.lower().endswith((".tiff", ".tif")):
            processed_files.append(file.filename)
            band_key = extract_band_key(file.filename)
            if not band_key:
                continue

            band_raw = await file.read()
            band_arr = tifffile.imread(io.BytesIO(band_raw))
            if band_arr.ndim > 2:
                band_arr = band_arr[..., 0]
            band_arrays[band_key] = band_arr.astype(np.float32)
            
    print(f"Received and parsed {len(processed_files)} TIFF bands for processing: {processed_files}")
    
    if len(processed_files) < 12:
        print(f"Warning: Expected 12 bands, found {len(processed_files)}")

    required = {"B02", "B03", "B04", "B08"}
    missing_required = sorted(required - set(band_arrays.keys()))
    if missing_required:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required bands for inference: {', '.join(missing_required)}",
        )

    # Try CNN first if available, fall back to spectral
    use_cnn = False
    if trained_model_available:
        try:
            class_map = classify_with_cnn(band_arrays)
            if class_map is not None:
                use_cnn = True
                print("✓ Using trained CNN for classification")
            else:
                print("CNN returned None, falling back to spectral")
        except Exception as e:
            print(f"CNN error: {e}, falling back to spectral")
    
    if not use_cnn:
        print("Using spectral fallback classification")
        class_map = classify_bands(band_arrays)

    class_map = normalize_class_map(class_map)
    image_base64 = encode_class_map_png(class_map)
    stats = build_class_stats(class_map)

    return JSONResponse({
        "message": "Classification generated from uploaded bands", 
        "status": "complete",
        "trained_model_used": use_cnn,
        "inference_mode": "trained_cnn" if use_cnn else "spectral_fallback",
        "bands_found": len(processed_files),
        "files": processed_files,
        "image_base64": image_base64,
        "stats": stats
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
