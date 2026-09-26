"""Climatology Baseline for subsurface ocean temperature reconstruction.

Predicts the historical mean profile for each pixel and day-of-year
based on the GLORYS reanalysis training split.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from src.data.zarr_store import ZarrOceanStore

logger = logging.getLogger(__name__)


class ClimatologyBaseline:
    """Predicts historical mean GLORYS profile per pixel."""

    def __init__(self):
        self.mean_field: Optional[np.ndarray] = None  # (15, H, W)
        self.doy_climatology: Dict[int, np.ndarray] = {}  # doy -> (15, H, W)
        self.is_fitted: bool = False

    def fit(self, zarr_store: ZarrOceanStore, train_split: str = "train") -> ClimatologyBaseline:
        """Fit climatology by averaging profiles across the training split."""
        dates = zarr_store.get_dates(train_split)
        if len(dates) == 0:
            raise ValueError(f"No dates found in split '{train_split}'")

        profiles = []
        doy_buckets: Dict[int, List[np.ndarray]] = {}

        for d_str in dates:
            day_data = zarr_store.get_day(d_str)
            p = day_data["target_profiles"]  # (15, H, W)
            profiles.append(p)

            doy = pd.to_datetime(d_str).dayofyear
            if doy not in doy_buckets:
                doy_buckets[doy] = []
            doy_buckets[doy].append(p)

        # Overall temporal mean profile per pixel
        all_profs = np.stack(profiles, axis=0)  # (T, 15, H, W)
        self.mean_field = np.nanmean(all_profs, axis=0).astype(np.float32)

        # DOY-specific averages if multiple years, else fallback to mean_field
        for doy, prof_list in doy_buckets.items():
            self.doy_climatology[doy] = np.nanmean(np.stack(prof_list, axis=0), axis=0).astype(np.float32)

        self.is_fitted = True
        logger.info("ClimatologyBaseline fitted on %d days.", len(dates))
        return self

    def predict_field(self, date_str: str) -> np.ndarray:
        """Predict the full (15, H, W) field for a given date."""
        if not self.is_fitted:
            raise RuntimeError("ClimatologyBaseline must be fitted before prediction.")

        doy = pd.to_datetime(date_str).dayofyear
        if doy in self.doy_climatology:
            return self.doy_climatology[doy].copy()
        return self.mean_field.copy()

    def predict_profile(self, date_str: str, lat_idx: int, lon_idx: int) -> np.ndarray:
        """Predict a single 15-level vertical temperature profile."""
        field = self.predict_field(date_str)
        return field[:, lat_idx, lon_idx]
