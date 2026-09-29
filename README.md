# Ocean Deja Vu 🌊

**Subsurface Ocean Temperature Reconstruction** using satellite surface observations + self-supervised ML.

## How to Run

### Step 1 — Start the Backend (FastAPI)

```powershell
# From SIH/ directory, in the pytorch conda env
conda activate pytorch
$env:PYTHONPATH = "ML"
python -m uvicorn src.serving.api:app --host 0.0.0.0 --port 8000 --reload
```

Backend → http://localhost:8000 | Docs → http://localhost:8000/docs

### Step 2 — Start the Frontend (React/Vite)

```powershell
cd frontend
npm run dev
```

Frontend → http://localhost:5173

---

## Switch to Live Model (After Training)

```powershell
$env:ODV_LIVE_MODEL = "1"
$env:ODV_ZARR_STORE = "../Dataset"
$env:PYTHONPATH = "ML"
python -m uvicorn src.serving.api:app --host 0.0.0.0 --port 8000
```

---

## Train the Model

```powershell
conda activate pytorch
cd ML
$env:PYTHONIOENCODING = "utf-8"
# Smoke test (7 days):
python scripts/train_smoke_test.py --store ../Dataset --epochs_pretrain 3 --epochs_s1 5 --epochs_s2 3 --batch 2

# Full dataset (6 months):
python scripts/train_smoke_test.py --store ../Dataset --epochs_pretrain 20 --epochs_s1 50 --epochs_s2 30 --batch 8
```

---

## File Structure

```
SIH/
├── frontend/               ← React/Vite UI
│   ├── src/pages/          ← Map, Profile, DeepDive, Validation
│   └── vite.config.js      ← Dev proxy to FastAPI:8000
├── ML/
│   ├── src/serving/api.py  ← Unified FastAPI backend
│   ├── src/models/         ← encoder, decoder, MAE, retrieval
│   ├── src/training/       ← pretrain + supervised scripts
│   └── scripts/train_smoke_test.py
├── Dataset/                ← Zarr v3 dataset (extracted from .zip)
├── start_server.py         ← Quick backend launcher
└── requirements.txt
```
