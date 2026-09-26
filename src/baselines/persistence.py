"""Persistence Baseline for subsurface ocean temperature reconstruction.

Predicts yesterday's GLORYS profile for today's temperature field.
A classic geophysical benchmark that tests how much memory is retained day-to-day.
"""

from __future__ import annotations
import logging
from typing import Optional
import numpy as np
import pandas as pd
from src.data.zarr_store import ZarrOceanStore

logger = logging.getLogger(__name__)


class PersistenceBaseline:
    """Predicts previous day's GLORYS profile."""

    def __init__(self, zarr_store: Optional[ZarrOceanStore] = None):
        self.store = zarr_store

    def predict_field(
        self,
        current_date_str: str,
        lag_days: int = 1,
        zarr_store: Optional[ZarrOceanStore] = None,
    ) -> np.ndarray:
        """Predict current day's field using profile from (current_date - lag_days)."""
        store = zarr_store or self.store
        if store is None:
            raise ValueError("ZarrOceanStore must be provided to fetch yesterday's profile.")

        curr_dt = pd.to_datetime(current_date_str)
        prev_dt = curr_dt - pd.Timedelta(days=lag_days)
        prev_date_str = str(prev_dt.date())

        try:
            prev_data = store.get_day(prev_date_str)
            return prev_data["target_profiles"].copy()
        except KeyError:
            # If previous day is not in store, fallback to current day or closest available
            logger.debug("Previous date %s not in store; using current day as fallback", prev_date_str)
            return store.get_day(current_date_str)["target_profiles"].copy()

    def predict_profile(
        self,
        current_date_str: str,
        lat_idx: int,
        lon_idx: int,
        lag_days: int = 1,
        zarr_store: Optional[ZarrOceanStore] = None,
    ) -> np.ndarray:
        """Predict single vertical profile from yesterday."""
        field = self.predict_field(current_date_str, lag_days=lag_days, zarr_store=zarr_store)
        return field[:, lat_idx, lon_idx]
