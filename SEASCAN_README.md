# SEASCAN Overview

SEASCAN is a full-stack coastal monitoring system that classifies Sentinel-2 imagery, stores results in per-user SQLite databases, and visualizes trends in a React dashboard.

- Backend: FastAPI + PyTorch (classification, storage, auth)
- Frontend: React + Vite (upload, analytics, data management)
- Storage: auth in auth.db, per-user data in user_dbs/<username>.db

## Prerequisites

- Python 3.10+ (3.13 OK)
- Node.js 18+ (npm)

## Install and Run

### 1) Backend (API)

```powershell
cd trained_model/Code
# Optional: activate venv if you use it
..\.venv\Scripts\Activate.ps1

pip install -r ..\requirements.txt
python classifier_ui.py

or 

& "C:/Users/James/OneDrive/Documents/James/BSU/3202/Software Design/SEASCAN/.venv/Scripts/python.exe" -m uvicorn classifier_ui:app --host 0.0.0.0 --port 8000 --reload
```

API starts at http://localhost:8000

### 2) Frontend (UI)

```powershell
cd "seascan ui"
npm install
npm run dev
```

UI starts at http://localhost:5173

## Auth Bootstrap (Optional)

```powershell
$env:SEASCAN_ADMIN_USER = "admin"
$env:SEASCAN_ADMIN_PASS = "change-me"
$env:SEASCAN_USER_USER = "user"
$env:SEASCAN_USER_PASS = "change-me"
$env:SEASCAN_JWT_SECRET = "replace-with-strong-secret"
```