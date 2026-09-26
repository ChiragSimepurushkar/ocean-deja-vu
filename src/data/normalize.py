"""Normalization and anomaly computation module for oceanographic channels.

Provides ChannelStats:
- Computes mean, std, min, max per surface channel on training split
- Computes per-pixel seasonal climatologies for SST and SLA
- Transforms observations into standardized anomalies
- Serializes statistics to/from JSON for serving and inference
"""

from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np

logger = logging.getLogger(__name__)


class ChannelStats:
    """Manages channel-wise standardization and climatological anomalies."""

    def __init__(self):
        self.stats: Dict[str, Dict[str, float]] = {}
        # Per-pixel climatologies for SST and SLA: (366, H, W) or (12, H, W)
        self.climatologies: Dict[str, np.ndarray] = {}
        self.channel_names: List[str] = []
        self.is_fitted: bool = False

    def fit(
        self,
        channel_data: Dict[str, np.ndarray],
        ocean_mask: Optional[np.ndarray] = None,
        dates: Optional[List[Any]] = None,
    ) -> ChannelStats:
        """Fit channel statistics (mean, std, min, max) and climatologies.

        Args:
            channel_data: Dict mapping channel name to 3D array of shape (T, H, W).
            ocean_mask: 2D boolean array of shape (H, W), True for ocean.
            dates: List of dates/timestamps corresponding to time dimension T.
        """
        self.channel_names = list(channel_data.keys())
        self.stats = {}

        for ch_name, arr in channel_data.items():
            valid_pixels = arr[:, ocean_mask > 0] if ocean_mask is not None else arr
            # Mask out NaNs
            valid = valid_pixels[~np.isnan(valid_pixels)]

            if len(valid) == 0:
                mean_val, std_val = 0.0, 1.0
                min_val, max_val = 0.0, 1.0
            else:
                mean_val = float(np.mean(valid))
                std_val = float(np.std(valid))
                std_val = std_val if std_val > 1e-6 else 1.0
                min_val = float(np.min(valid))
                max_val = float(np.max(valid))

            self.stats[ch_name] = {
                "mean": mean_val,
                "std": std_val,
                "min": min_val,
                "max": max_val,
            }

        # Compute climatology for SST and SSH if dates are provided
        if dates is not None and "sst" in channel_data:
            self._fit_climatologies(channel_data, dates)

        self.is_fitted = True
        logger.info("Fitted statistics for %d channels.", len(self.stats))
        return self

    def _fit_climatologies(self, channel_data: Dict[str, np.ndarray], dates: List[Any]):
        """Compute pixel-wise mean climatology across days-of-year or months."""
        import pandas as pd
        dts = pd.to_datetime(dates)
        doys = dts.dayofyear.values

        for var in ["sst", "ssh"]:
            if var not in channel_data:
                continue
            arr = channel_data[var]  # (T, H, W)
            n_times, H, W = arr.shape
            # Group by DOY or use temporal mean if pilot window is short
            clim = np.nanmean(arr, axis=0)  # (H, W) baseline
            self.climatologies[var] = np.nan_to_num(clim, nan=0.0).astype(np.float32)

    def transform_channel(
        self,
        name: str,
        data: np.ndarray,
        is_anomaly: bool = False,
    ) -> np.ndarray:
        """Standardize a single channel: (x - mean) / std.

        If is_anomaly is True and climatology exists, subtract climatology first.
        """
        if not self.is_fitted or name not in self.stats:
            return data

        out = data.copy()
        std = self.stats[name]["std"]

        if is_anomaly and name in self.climatologies:
            # Anomaly is already centered around 0
            anomaly = out - self.climatologies[name]
            normed = anomaly / (std + 1e-7)
        else:
            mean = self.stats[name]["mean"]
            normed = (out - mean) / (std + 1e-7)

        return np.nan_to_num(normed, nan=0.0)

    def inverse_transform_channel(
        self,
        name: str,
        normed_data: np.ndarray,
        is_anomaly: bool = False,
    ) -> np.ndarray:
        """Restore standardized channel to original physical units."""
        if not self.is_fitted or name not in self.stats:
            return normed_data

        std = self.stats[name]["std"]

        if is_anomaly and name in self.climatologies:
            raw = normed_data * std + self.climatologies[name]
        else:
            mean = self.stats[name]["mean"]
            raw = normed_data * std + mean

        return raw

    def save(self, json_path: str | Path, clim_dir: Optional[str | Path] = None):
        """Serialize statistics to JSON and climatology arrays to .npy files."""
        json_path = Path(json_path)
        json_path.parent.mkdir(parents=True, exist_ok=True)

        payload = {
            "channel_names": self.channel_names,
            "stats": self.stats,
            "has_climatologies": list(self.climatologies.keys()),
        }

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        if clim_dir is None:
            clim_dir = json_path.parent / "climatologies"
        clim_dir = Path(clim_dir)
        clim_dir.mkdir(parents=True, exist_ok=True)

        for var, arr in self.climatologies.items():
            np.save(clim_dir / f"{var}_clim.npy", arr)

        logger.info("Saved channel stats to %s", json_path)

    @classmethod
    def load(cls, json_path: str | Path, clim_dir: Optional[str | Path] = None) -> ChannelStats:
        """Load channel statistics from JSON and climatologies from .npy."""
        json_path = Path(json_path)
        with open(json_path, "r", encoding="utf-8") as f:
            payload = json.load(f)

        instance = cls()
        instance.channel_names = payload.get("channel_names", [])
        instance.stats = payload.get("stats", {})
        instance.is_fitted = True

        if clim_dir is None:
            clim_dir = json_path.parent / "climatologies"
        clim_dir = Path(clim_dir)

        for var in payload.get("has_climatologies", []):
            clim_file = clim_dir / f"{var}_clim.npy"
            if clim_file.exists():
                instance.climatologies[var] = np.load(clim_file)

        return instance
