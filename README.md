# 🌊 Ocean Deja Vu — Subsurface Ocean Temperature Reconstruction

> **Hackathon Prototype v1 — Team Split: Dev 1 (Data & Pipeline Engineer)**

Ocean Deja Vu reconstructs 3D subsurface vertical ocean temperature profiles (0–1000m) from satellite surface observations (SST, SSS, SSH/SLA, OSCAR surface currents, CCMP winds) using self-supervised spatial encoders, EOF vertical mode decomposition, and analog retrieval with conformal uncertainty estimation.

---

## 🛠️ Dev 1 Ownership & Deliverables

As defined in the project implementation plan, **Dev 1 (Data & Pipeline Engineer)** owns:
- **Section 3: Data Sources & Access Points** (OSTIA SST, SMAP/SMOS SSS, DUACS SSH, OSCAR currents, CCMP winds, GLORYS12 3D targets, ARGO in-situ validation).
- **Section 4.1: Preprocessing & Pilot Window** (Small pilot window: Bay of Bengal 5–25°N, 80–100°E; offline synthetic pilot generator for instant hackathon execution).
- **Section 4.2: Regridding & Alignment** (0.25° grid, xESMF & SciPy fallback, land-sea mask, calendar alignment, missing-data boolean channel).
- **Section 4.5: Feature Engineering** (Wind stress curl, ocean current divergence, SST spatial gradients, harmonic spatiotemporal coordinates).
- **Section 4.6: EOF Decomposition & Normalization** (Profile EOF compression, explained variance validation, channel statistics).
- **Section 4.8: Engineering Practices & Scaffolding** (Zarr store, PyTorch `OceanDataset`, configs, fixed seeds, baselines, unit tests, Makefile).

---

## 📊 Pipeline Architecture & Data Contract

### 1. Unified 15 Surface Feature Channels (`(15, H, W)`)

| Channel Index | Channel Name | Source | Description & Unit |
| :---: | :--- | :--- | :--- |
| **0** | `sst` | OSTIA L4 | Sea Surface Temperature (°C, anomaly standardized) |
| **1** | `sss` | SMAP/SMOS | Sea Surface Salinity (PSU, standardized) |
| **2** | `ssh` | DUACS | Sea Level Anomaly (m, standardized) |
| **3** | `uo` | OSCAR L4 | Eastward surface current velocity (m/s) |
| **4** | `vo` | OSCAR L4 | Northward surface current velocity (m/s) |
| **5** | `uw` | CCMP / ERA5 | Eastward 10m surface wind (m/s) |
| **6** | `vw` | CCMP / ERA5 | Northward 10m surface wind (m/s) |
| **7** | `curl_tau` | Derived | Wind stress curl $\partial\tau_y/\partial x - \partial\tau_x/\partial y$ (N/m³) |
| **8** | `div_uv` | Derived | Surface current divergence $\partial u_o/\partial x + \partial v_o/\partial y$ (s⁻¹) |
| **9** | `sst_grad_x` | Derived | Zonal SST gradient $\partial(SST)/\partial x$ (°C/m) |
| **10** | `sst_grad_y` | Derived | Meridional SST gradient $\partial(SST)/\partial y$ (°C/m) |
| **11** | `lat_sin` | Coordinate | $\sin(\text{latitude})$ |
| **12** | `lon_cos` | Coordinate | $\cos(\text{longitude})$ |
| **13** | `doy_sin` | Coordinate | $\sin(2\pi \cdot \text{DOY} / 365.25)$ |
| **14** | `doy_cos` | Coordinate | $\cos(2\pi \cdot \text{DOY} / 365.25)$ |

### 2. Vertical Target Profiles (`(15, H, W)`)

15 standard oceanographic depth levels:
`[0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000] meters`

### 3. EOF Compressed Targets (`(N_modes, H, W)`)

- Number of EOF modes: **8** (captures **100%** of vertical temperature variance in the pilot domain; reconstruction RMSE = `0.0000 °C`).
- Differentiable PyTorch batch decoder `ProfileEOF.decode_batch()` provided for Dev 2's loss calculations.

---

## 📈 Baseline Models & Benchmarks (Section 5)

Evaluated on the held-out test split:

| Model | Overall Mean RMSE | RMSE @ 0m (Surface) | RMSE @ 100m (Thermocline) | RMSE @ 500m (Abyss) | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Climatology Baseline** | `0.6733 °C` | `0.6168 °C` | `1.2256 °C` | `0.0995 °C` | Pixel-wise temporal mean |
| **Persistence Baseline** | `0.0856 °C` | `0.0827 °C` | `0.1450 °C` | `0.0141 °C` | Yesterday's profile |
| **Linear (Ridge) Baseline** | `0.2312 °C` | `0.1697 °C` | `0.4397 °C` | `0.0420 °C` | Surface features $\to$ EOF $\to$ Depths |
| **Plain U-Net Baseline** | `20.6983 °C` | `29.1005 °C` | `22.9346 °C` | `10.1344 °C` | Direct 2D U-Net (5 epochs unnormalized reference) |

*Full metrics serialized to `data/cache/baseline_metrics.json`.*

---

## 🚀 Quickstart & Commands

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the complete data pipeline (Downloads/Simulates -> Regrids -> Features -> EOF -> Zarr)
make data

# 3. Run baseline models benchmark
make baselines

# 4. Run test suite
make test
```

---

## 🤝 Clean Handoff Contract for Dev 2 & Dev 3

### For Dev 2 (ML / Modeling):
Import the PyTorch dataset directly without worrying about preprocessing:
```python
from src.data.zarr_store import OceanDataset
from src.data.eof import ProfileEOF

# Load ready-to-train PyTorch Dataset
train_dataset = OceanDataset("data/processed/ocean_odv.zarr", split="train")
surface, target_eof, mask, target_profiles, sla = train_dataset[0]

# surface:         torch.Size([15, 81, 81])
# target_eof:      torch.Size([8, 81, 81])
# mask:            torch.Size([81, 81])
# target_profiles: torch.Size([15, 81, 81])
# sla:             torch.Size([81, 81])

# Differentiable PyTorch EOF decoder for loss calculation:
eof_model = ProfileEOF.load("data/cache/eof_model.pkl")
pred_profiles = eof_model.decode_batch(pred_eof_tensor) # (B, 15, H, W)
```

### For Dev 3 (Backend API & Frontend):
Access fields directly via `ZarrOceanStore`:
```python
from src.data.zarr_store import ZarrOceanStore

store = ZarrOceanStore("data/processed/ocean_odv.zarr", mode="r")
day_data = store.get_day("2023-05-01")
lats = store.get_lats()
lons = store.get_lons()
depths = store.get_depths()
mask = store.get_mask()
```
