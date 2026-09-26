"""Empirical Orthogonal Function (EOF) / PCA decomposition module for ocean vertical profiles.

Reduces 15-level vertical temperature profiles to N_modes (typically 5 to 8 for prototype,
up to 40 for production) while preserving >95-99% of total vertical temperature variance.
Provides seamless PyTorch tensor batch decoding for loss computation in Dev 2's training loop.
"""

from __future__ import annotations
import pickle
import logging
from pathlib import Path
from typing import Optional, Tuple
import numpy as np
import torch
from sklearn.decomposition import PCA

logger = logging.getLogger(__name__)


class ProfileEOF:
    """Manages EOF decomposition and reconstruction of ocean temperature profiles."""

    def __init__(self, n_modes: int = 8, min_variance_explained: float = 0.95):
        self.n_modes = n_modes
        self.min_variance_explained = min_variance_explained
        self.pca: Optional[PCA] = None
        self.mean_profile: Optional[np.ndarray] = None
        self.components_: Optional[np.ndarray] = None
        self.is_fitted: bool = False

    def fit(self, profiles: np.ndarray, ocean_mask: Optional[np.ndarray] = None) -> ProfileEOF:
        """Fit PCA / EOF on vertical profiles.

        Args:
            profiles: Array of shape (N, n_depths) or (T, n_depths, H, W).
            ocean_mask: Optional 2D mask of shape (H, W).
        """
        # Flatten input to (M, n_depths)
        if profiles.ndim == 4:
            # (T, n_depths, H, W) -> permute to (T, H, W, n_depths) -> flatten
            T, D, H, W = profiles.shape
            prof_perm = np.transpose(profiles, (0, 2, 3, 1)).reshape(-1, D)
            if ocean_mask is not None:
                mask_flat = np.broadcast_to(ocean_mask, (T, H, W)).reshape(-1)
                prof_flat = prof_perm[mask_flat > 0]
            else:
                prof_flat = prof_perm
        elif profiles.ndim == 2:
            prof_flat = profiles
        else:
            raise ValueError(f"Expected 2D or 4D array of profiles, got ndim={profiles.ndim}")

        # Drop any row containing NaNs
        valid_rows = ~np.isnan(prof_flat).any(axis=1)
        valid_profiles = prof_flat[valid_rows]

        if len(valid_profiles) == 0:
            raise ValueError("Cannot fit EOF: zero valid profiles found (all NaNs).")

        # Bound n_modes to available features and samples
        actual_modes = min(self.n_modes, valid_profiles.shape[1], valid_profiles.shape[0])
        self.pca = PCA(n_components=actual_modes)
        self.pca.fit(valid_profiles)

        self.mean_profile = self.pca.mean_.astype(np.float32)
        self.components_ = self.pca.components_.astype(np.float32)
        self.n_modes = actual_modes
        self.is_fitted = True

        explained = self.pca.explained_variance_ratio_.cumsum()
        logger.info(
            "EOF fitted with %d modes. Total variance explained: %.2f%% (mode 1: %.2f%%, mode 2: %.2f%%)",
            self.n_modes,
            explained[-1] * 100.0,
            self.pca.explained_variance_ratio_[0] * 100.0,
            self.pca.explained_variance_ratio_[1] * 100.0 if len(explained) > 1 else 0.0,
        )
        return self

    def encode(self, profiles: np.ndarray) -> np.ndarray:
        """Transform temperature profiles into EOF coefficients.

        Handles NaN/land values gracefully by imputing with mean profile
        and zeroing out coefficients on land.

        Args:
            profiles: Shape (N, n_depths) or (..., n_depths, H, W).

        Returns:
            Coefficients: Shape (N, n_modes) or (..., n_modes, H, W).
        """
        if not self.is_fitted:
            raise RuntimeError("ProfileEOF must be fitted before encoding.")

        orig_shape = profiles.shape
        if profiles.ndim >= 3:
            # (..., D, H, W)
            *leading, D, H, W = orig_shape
            flat = np.moveaxis(profiles, -3, -1).reshape(-1, D)  # (M, D)
            nan_mask = np.isnan(flat).any(axis=1)
            flat_clean = np.where(nan_mask[:, None], self.mean_profile[None, :], flat)
            coeffs = self.pca.transform(flat_clean)              # (M, n_modes)
            coeffs[nan_mask] = 0.0
            coeffs = coeffs.reshape(*leading, H, W, self.n_modes)
            return np.moveaxis(coeffs, -1, -3)                   # (..., n_modes, H, W)
        else:
            nan_mask = np.isnan(profiles).any(axis=1)
            clean = np.where(nan_mask[:, None], self.mean_profile[None, :], profiles)
            coeffs = self.pca.transform(clean)
            coeffs[nan_mask] = 0.0
            return coeffs

    def decode(self, coeffs: np.ndarray) -> np.ndarray:
        """Reconstruct temperature profiles from EOF coefficients.

        Args:
            coeffs: Shape (N, n_modes) or (..., n_modes, H, W).

        Returns:
            Reconstructed profiles: Shape (N, n_depths) or (..., n_depths, H, W).
        """
        if not self.is_fitted:
            raise RuntimeError("ProfileEOF must be fitted before decoding.")

        orig_shape = coeffs.shape
        if coeffs.ndim >= 3:
            *leading, n_m, H, W = orig_shape
            flat = np.moveaxis(coeffs, -3, -1).reshape(-1, n_m)  # (M, n_modes)
            profs = self.pca.inverse_transform(flat)              # (M, n_depths)
            profs = profs.reshape(*leading, H, W, -1)
            return np.moveaxis(profs, -1, -3)                    # (..., n_depths, H, W)
        else:
            return self.pca.inverse_transform(coeffs)

    def decode_batch(self, coeffs_tensor: torch.Tensor) -> torch.Tensor:
        """Differentiable batch decoder for PyTorch tensors.

        Used directly by Dev 2 during decoder training for physical and steric loss computation!
        Supports shapes (B, n_modes, H, W) -> (B, n_depths, H, W)
        or (B, n_modes) -> (B, n_depths).
        """
        if not self.is_fitted:
            raise RuntimeError("ProfileEOF must be fitted before PyTorch decoding.")

        device = coeffs_tensor.device
        dtype = coeffs_tensor.dtype

        # components_: (n_modes, n_depths)
        # mean_profile: (n_depths,)
        w = torch.from_numpy(self.components_).to(device=device, dtype=dtype)
        b = torch.from_numpy(self.mean_profile).to(device=device, dtype=dtype)

        if coeffs_tensor.ndim == 4:
            # coeffs: (B, n_modes, H, W)
            # einsum: 'b c h w, c d -> b d h w'
            decoded = torch.einsum("b c h w, c d -> b d h w", coeffs_tensor, w)
            decoded = decoded + b.view(1, -1, 1, 1)
            return decoded
        elif coeffs_tensor.ndim == 2:
            # coeffs: (B, n_modes)
            return torch.matmul(coeffs_tensor, w) + b.unsqueeze(0)
        else:
            raise ValueError(f"Unsupported tensor ndim: {coeffs_tensor.ndim}")

    def save(self, filepath: str | Path):
        """Save fitted EOF model to disk."""
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "wb") as f:
            pickle.dump(self, f)
        logger.info("Saved EOF model to %s", filepath)

    @classmethod
    def load(cls, filepath: str | Path) -> ProfileEOF:
        """Load fitted EOF model from disk."""
        with open(filepath, "rb") as f:
            instance = pickle.load(f)
        return instance
