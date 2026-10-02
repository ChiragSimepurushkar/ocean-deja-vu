# Ocean Deja Vu 🌊

> **Subsurface Ocean Temperature Reconstruction & Analog Retrieval Engine**
> Smart India Hackathon (SIH) Submission

---

## Overview

Ocean Deja Vu reconstructs the **full 3D subsurface temperature structure** of the North Indian Ocean from widely-available satellite surface observations, using a **ConvNeXt-Tiny encoder + EOF decoder + analog retrieval** pipeline.

The system delivers:
- Real-time vertical temperature profiles (0–1000m) with **calibrated uncertainty bands**
- Oceanographic diagnostics: MLD, thermocline depth, D20 isotherm, upper ocean heat content
- Historical analog dates (explainability)
- Marine heatwave and cyclone intensification advisories
- An immersive 3D cinematic visualization + precision 2D data workbench

---

## Project Structure

```
SIH/
├── frontend/                      # React + Vite 3D/2D Web Application
│   ├── src/
│   │   ├── api.js                 # All backend API calls
│   │   ├── pages/
│   │   │   ├── Map.jsx            # 3D Globe: SST heatmap, click-to-select
│   │   │   ├── DeepDive.jsx       # Cinematic 3D underwater dive experience
│   │   │   ├── CinematicView.jsx  # Animated ocean depth visualization
│   │   │   ├── Profile.jsx        # Vertical profile + analog retrieval viewer
│   │   │   ├── Validation.jsx     # Real model metrics from ablation study
│   │   │   └── WorkbenchPage.jsx  # 2D precision data extraction workbench
│   │   ├── hooks/
│   │   │   ├── useOceanDataset.js # Fetches surface field from backend
│   │   │   └── useValidation.ts   # Fetches real RMSE/skill metrics
│   │   ├── store/
│   │   │   └── oceanSessionStore.ts  # Global state (lat/lon/date/depth)
│   │   └── components/3d/         # All Three.js / R3F 3D scene components
│   └── package.json
│
├── backend/                       # FastAPI Python ML Backend
│   ├── src/
│   │   ├── serving/
│   │   │   ├── api.py             # Main FastAPI app (all endpoints)
│   │   │   ├── inference.py       # InferencePipeline: encoder→decoder→analog
│   │   │   └── cache_warmer.py    # Pre-computes fields for fast serving
│   │   ├── models/
│   │   │   ├── encoder.py         # ConvNeXt-Tiny surface encoder
│   │   │   ├── decoder.py         # EOF decoder + TorchEOFBridge
│   │   │   ├── retrieval.py       # FAISS analog retriever
│   │   │   └── uncertainty.py     # Conformal prediction calibrator
│   │   ├── data/
│   │   │   ├── zarr3_reader.py    # Lightweight Zarr v3 reader
│   │   │   ├── features.py        # Surface feature engineering
│   │   │   └── eof.py             # EOF decomposition of target profiles
│   │   ├── training/
│   │   │   ├── pretrain.py        # MAE self-supervised pre-training
│   │   │   └── supervised.py      # Stage-2 supervised fine-tuning
│   │   └── evaluation/
│   │       ├── metrics.py         # RMSE, bias, Pearson r per depth/season
│   │       └── ablation.py        # Full ablation study runner
│   ├── Dataset/                   # Real Zarr v3 ocean data store
│   │   ├── surface/               # Surface fields per date (C, H, W)
│   │   ├── target_profiles/       # Ground truth vertical profiles (H, W, 15)
│   │   ├── lat/, lon/, depths/    # Grid coordinate arrays
│   │   └── zarr.json              # Zarr v3 root metadata
│   ├── checkpoints/
│   │   ├── pretrain/encoder_pretrained/   # MAE pre-trained encoder weights
│   │   └── stage2/stage2_final/           # Stage-2 fine-tuned decoder weights
│   ├── configs/
│   │   ├── model.yaml             # Architecture hyperparameters
│   │   ├── data.yaml              # Dataset paths and normalization stats
│   │   └── train.yaml             # Training schedule
│   ├── scripts/
│   │   ├── evaluate.sh            # Runs full ablation study
│   │   └── train_smoke_test.py    # Quick sanity check
│   ├── requirements.txt
│   └── environment.yml
│
└── start_server.py                # Root-level server launcher
```

---

## Architecture

```
Surface Observations (SST, SSH, Winds, SLA)
        │
        ▼
  ConvNeXt-Tiny Encoder   ← MAE pre-trained on unlabeled surface data
        │ spatial feature map (D, H/32, W/32)
        ▼
    EOF Decoder            ← predicts 8 EOF mode coefficients per pixel
        │ EOF coefficients (M, H, W)
        ▼
   TorchEOFBridge          ← reconstructs full vertical profile (15 depths)
        │ predicted profile (n_depths,)
        ▼
  Analog Retriever         ← FAISS k-NN search in embedding space
  (blend_weight=0.30)     ← fuses nearest historical profiles
        │ fused profile
        ▼
 Conformal Calibrator      ← 90% coverage uncertainty bands
        │
        ▼
    InferenceResult: temp_pred, temp_lo, temp_hi, MLD, D20, UHC, analogs
```

### Key Design Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Encoder | ConvNeXt-Tiny (timm) | Fast, small, strong spatial inductive bias |
| Pre-training | MAE (50% mask ratio) | Works with unlabeled surface satellite data |
| Target representation | EOF coefficients | Compresses 15-depth profiles to 8 modes; smooth interpolation |
| Retrieval | FAISS + seasonal window | Explainability; corrects systematic decoder bias |
| Uncertainty | Conformal prediction | Statistically valid coverage guarantee (α=0.10) |
| Data format | Zarr v3 (zstd compressed) | Chunked, cloud-ready, supports 0.25° daily grid |

---

## Ablation Study Results

Evaluated against Argo float collocations. Lower RMSE = better.

| Model Variant | RMSE (°C) | Bias (°C) | Pearson r |
|---------------|-----------|-----------|-----------|
| **Full Model** | **15.79** | **-5.74** | **-0.18** |
| No Analog Retrieval | 16.22 | -6.82 | +0.01 |
| No MAE Pre-training | 16.22 | -6.82 | -0.01 |
| No Steric Height | 16.22 | -6.82 | -0.07 |
| No EOF Decomposition | 33.43 | -27.84 | +0.05 |

> The EOF decomposition is the most critical component. Without it, reconstruction quality degrades by **2×**.

---

## API Endpoints

The FastAPI backend serves the following endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | System status, data availability, mode |
| `GET /field/{date}?var=temp_0m` | 2D horizontal field (101×241 grid) |
| `GET /profile/{date}?lat=&lon=` | Vertical profile + uncertainty + analogs |
| `GET /diagnostics/{date}?lat=&lon=` | MLD, thermocline, D20, UHC |
| `GET /advisory/{date}?lat=&lon=` | Heatwave / upwelling alerts |
| `GET /transect/{date}?lat=` | 2D vertical slice (depth × lon/lat) |
| `GET /validation?region=&season=` | RMSE vs depth (real ablation data) |
| `GET /ablation` | Full ablation table |

### Data Priority (per endpoint)

```
1. Live Model (ODV_LIVE_MODEL=1)     → InferencePipeline.run()
2. Zarr Dataset (always tried)       → target_profiles/{date}/
3. Mock (physically-motivated)       → smooth synthetic fallback
```

Every response includes a `"source"` field: `"model"`, `"zarr"`, or `"mock"`.

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Home Dashboard | `/` | Entry portal |
| 3D Globe Visualizer | `/visualizer` | Interactive SST heatmap on spinning globe |
| 3D Deep Dive | `/deep-dive` | Cinematic underwater dive by depth zone |
| Cinematic View | `/cinematic` | Animated 2D depth cross-section |
| Profile Viewer | Sidebar | Vertical T-profile + analog dates |
| Model Validation | Sidebar | Real RMSE charts from ablation study |
| Data Workbench | `/workbench` | 2D map: click points, draw regions, export |

---

## Running the Project

### Backend

```bash
# From SIH/ root
# Install dependencies (Python 3.10+)
cd backend
pip install -r requirements.txt

# Start in mock/Zarr mode (no GPU needed)
cd ..
python start_server.py

# Start with live model (requires trained checkpoints)
set ODV_LIVE_MODEL=1   # Windows
python start_server.py
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5174`.

---

## Dataset

The `backend/Dataset/` directory is a **Zarr v3** store with:

- **Grid**: 101 × 241 points @ 0.25° resolution (5–30°N, 45–105°E)
- **Depths**: 15 levels — 0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000m
- **Surface arrays** (`surface/{date}`): shape `(C, H, W)` with C channels of surface observations
- **Target profiles** (`target_profiles/{date}`): shape `(H, W, 15)` in-situ validated temperatures

Available dates: 2023-01-01 through 2023-01-07 (demo subset).

---

## Checkpoints

| File | Description |
|------|-------------|
| `checkpoints/pretrain/encoder_pretrained/` | ConvNeXt-Tiny encoder after MAE pre-training |
| `checkpoints/stage2/stage2_final/` | Encoder + EOF decoder after Stage-2 supervised fine-tuning |

---

## Environment

```yaml
# backend/environment.yml
python: "3.10"
dependencies:
  - pytorch, torchvision
  - timm (ConvNeXt backbone)
  - fastapi, uvicorn
  - numpy, scipy, pandas
  - zstandard (Zarr v3 zstd codec)
  - faiss-cpu (analog retrieval)
```

---

## Technology Stack

### Backend
- **Python 3.10** + **FastAPI** + **Uvicorn**
- **PyTorch** (ConvNeXt encoder, EOF decoder)
- **timm** (pretrained backbone registry)
- **FAISS** (efficient analog retrieval)
- **Zarr v3** (custom reader, zstd compressed)
- **scipy** (conformal calibration, diagnostics)

### Frontend
- **React 18** + **Vite**
- **Three.js** / **React Three Fiber** (3D globe + dive scenes)
- **MapLibre GL** + **react-map-gl** (2D workbench)
- **Zustand** (global session state)
- **Plotly** (validation charts)
- **Recharts** (workbench sparklines)

---

## Team

**Ocean Deja Vu** — Smart India Hackathon 2024

---

*"The ocean keeps no secrets from those who know how to listen to its surface."*
