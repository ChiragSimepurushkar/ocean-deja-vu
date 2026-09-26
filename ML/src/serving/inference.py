"""
src/serving/inference.py
------------------------
Single-day inference pipeline for the Ocean Deja Vu serving layer.

Accepts a date + optional lat/lon, loads the pre-computed surface fields
from the Zarr store, runs encoder → decoder → analog fusion → uncertainty,
and returns a structured InferenceResult.

Also implements the derived diagnostics (MLD, thermocline, D20, UHC)
from the profile output.

Designed to be called by both:
  - `src/serving/api.py` (FastAPI backend) for live requests.
  - `src/serving/cache_warmer.py` for pre-computing demo fields.
"""

from __future__ import annotations

import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from scipy.interpolate import interp1d

from src.models.encoder import SurfaceEncoder
from src.models.decoder import EOFDecoder, TorchEOFBridge
from src.models.retrieval import AnalogRetriever, AnalogResult
from src.models.uncertainty import ConformalCalibrator


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
GRID_LAT0, GRID_RES = 5.0, 0.25
GRID_LON0 = 45.0


# ──────────────────────────────────────────────────────────────────────────────
# Output container
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class InferenceResult:
    """Full output for a single (date, lat, lon) query."""
    date:    str
    lat:     float
    lon:     float
    depths:  list[int]

    # Profile
    pred:    np.ndarray       # (n_depths,) predicted temperature in °C
    lo:      np.ndarray       # (n_depths,) lower uncertainty bound
    hi:      np.ndarray       # (n_depths,) upper uncertainty bound

    # Analogs (explainability)
    analog_dates:   list[str]    # top-k nearest historical dates
    analog_weights: np.ndarray   # (k,) similarity weights

    # Diagnostics
    mld:              float       # mixed-layer depth (m)
    thermocline_depth: float      # thermocline depth (m)
    d20:              float       # 20°C isotherm depth (m)
    uhc:              float       # upper ocean heat content (GJ/m²)


SinglePointResult = InferenceResult


# ──────────────────────────────────────────────────────────────────────────────
# Diagnostics
# ──────────────────────────────────────────────────────────────────────────────

def compute_mld(profile: np.ndarray, criterion_dt: float = 0.2) -> float:
    """
    Mixed-layer depth: first depth where |T(z) - T(0)| > criterion_dt °C.

    Parameters
    ----------
    profile : (n_depths,) temperature in °C at the standard DEPTHS
    criterion_dt : temperature criterion in °C (default 0.2°C)

    Returns
    -------
    mld in metres
    """
    sst = profile[0]
    for d, t in zip(DEPTHS[1:], profile[1:]):
        if abs(t - sst) > criterion_dt:
            return float(d)
    return float(DEPTHS[-1])


def compute_thermocline_depth(profile: np.ndarray) -> float:
    """
    Thermocline depth: depth of maximum |dT/dz|.

    Uses a finite-difference gradient on the interpolated profile.
    """
    depths = np.array(DEPTHS, dtype=float)
    grad   = np.abs(np.gradient(profile, depths))
    return float(depths[np.argmax(grad)])


compute_thermocline = compute_thermocline_depth


def compute_d20(profile: np.ndarray) -> float:
    """
    Depth of the 20°C isotherm.

    Interpolates linearly between depth levels. If 20°C is not found,
    returns the deepest depth level or 0 (isothermal case).
    """
    depths = np.array(DEPTHS, dtype=float)
    try:
        # interp1d requires temp to be monotone; use the full profile
        f = interp1d(profile, depths, kind="linear",
                     bounds_error=False, fill_value=(depths[0], depths[-1]))
        return float(np.clip(f(20.0), 0, DEPTHS[-1]))
    except Exception:
        return float(DEPTHS[-1])


def compute_uhc(
    profile: np.ndarray,
    ref_temp: float = 26.0,
    max_depth: float = 300.0,
) -> float:
    """
    Upper ocean heat content above the `ref_temp` isotherm.

    UHC = ρ·Cp · ∫₀ᴴ max(T(z) - T_ref, 0) dz

    Returned in GJ/m² for readability.

    Parameters
    ----------
    profile  : (n_depths,) temperature in °C
    ref_temp : reference temperature (default 26°C for cyclone intensity proxy)
    max_depth: integration depth limit (m)
    """
    dz = np.gradient(np.array(DEPTHS, dtype=float))
    keep = np.array(DEPTHS) <= max_depth
    rho_cp = 1025.0 * 3990.0             # J·m⁻³·K⁻¹
    uhc = (np.maximum(profile - ref_temp, 0.0) * dz * rho_cp * keep).sum()
    return float(uhc * 1e-9)             # GJ/m²


# ──────────────────────────────────────────────────────────────────────────────
# Inference pipeline
# ──────────────────────────────────────────────────────────────────────────────

class InferencePipeline:
    """
    Stateful inference pipeline: holds model + retriever + calibrator in memory.

    Typical usage:
        pipe = InferencePipeline.from_checkpoints(...)
        result = pipe.run("2023-06-15", lat=15.0, lon=87.5)
    """

    def __init__(
        self,
        encoder:    SurfaceEncoder,
        decoder:    EOFDecoder,
        eof_bridge: TorchEOFBridge,
        retriever:  Optional[AnalogRetriever] = None,
        calibrator: Optional[ConformalCalibrator] = None,
        zarr_store: Optional[object] = None,   # zarr.Group from zarr_store.py
        blend_weight: float = 0.30,
        device: Optional[torch.device] = None,
    ) -> None:
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.encoder = encoder.to(self.device).eval()
        self.decoder = decoder.to(self.device).eval()
        self.eof_bridge = eof_bridge.to(self.device)
        self.retriever  = retriever
        self.calibrator = calibrator
        self.zarr_store = zarr_store
        self.blend_weight = blend_weight

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def from_checkpoints(
        cls,
        encoder_ckpt: str,
        decoder_ckpt: str,
        eof_path:     str,
        retriever_cache: str = "data/cache",
        conformal_path:  str = "data/cache/conformal.json",
        zarr_store_path: str = "data/processed/ocean_odv.zarr",
        in_channels:  int = 15,
        embed_dim:    int = 128,
        n_modes:      int = 40,
        blend_weight: float = 0.30,
    ) -> "InferencePipeline":
        with open(eof_path, "rb") as f:
            pca = pickle.load(f)

        encoder    = SurfaceEncoder(in_channels=in_channels, embed_dim=embed_dim)
        decoder    = EOFDecoder(embed_dim=embed_dim, n_modes=n_modes)
        eof_bridge = TorchEOFBridge.from_sklearn(pca)

        # Load encoder weights
        e_state = torch.load(encoder_ckpt, map_location="cpu")
        encoder.load_state_dict(e_state.get("state_dict", e_state), strict=False)

        # Load decoder weights
        d_state = torch.load(decoder_ckpt, map_location="cpu")
        decoder.load_state_dict(d_state.get("state_dict", d_state), strict=False)

        # Retriever
        retriever = None
        rpath = Path(retriever_cache) / "faiss.index"
        if rpath.exists():
            retriever = AnalogRetriever.load(retriever_cache)

        # Calibrator
        calibrator = None
        cpath = Path(conformal_path)
        if cpath.exists():
            calibrator = ConformalCalibrator.load(str(cpath))

        # Zarr store
        zarr_store = None
        try:
            import zarr
            zarr_store = zarr.open(zarr_store_path, "r")
        except Exception:
            pass

        return cls(encoder, decoder, eof_bridge, retriever, calibrator,
                   zarr_store, blend_weight)

    # ------------------------------------------------------------------
    # Single-point inference
    # ------------------------------------------------------------------

    def run(
        self,
        date: str,
        lat:  float,
        lon:  float,
    ) -> InferenceResult:
        """
        Full inference for a single (date, lat, lon) point.

        Loads the surface fields for `date`, encodes the full domain,
        extracts the pixel at (lat, lon), runs the decoder, fuses analogs,
        calibrates uncertainty, and computes diagnostics.
        """
        surface = self._load_surface(date)                        # (C, H, W)
        ilat, ilon = self._grid_indices(lat, lon)

        surface_t = torch.tensor(surface).unsqueeze(0).to(self.device)  # (1, C, H, W)

        with torch.no_grad():
            z = self.encoder(surface_t)                           # (1, D, h, w)
            pred_eof = self.decoder(z)                            # (1, M, H, W)
            # Extract the target pixel
            pred_eof_px = pred_eof[0, :, ilat // 32, ilon // 32].cpu().numpy()  # (M,)
            # Decode EOF → profile
            pred_prof = self.eof_bridge.decode(
                torch.tensor(pred_eof_px).unsqueeze(0).to(self.device)
            ).squeeze(0).cpu().numpy()  # (n_depths,)

        # Analog fusion + uncertainty
        analog_spread = np.zeros(len(DEPTHS), dtype=np.float32)
        analog_dates, analog_weights = [], np.array([])

        if self.retriever is not None:
            z_mean  = z.mean(dim=[-2, -1]).squeeze(0).cpu().numpy()  # (D,)
            z_norm  = z_mean / (np.linalg.norm(z_mean) + 1e-8)
            from datetime import date as _date
            doy = _date.fromisoformat(date).timetuple().tm_yday
            ar  = self.retriever.query(z_norm, doy)

            pred_prof    = self.retriever.fuse(pred_prof, ar, self.blend_weight)
            analog_spread  = ar.analog_spread
            analog_dates   = ar.analog_dates
            analog_weights = ar.weights

        # Conformal bands
        if self.calibrator is not None:
            lo, hi = self.calibrator.predict_bands(pred_prof, analog_spread)
        else:
            lo = pred_prof - analog_spread
            hi = pred_prof + analog_spread

        return InferenceResult(
            date=date, lat=lat, lon=lon, depths=DEPTHS,
            pred=pred_prof, lo=lo, hi=hi,
            analog_dates=analog_dates, analog_weights=analog_weights,
            mld=compute_mld(pred_prof),
            thermocline_depth=compute_thermocline_depth(pred_prof),
            d20=compute_d20(pred_prof),
            uhc=compute_uhc(pred_prof),
        )

    # ------------------------------------------------------------------
    # Field-level inference (for cache warmer)
    # ------------------------------------------------------------------

    def predict_field(
        self,
        date: str,
        var:  str = "temp_50m",
    ) -> np.ndarray:
        """
        Predict a full (H, W) field for `date` and variable name.

        var examples: 'temp_0m', 'temp_100m', 'mld', 'thermocline_depth',
                      'd20', 'uhc'

        Returns
        -------
        (H, W) float32 array in natural units (°C or m or GJ/m²)
        """
        surface = self._load_surface(date)
        surface_t = torch.tensor(surface).unsqueeze(0).to(self.device)

        with torch.no_grad():
            z = self.encoder(surface_t)                           # (1, D, h, w)
            pred_eof = self.decoder(z)                            # (1, M, H, W)

        # Decode to profiles for the full grid
        B, M, H, W = pred_eof.shape
        flat = pred_eof.permute(0, 2, 3, 1).reshape(-1, M)
        prof_flat = self.eof_bridge.decode(flat.to(self.device)).cpu().numpy()  # (H*W, 15)
        prof_grid = prof_flat.reshape(H, W, len(DEPTHS))                        # (H, W, 15)

        if var.startswith("temp_"):
            depth_m = int(var.replace("temp_", "").replace("m", ""))
            d_idx = DEPTHS.index(depth_m) if depth_m in DEPTHS else 0
            return prof_grid[:, :, d_idx].astype(np.float32)
        elif var == "mld":
            return np.array([[compute_mld(prof_grid[i, j])
                               for j in range(W)] for i in range(H)], dtype=np.float32)
        elif var == "thermocline_depth":
            return np.array([[compute_thermocline_depth(prof_grid[i, j])
                               for j in range(W)] for i in range(H)], dtype=np.float32)
        elif var == "d20":
            return np.array([[compute_d20(prof_grid[i, j])
                               for j in range(W)] for i in range(H)], dtype=np.float32)
        elif var == "uhc":
            return np.array([[compute_uhc(prof_grid[i, j])
                               for j in range(W)] for i in range(H)], dtype=np.float32)
        else:
            raise ValueError(f"Unknown variable: {var}")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _load_surface(self, date: str) -> np.ndarray:
        """Load normalised surface fields for a date from Zarr store."""
        if self.zarr_store is None:
            raise RuntimeError("No Zarr store configured in InferencePipeline.")
        return self.zarr_store[f"surface/{date}"][:]  # (C, H, W)

    @staticmethod
    def _grid_indices(lat: float, lon: float) -> tuple[int, int]:
        ilat = int(round((lat - GRID_LAT0) / GRID_RES))
        ilon = int(round((lon - GRID_LON0) / GRID_RES))
        return np.clip(ilat, 0, 99), np.clip(ilon, 0, 239)
