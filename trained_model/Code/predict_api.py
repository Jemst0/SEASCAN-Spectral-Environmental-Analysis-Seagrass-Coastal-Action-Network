from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import io
import os
import zipfile
import tempfile
from pathlib import Path
from typing import List, Optional

import numpy as np
import tifffile
from PIL import Image
from scipy import signal
import scipy.io as sio
import torch
import torch.nn as nn

from upload_utils import extract_uploaded_files

app = FastAPI(title="Coastal Classifier Inference")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Expect to find saved model artifacts here (same layout as notebook)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_FOLDER = PROJECT_ROOT / "Coastal_Area_NRG"
DATA_FOLDER = Path(os.environ.get("SEASCAN_DATA_DIR", str(DEFAULT_DATA_FOLDER)))
MAT_FILE = Path(os.environ.get("SEASCAN_MODEL_MAT", str(DATA_FOLDER / "Coastal_Area_Classifier.mat")))
PTH_FILE = Path(os.environ.get("SEASCAN_MODEL_PTH", str(DATA_FOLDER / "coastal_classifier_pytorch.pth")))

band_labels = ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B09", "B11", "B12"]

class Coastal1DCNN(nn.Module):
    def __init__(self, num_bands=16, num_classes=4):
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

    def forward(self, x):
        x = x.view(-1, 1, self.num_bands)
        x = self.pool1(self.relu1(self.bn1(self.conv1(x))))
        x = self.pool2(self.relu2(self.bn2(self.conv2(x))))
        x = self.relu3(self.bn3(self.conv3(x)))
        x = self.flatten(x)
        x = self.dropout(self.relu_fc1(self.fc1(x)))
        return self.fc_out(x)


def find_tiffs_in_dir(path: Path):
    """Return sorted .tif/.tiff files in a directory."""
    return sorted([p for p in path.iterdir() if p.suffix.lower() in ('.tif', '.tiff')])


def load_model_and_scaler():
    """Load model weights and normalization parameters."""
    if not MAT_FILE.exists() or not PTH_FILE.exists():
        raise FileNotFoundError("Model artifacts not found in expected location: {}".format(DATA_FOLDER))

    mat = sio.loadmat(str(MAT_FILE))
    mu = mat.get('mu').astype(np.float32)
    sigma = mat.get('sigma').astype(np.float32)

    num_bands = int(np.squeeze(mat.get('numBands')))
    num_classes = int(np.squeeze(mat.get('numClasses')))

    model = Coastal1DCNN(num_bands=num_bands, num_classes=num_classes)
    state = torch.load(str(PTH_FILE), map_location='cpu')
    model.load_state_dict(state)
    model.eval()

    return model, mu, sigma


def build_stack_from_files(files: List[Path]):
    # map band labels to files by name containing label
    band_data = {}
    for label in band_labels:
        matched = None
        for f in files:
            if label.lower() in f.name.lower():
                matched = f
                break
        if matched is None:
            raise ValueError(f"Missing required band file for {label}")
        img = tifffile.imread(matched)
        if img.ndim > 2:
            img = img[..., 0]
        band_data[label] = img.astype(np.float32)

    base_shape = next(iter(band_data.values())).shape
    rows, cols = base_shape
    stack = np.zeros((rows, cols, len(band_labels)), dtype=np.float32)
    for k, label in enumerate(band_labels):
        stack[:, :, k] = band_data[label]

    # compute indices
    B02 = stack[:, :, 1]
    B03 = stack[:, :, 2]
    B04 = stack[:, :, 3]
    B08 = stack[:, :, 7]
    B11 = stack[:, :, 10]
    eps = 1e-8
    NDVI = (B08 - B04) / (B08 + B04 + eps)
    NDWI = (B03 - B08) / (B03 + B08 + eps)
    MNDWI = (B03 - B11) / (B03 + B11 + eps)
    Brightness = (B02 + B03 + B04) / 3.0

    full_stack = np.concatenate([stack, NDVI[..., None], NDWI[..., None], MNDWI[..., None], Brightness[..., None]], axis=2)
    return full_stack


@app.post('/predict')
async def predict(files: Optional[List[UploadFile]] = File(None), file: Optional[UploadFile] = File(None)):
    """
    Accept either a single ZIP (field 'file') or multiple TIFF files (field 'files')
    Returns JSON with base64 image and simple metrics.
    """
    import base64

    tmpd = Path(tempfile.mkdtemp())
    try:
        if file is not None:
            content = await file.read()
            saved = extract_uploaded_files([(file.filename or 'upload', content)], tmpd)
        elif files is not None and len(files) > 0:
            uploads = [(up.filename or 'band.tiff', await up.read()) for up in files]
            saved = extract_uploaded_files(uploads, tmpd)
        else:
            raise HTTPException(status_code=400, detail='No files uploaded')

        if not saved:
            raise HTTPException(status_code=400, detail='No TIFF files found in upload')

        # Stage 1: Band Extraction
        stack = build_stack_from_files(saved)
        rows, cols, nb = stack.shape

        # Stage 2: Spectral Indices (computed in build_stack_from_files)
        model, mu, sigma = load_model_and_scaler()

        # prepare features
        features = stack.reshape(rows * cols, nb)
        # standardize using saved mu/sigma
        mu = mu.reshape(1, -1)
        sigma = sigma.reshape(1, -1)
        feats_z = (features - mu) / (sigma + 1e-8)

        # Stage 3: CNN Inference
        batch = 16384
        preds = np.zeros((features.shape[0],), dtype=np.uint8)
        with torch.no_grad():
            for i in range(0, feats_z.shape[0], batch):
                xb = feats_z[i:i+batch]
                xb_t = torch.from_numpy(xb.astype(np.float32))
                out = model(xb_t)
                _, p = torch.max(out.data, 1)
                preds[i:i+len(p)] = (p.cpu().numpy() + 1).astype(np.uint8)

        classified = preds.reshape(rows, cols)

        # Stage 4: Coastal Metrics - try to find a true color for overlay
        tc_path = None
        for p in saved:
            if 'true' in p.name.lower():
                tc_path = p
                break
        if tc_path is None:
            # construct from loaded band data: B04,B03,B02
            try:
                B04 = stack[:, :, 3]
                B03 = stack[:, :, 2]
                B02 = stack[:, :, 1]
                rgb = np.stack([B04, B03, B02], axis=2)
                # normalize to 0-255
                rgb = rgb - rgb.min()
                if rgb.max() > 0:
                    rgb = (rgb / rgb.max() * 255).astype(np.uint8)
                else:
                    rgb = (rgb).astype(np.uint8)
            except Exception:
                rgb = np.zeros((rows, cols, 3), dtype=np.uint8)
        else:
            rgb = tifffile.imread(tc_path)
            if rgb.dtype != np.uint8:
                # scale if in 0-1 or float
                if rgb.max() <= 1.0:
                    rgb = (rgb * 255).astype(np.uint8)

        # build overlay colors (full image), then restrict blending to the actual water mask
        overlay = np.zeros_like(rgb, dtype=np.uint8)
        # color mapping like notebook: 1=Seagrass green, 2=Sand yellow, 3=Water blue, 4=Cloud white
        overlay[classified == 1] = [0, 255, 0]
        overlay[classified == 2] = [255, 255, 0]
        overlay[classified == 3] = [0, 115, 255]
        overlay[classified == 4] = [255, 255, 255]

        # Compute water mask and coastal buffer (follow notebook logic)
        base_bands = len(band_labels)
        # NDWI is at index base_bands + 1 in the full stack (NDVI, NDWI, MNDWI, Brightness appended)
        try:
            NDWI = stack[:, :, base_bands + 1]
            MNDWI = stack[:, :, base_bands + 2]
            water_mask = (NDWI > 0.02) | (MNDWI > 0.02)
        except Exception:
            # fallback: treat all as coastal if indices unavailable
            water_mask = np.zeros((rows, cols), dtype=bool)

        kernel = np.ones((11, 11))
        coastal_buffer_mask = signal.convolve2d(water_mask.astype(float), kernel, mode='same') > 0

        # Only blend overlay where the actual water mask indicates coastal pixels and where classification exists
        overlay_mask = water_mask & (classified != 0)

        alpha = 0.5
        # Start with a copy of the base RGB
        blend = rgb.copy().astype(np.uint8)
        if overlay_mask.any():
            # apply blending only at masked pixels
            base_px = rgb[overlay_mask].astype(np.float32)
            ov_px = overlay[overlay_mask].astype(np.float32)
            blended_px = ((1 - alpha) * base_px + alpha * ov_px).astype(np.uint8)
            blend[overlay_mask] = blended_px

        img = Image.fromarray(blend)
        bio = io.BytesIO()
        img.save(bio, format='PNG')
        bio.seek(0)
        b64 = base64.b64encode(bio.read()).decode('ascii')

        # metrics: simple counts
        coastal_mask = np.ones_like(classified, dtype=bool)
        total_coastal = int(np.sum(coastal_mask))
        seagrass = int(np.sum(classified == 1))
        sand = int(np.sum(classified == 2))

        return {
            'image_base64': b64,
            'metrics': {
                'total_pixels': total_coastal,
                'seagrass_pixels': seagrass,
                'sand_pixels': sand,
            }
        }
    finally:
        # cleanup
        try:
            for p in tmpd.iterdir():
                if p.is_file():
                    p.unlink()
            tmpd.rmdir()
        except Exception:
            pass


@app.post('/predict-stream')
async def predict_stream(files: Optional[List[UploadFile]] = File(None), file: Optional[UploadFile] = File(None)):
    """
    Streaming version of predict that sends progress updates via Server-Sent Events.
    """
    async def generate_events() -> AsyncGenerator[str, None]:
        import base64

        tmpd = Path(tempfile.mkdtemp())
        try:
            saved = []
            if file is not None:
                fname = file.filename
                content = await file.read()
                if fname.lower().endswith('.zip'):
                    z = zipfile.ZipFile(io.BytesIO(content))
                    z.extractall(tmpd)
                    saved = find_tiffs_in_dir(tmpd)
                elif fname.lower().endswith(('.tif', '.tiff')):
                    p = tmpd / fname
                    p.write_bytes(content)
                    saved = [p]
            elif files is not None and len(files) > 0:
                for up in files:
                    content = await up.read()
                    p = tmpd / up.filename
                    p.write_bytes(content)
                saved = find_tiffs_in_dir(tmpd)

            if not saved:
                yield f"data: {json.dumps({'status': 'error', 'message': 'No TIFF files found'})}\n\n"
                return

            # Stage 1: Band Extraction
            yield f"data: {json.dumps({'stage': 1, 'status': 'in_progress', 'stageName': 'Band Extraction', 'description': 'Extract 12 TIFF bands from ZIP'})}\n\n"
            await asyncio.sleep(0.1)
            
            stack = build_stack_from_files(saved)
            rows, cols, nb = stack.shape
            yield f"data: {json.dumps({'stage': 1, 'status': 'complete', 'stageName': 'Band Extraction'})}\n\n"
            await asyncio.sleep(0.1)

            # Stage 2: Spectral Indices
            yield f"data: {json.dumps({'stage': 2, 'status': 'in_progress', 'stageName': 'Spectral Indices', 'description': 'Compute NDVI, NDWI, MNDWI, Brightness'})}\n\n"
            await asyncio.sleep(0.1)
            
            model, mu, sigma = load_model_and_scaler()
            features = stack.reshape(rows * cols, nb)
            mu = mu.reshape(1, -1)
            sigma = sigma.reshape(1, -1)
            feats_z = (features - mu) / (sigma + 1e-8)
            
            yield f"data: {json.dumps({'stage': 2, 'status': 'complete', 'stageName': 'Spectral Indices'})}\n\n"
            await asyncio.sleep(0.1)

            # Stage 3: CNN Inference
            yield f"data: {json.dumps({'stage': 3, 'status': 'in_progress', 'stageName': 'CNN Inference', 'description': 'Classify coastal habitats'})}\n\n"
            
            batch = 16384
            preds = np.zeros((features.shape[0],), dtype=np.uint8)
            with torch.no_grad():
                for i in range(0, feats_z.shape[0], batch):
                    xb = feats_z[i:i+batch]
                    xb_t = torch.from_numpy(xb.astype(np.float32))
                    out = model(xb_t)
                    _, p = torch.max(out.data, 1)
                    preds[i:i+len(p)] = (p.cpu().numpy() + 1).astype(np.uint8)
                    await asyncio.sleep(0.01)

            classified = preds.reshape(rows, cols)
            yield f"data: {json.dumps({'stage': 3, 'status': 'complete', 'stageName': 'CNN Inference'})}\n\n"
            await asyncio.sleep(0.1)

            # Stage 4: Coastal Metrics
            yield f"data: {json.dumps({'stage': 4, 'status': 'in_progress', 'stageName': 'Coastal Metrics', 'description': 'Apply buffer mask & overlay'})}\n\n"
            
            tc_path = None
            for p in saved:
                if 'true' in p.name.lower():
                    tc_path = p
                    break
            if tc_path is None:
                try:
                    B04 = stack[:, :, 3]
                    B03 = stack[:, :, 2]
                    B02 = stack[:, :, 1]
                    rgb = np.stack([B04, B03, B02], axis=2)
                    rgb = rgb - rgb.min()
                    if rgb.max() > 0:
                        rgb = (rgb / rgb.max() * 255).astype(np.uint8)
                    else:
                        rgb = (rgb).astype(np.uint8)
                except Exception:
                    rgb = np.zeros((rows, cols, 3), dtype=np.uint8)
            else:
                rgb = tifffile.imread(tc_path)
                if rgb.dtype != np.uint8:
                    if rgb.max() <= 1.0:
                        rgb = (rgb * 255).astype(np.uint8)

            overlay = np.zeros_like(rgb, dtype=np.uint8)
            overlay[classified == 1] = [0, 255, 0]
            overlay[classified == 2] = [255, 255, 0]
            overlay[classified == 3] = [0, 115, 255]
            overlay[classified == 4] = [255, 255, 255]

            base_bands = len(band_labels)
            try:
                NDWI = stack[:, :, base_bands + 1]
                MNDWI = stack[:, :, base_bands + 2]
                water_mask = (NDWI > 0.02) | (MNDWI > 0.02)
            except Exception:
                water_mask = np.zeros((rows, cols), dtype=bool)

            kernel = np.ones((11, 11))
            coastal_buffer_mask = signal.convolve2d(water_mask.astype(float), kernel, mode='same') > 0
            overlay_mask = coastal_buffer_mask & (classified != 0)

            alpha = 0.5
            blend = rgb.copy().astype(np.uint8)
            if overlay_mask.any():
                base_px = rgb[overlay_mask].astype(np.float32)
                ov_px = overlay[overlay_mask].astype(np.float32)
                blended_px = ((1 - alpha) * base_px + alpha * ov_px).astype(np.uint8)
                blend[overlay_mask] = blended_px

            img = Image.fromarray(blend)
            bio = io.BytesIO()
            img.save(bio, format='PNG')
            bio.seek(0)
            b64 = base64.b64encode(bio.read()).decode('ascii')

            coastal_mask = np.ones_like(classified, dtype=bool)
            total_coastal = int(np.sum(coastal_mask))
            seagrass = int(np.sum(classified == 1))
            sand = int(np.sum(classified == 2))

            yield f"data: {json.dumps({'stage': 4, 'status': 'complete', 'stageName': 'Coastal Metrics'})}\n\n"
            await asyncio.sleep(0.1)

            # Send results
            yield f"data: {json.dumps({'status': 'complete', 'image_base64': b64, 'metrics': {'total_pixels': total_coastal, 'seagrass_pixels': seagrass, 'sand_pixels': sand}})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
        finally:
            try:
                for p in tmpd.iterdir():
                    if p.is_file():
                        p.unlink()
                tmpd.rmdir()
            except Exception:
                pass

    return StreamingResponse(generate_events(), media_type="text/event-stream")
