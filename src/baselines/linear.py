"""Linear Regression / Ridge Baseline for subsurface temperature reconstruction.

Fits a Ridge regression model mapping surface channels (SST, SSS, SSH, currents,
winds, derived gradients, coordinates) to EOF vertical mode coefficients.
Reconstructed back into 15 depth levels via ProfileEOF.
"""

from __future__ import annotations
import logging
from typing import Optional
import numpy as np
from sklearn.linear_model import Ridge
from src.data.zarr_store import ZarrOceanStore
from src.data.eof import ProfileEOF

logger = logging.getLogger(__name__)


class LinearBaseline:
    """Multivariate Ridge regression mapping surface channels to subsurface profiles."""

    def __init__(self, alpha: float = 1.0, eof_model: Optional[ProfileEOF] = None):
        self.alpha = alpha
        self.eof_model = eof_model
        self.model = Ridge(alpha=alpha)
        self.is_fitted: bool = False
        self.mask: Optional[np.ndarray] = None

    def fit(
        self,
        zarr_store: ZarrOceanStore,
        eof_model: Optional[ProfileEOF] = None,
        train_split: str = "train",
    ) -> LinearBaseline:
        """Fit Ridge regression on training split."""
        if eof_model is not None:
            self.eof_model = eof_model
        if self.eof_model is None:
            raise ValueError("ProfileEOF model is required for LinearBaseline.")

        dates = zarr_store.get_dates(train_split)
        self.mask = zarr_store.get_mask()  # (H, W)
        ocean_idx = self.mask > 0

        X_list = []
        Y_list = []

        for d_str in dates:
            day_data = zarr_store.get_day(d_str)
            surface = day_data["surface"]        # (15, H, W)
            target_eof = day_data["target_eof"]  # (n_modes, H, W)

            # Flatten ocean pixels
            # X: (N_ocean, 15)
            x_day = surface[:, ocean_idx].T
            # Y: (N_ocean, n_modes)
            y_day = target_eof[:, ocean_idx].T

            # Drop any NaNs
            valid = ~np.isnan(x_day).any(axis=1) & ~np.isnan(y_day).any(axis=1)
            X_list.append(x_day[valid])
            Y_list.append(y_day[valid])

        X = np.vstack(X_list)
        Y = np.vstack(Y_list)

        logger.info("Fitting Ridge regression on %d pixel samples (in_dim=%d, out_dim=%d)...", len(X), X.shape[1], Y.shape[1])
        self.model.fit(X, Y)
        self.is_fitted = True
        return self

    def predict_field(self, surface_array: np.ndarray) -> np.ndarray:
        """Predict (15, H, W) profile field from (15, H, W) normalized surface channels."""
        if not self.is_fitted:
            raise RuntimeError("LinearBaseline must be fitted before predicting.")

        C, H, W = surface_array.shape
        ocean_idx = self.mask > 0 if self.mask is not None else np.ones((H, W), dtype=bool)

        x_ocean = surface_array[:, ocean_idx].T  # (N_ocean, C)
        x_clean = np.nan_to_num(x_ocean, nan=0.0)

        # Predict EOF coefficients: (N_ocean, n_modes)
        pred_eof_ocean = self.model.predict(x_clean)

        # Reshape to (n_modes, H, W)
        n_modes = self.eof_model.n_modes
        pred_eof_grid = np.zeros((n_modes, H, W), dtype=np.float32)
        pred_eof_grid[:, ocean_idx] = pred_eof_ocean.T

        # Decode EOF coefficients to (15, H, W) temperature profiles
        pred_profiles = self.eof_model.decode(pred_eof_grid)
        if self.mask is not None:
            pred_profiles[:, self.mask == 0] = np.nan

        return pred_profiles.astype(np.float32)
