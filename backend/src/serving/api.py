"""
ML/src/serving/api.py
---------------------
Unified FastAPI backend for Ocean Deja Vu.

Merges dev3's frontend-facing endpoints with the ML pipeline backend.
Works in TWO modes:
  - MOCK mode (default): realistic synthetic ocean data for demo/dev
  - LIVE mode: loads trained checkpoints and runs real inference

Endpoints consumed by the React frontend (frontend/src/api.js):
  - GET /field/{date}?var=temp_50m
  - GET /profile/{date}?lat=15.0&lon=85.0
  - GET /diagnostics/{date}?lat=15.0&lon=85.0
  - GET /advisory/{date}?lat=15.0&lon=85.0
  - GET /transect/{date}?lat=15.0&var=temp
  - GET /health
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from scipy.interpolate import interp1d

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ocean Deja Vu API",
    description="Subsurface Ocean Temperature Reconstruction & Analog Retrieval Engine",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────────────────────
# Constants — match the real dataset grid (101 × 241)
# ──────────────────────────────────────────────────────────────────────────────
NLAT, NLON = 101, 241
DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
LATS = np.linspace(5.0, 30.0, NLAT, dtype=np.float32)
LONS = np.linspace(45.0, 105.0, NLON, dtype=np.float32)

# Mode flag — set to True after training a model & placing checkpoints
USE_LIVE_MODEL = os.environ.get("ODV_LIVE_MODEL", "0") == "1"

# Live pipeline (loaded on startup if USE_LIVE_MODEL)
_pipeline = None


# ──────────────────────────────────────────────────────────────────────────────
# Diagnostic helpers (standalone, no model needed)
# ──────────────────────────────────────────────────────────────────────────────

def compute_mld(profile: np.ndarray, criterion_dt: float = 0.2) -> float:
    """Mixed-layer depth: first depth where |T(z) - T(0)| > criterion_dt °C."""
    sst = profile[0]
    for d, t in zip(DEPTHS[1:], profile[1:]):
        if abs(t - sst) > criterion_dt:
            return float(d)
    return float(DEPTHS[-1])


def compute_thermocline(profile: np.ndarray) -> float:
    """Thermocline depth: depth of maximum |dT/dz|."""
    depths = np.array(DEPTHS, dtype=float)
    grad = np.abs(np.gradient(profile, depths))
    return float(depths[np.argmax(grad)])


def compute_d20(profile: np.ndarray) -> float:
    """Depth of the 20°C isotherm."""
    depths = np.array(DEPTHS, dtype=float)
    try:
        f = interp1d(profile, depths, kind="linear",
                     bounds_error=False, fill_value=(depths[0], depths[-1]))
        return float(np.clip(f(20.0), 0, DEPTHS[-1]))
    except Exception:
        return float(DEPTHS[-1])


def compute_uhc(profile: np.ndarray, ref_temp: float = 26.0,
                max_depth: float = 300.0) -> float:
    """Upper ocean heat content above ref_temp isotherm (kJ/cm²)."""
    dz = np.gradient(np.array(DEPTHS, dtype=float))
    keep = np.array(DEPTHS) <= max_depth
    rho_cp = 1025.0 * 3990.0
    uhc = (np.maximum(profile - ref_temp, 0.0) * dz * rho_cp * keep).sum()
    return float(uhc * 1e-9)   # GJ/m² → ~kJ/cm² scale


# ──────────────────────────────────────────────────────────────────────────────
# Mock data generators (used before model is trained)
# ──────────────────────────────────────────────────────────────────────────────

def load_cached_or_mock_field(date: str, var: str) -> np.ndarray:
    """Alias used by Streamlit demo pages. Checks disk cache, then generates mock."""
    base_dir = Path(__file__).resolve().parent.parent.parent
    cache_path = base_dir / "data/cache/precomputed" / f"{date}_{var}.npy"
    if cache_path.exists():
        return np.load(cache_path)
    return generate_mock_field(var, doy=_doy_from_date(date))


def _doy_from_date(date: str) -> int:
    """Extract day-of-year from YYYY-MM-DD string."""
    try:
        import datetime
        dt = datetime.date.fromisoformat(date)
        return dt.timetuple().tm_yday
    except Exception:
        return 180


def generate_mock_field(var: str, doy: int = 180) -> np.ndarray:
    """Creates a smooth, realistic oceanographic field for demos."""
    lat_mesh, lon_mesh = np.meshgrid(LATS, LONS, indexing="ij")

    # Base spatial pattern: warmer equatorial, cooler north
    base = 29.0 - (lat_mesh - 5.0) * 0.25 + np.sin(lon_mesh / 10.0) * 0.5
    seasonal = np.sin(2 * np.pi * doy / 365.25) * 1.5

    if var.startswith("temp_"):
        depth = float(var.split("_")[1].replace("m", ""))
        decay = np.exp(-depth / 250.0)
        field = (base + seasonal - 4.0) * decay + 4.0
    elif var == "mld":
        field = 25.0 + 15.0 * np.cos(np.deg2rad(lat_mesh)) + \
                np.random.RandomState(doy).randn(NLAT, NLON) * 2.0
    elif var == "d20":
        field = 90.0 + 35.0 * np.sin(lon_mesh / 15.0) + (lat_mesh - 15.0) * 1.5
    elif var == "uhc":
        field = 85.0 + 20.0 * np.cos(lat_mesh / 10.0)
    elif var == "thermocline_depth":
        field = 80.0 + 25.0 * np.sin(lat_mesh / 12.0)
    else:
        field = base + seasonal

    # Simple land mask (Indian subcontinent approximation)
    mask = np.ones((NLAT, NLON), dtype=bool)
    mask[int(NLAT * 0.65):, int(NLON * 0.37):int(NLON * 0.62)] = False
    field = np.where(mask, field, np.nan).astype(np.float32)
    return field


def generate_mock_profile(lat: float, lon: float, doy: int = 180) -> dict:
    """Generate a realistic vertical temperature profile."""
    depths_arr = np.array(DEPTHS, dtype=np.float32)
    sst_base = 29.5 if lon >= 77.0 else 28.2
    seasonal = np.sin(2 * np.pi * doy / 365.25) * 1.2
    sst = sst_base + seasonal - (lat - 15.0) * 0.08

    temp_pred = (sst - 4.2) * np.exp(-depths_arr / 240.0) + 4.2
    # Add reproducible fine-structure
    rng = np.random.RandomState(int(lat * 10 + lon))
    noise = rng.randn(len(DEPTHS)) * 0.15
    temp_pred = temp_pred + noise

    # Conformal uncertainty bands (wider in thermocline)
    uncertainty = np.array([
        0.35, 0.35, 0.38, 0.45, 0.52, 0.68, 0.88, 0.94,
        0.85, 0.70, 0.55, 0.40, 0.28, 0.22, 0.18
    ], dtype=np.float32)

    analog_dates = ["2018-05-14", "2015-06-02", "2020-05-22", "2016-06-09", "2019-05-29"]
    analog_weights = [0.35, 0.25, 0.18, 0.12, 0.10]

    return {
        "depths": DEPTHS,
        "temp_pred": temp_pred.tolist(),
        "temp_lo": (temp_pred - uncertainty).tolist(),
        "temp_hi": (temp_pred + uncertainty).tolist(),
        "analog_dates": analog_dates,
        "analog_weights": analog_weights,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Startup: optionally load the real model
# ──────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
def load_model():
    global _pipeline
    if not USE_LIVE_MODEL:
        logger.info("Running in MOCK mode (no trained model). Set ODV_LIVE_MODEL=1 to use real model.")
        return
    try:
        from src.serving.inference import InferencePipeline
        # Resolve absolute paths based on this file's location (backend/src/serving/api.py)
        base_dir = Path(__file__).resolve().parent.parent.parent
        
        _pipeline = InferencePipeline.from_checkpoints(
            encoder_ckpt=str(base_dir / "checkpoints/pretrain/encoder_pretrained.pt"),
            decoder_ckpt=str(base_dir / "checkpoints/stage2/stage2_final.pt"),
            eof_path=str(base_dir / "data/processed/eof/eof_model.pkl"),
            zarr_store_path=os.environ.get("ODV_ZARR_STORE", "../Dataset"),
        )
        logger.info("Loaded live InferencePipeline from checkpoints.")
    except Exception as e:
        logger.warning(f"Failed to load live model, falling back to mock: {e}")
        _pipeline = None


# ──────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "mode": "live" if (_pipeline is not None) else "mock",
        "service": "Ocean Deja Vu Subsurface AI",
        "domain": "North Indian Ocean (5-30°N, 45-105°E)",
        "resolution": "0.25° daily",
        "grid": f"{NLAT}×{NLON}",
        "depth_levels": len(DEPTHS),
    }


@app.get("/field/{date}")
async def get_field(
    date: str,
    var: str = Query("temp_0m", description="Variable: temp_0m..temp_1000m, mld, d20, uhc"),
    fmt: str = Query("json", description="Response format"),
) -> Dict[str, Any]:
    """Return a 101×241 field for the given date and variable."""
    doy = _doy_from_date(date)

    if _pipeline is not None:
        try:
            field = _pipeline.predict_field(date, var)
        except Exception as e:
            logger.warning(f"Live field failed: {e}, falling back to mock")
            field = generate_mock_field(var, doy=doy)
    else:
        field = generate_mock_field(var, doy=doy)

    return {
        "lat": LATS.tolist(),
        "lon": LONS.tolist(),
        "data": [[None if np.isnan(v) else round(float(v), 2) for v in row]
                 for row in field],
    }


@app.get("/profile/{date}")
async def get_profile(
    date: str,
    lat: float = Query(..., ge=5.0, le=30.0),
    lon: float = Query(..., ge=45.0, le=105.0),
) -> Dict[str, Any]:
    """Return vertical temperature profile with uncertainty & analog dates."""
    doy = _doy_from_date(date)

    if _pipeline is not None:
        try:
            result = _pipeline.run(date, lat, lon)
            return {
                "depths": result.depths,
                "temp_pred": [round(float(v), 2) for v in result.pred],
                "temp_lo":   [round(float(v), 2) for v in result.lo],
                "temp_hi":   [round(float(v), 2) for v in result.hi],
                "analog_dates": result.analog_dates,
                "analog_weights": result.analog_weights.tolist()
                    if hasattr(result.analog_weights, 'tolist') else result.analog_weights,
            }
        except Exception as e:
            logger.warning(f"Live profile failed: {e}, falling back to mock")

    return generate_mock_profile(lat, lon, doy)


@app.get("/diagnostics/{date}")
async def get_diagnostics(
    date: str,
    lat: float = Query(..., ge=5.0, le=30.0),
    lon: float = Query(..., ge=45.0, le=105.0),
) -> Dict[str, Any]:
    """MLD, thermocline depth, D20, upper ocean heat content."""
    profile_data = await get_profile(date, lat=lat, lon=lon)
    prof = np.array(profile_data["temp_pred"], dtype=np.float32)

    return {
        "mld": round(compute_mld(prof), 1),
        "thermocline_depth": round(compute_thermocline(prof), 1),
        "d20": round(compute_d20(prof), 1),
        "uhc": round(compute_uhc(prof), 2),
    }


@app.get("/transect/{date}")
async def get_transect(
    date: str,
    lat: float = Query(None, description="Lat for zonal (E-W) transect"),
    lon: float = Query(None, description="Lon for meridional (N-S) transect"),
    var: str = Query("temp", description="Variable to slice"),
) -> Dict[str, Any]:
    """Return a 2D vertical slice (depth × spatial) for the frontend heatmap."""
    doy = _doy_from_date(date)
    n_points = 50

    if lat is not None:
        # Zonal transect: fixed lat, sweep longitude
        points = np.linspace(45.0, 105.0, n_points)
        axis = "lon"
        lats_query = np.full(n_points, lat)
        lons_query = points
    else:
        # Meridional transect: fixed lon, sweep latitude
        lon_val = lon if lon is not None else 85.0
        points = np.linspace(5.0, 30.0, n_points)
        axis = "lat"
        lats_query = points
        lons_query = np.full(n_points, lon_val)

    # Build the vertical slice
    slice_data = np.zeros((len(DEPTHS), n_points), dtype=np.float32)
    depths_arr = np.array(DEPTHS, dtype=np.float32)

    for j in range(n_points):
        sst_base = 29.5 if lons_query[j] >= 77.0 else 28.2
        seasonal = np.sin(2 * np.pi * doy / 365.25) * 1.2
        sst = sst_base + seasonal - (lats_query[j] - 15.0) * 0.08
        profile = (sst - 4.2) * np.exp(-depths_arr / 240.0) + 4.2
        slice_data[:, j] = profile

    return {
        "depths": DEPTHS,
        axis: points.tolist(),
        "data": [[round(float(v), 2) for v in row] for row in slice_data],
    }


@app.get("/advisory/{date}")
async def get_advisory(
    date: str,
    lat: float = Query(15.0, ge=5.0, le=30.0),
    lon: float = Query(85.0, ge=45.0, le=105.0),
) -> Dict[str, Any]:
    """Advisory system: marine heatwave alerts and anomaly detection."""
    doy = _doy_from_date(date)

    # Generate SST at this location
    seasonal = np.sin(2 * np.pi * doy / 365.25) * 1.2
    sst_base = 29.5 if lon >= 77.0 else 28.2
    local_sst = sst_base + seasonal - (lat - 15.0) * 0.08

    alerts = []
    if local_sst > 29.0:
        alerts.append(
            f"⚠️ Marine Heatwave Warning: Elevated SST ({local_sst:.1f}°C) "
            f"detected near {lat:.1f}°N, {lon:.1f}°E. "
            f"Subsurface thermal energy may intensify cyclogenesis."
        )
    if lat < 10.0 and lon < 60.0:
        alerts.append(
            "🌀 Coastal Upwelling Active: Significant thermocline shoaling "
            "detected along Somali/Western Arabian Sea coast."
        )

    return {
        "summary": (
            f"Ocean conditions at {lat:.1f}°N, {lon:.1f}°E: "
            f"surface temperature ~{local_sst:.1f}°C. "
            f"{'Elevated thermal stress detected.' if local_sst > 29.0 else 'Conditions within normal range.'}"
        ),
        "alerts": alerts,
        "recommendation": (
            "Monitor thermocline depth for potential acoustic or biological shifts."
        ),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
