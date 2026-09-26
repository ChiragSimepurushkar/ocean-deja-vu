"""
ML/src/data/eof.py
------------------
Empirical Orthogonal Function (EOF / PCA) decomposition for subsurface
temperature profiles in the North Indian Ocean.
Target: 15 standard depths (0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000 m).
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Optional, Union

import numpy as np
from sklearn.decomposition import PCA

logger = logging.getLogger(__name__)


class ProfileEOF:
    """
    Fits and applies PCA decomposition to subsurface vertical profiles.
    Maps: (N, 15) -> (N, n_modes) and back.
    """

    def __init__(self, n_modes: int = 15):
        self.n_modes = n_modes
        self.pca: Optional[PCA] = None

    def fit(self, profiles: np.ndarray) -> "ProfileEOF":
        """
        Fits PCA on vertical profiles of shape (N_samples, 15).
        """
        assert profiles.ndim == 2, f"Expected (N, 15), got {profiles.shape}"
        n_features = profiles.shape[1]
        actual_modes = min(self.n_modes, n_features)

        self.pca = PCA(n_components=actual_modes)
        self.pca.fit(profiles)

        cum_var = np.cumsum(self.pca.explained_variance_ratio_)
        logger.info(
            f"Fitted EOF with {actual_modes} modes. "
            f"Cumulative variance explained: {cum_var[-1] * 100:.2f}%"
        )
        return self

    def encode(self, profiles: np.ndarray) -> np.ndarray:
        """
        Projects profiles into EOF coefficient space.
        Input: (..., 15)
        Output: (..., n_modes)
        """
        if self.pca is None:
            raise RuntimeError("ProfileEOF must be fitted before encoding.")
        shape = profiles.shape
        flat = profiles.reshape(-1, shape[-1])
        coeffs = self.pca.transform(flat)
        return coeffs.reshape(shape[:-1] + (self.pca.n_components_,)).astype(np.float32)

    def decode(self, coeffs: np.ndarray) -> np.ndarray:
        """
        Reconstructs physical temperature profiles (°C) from EOF coefficients.
        Input: (..., n_modes)
        Output: (..., 15)
        """
        if self.pca is None:
            raise RuntimeError("ProfileEOF must be fitted before decoding.")
        shape = coeffs.shape
        flat = coeffs.reshape(-1, shape[-1])
        profs = self.pca.inverse_transform(flat)
        return profs.reshape(shape[:-1] + (self.pca.n_features_in_,)).astype(np.float32)

    def to_torch_bridge(self):
        """Constructs a TorchEOFBridge instance for in-graph torch computation."""
        from src.models.decoder import TorchEOFBridge
        if self.pca is None:
            raise RuntimeError("ProfileEOF must be fitted first.")
        return TorchEOFBridge.from_sklearn(self.pca)

    def save(self, filepath: Union[str, Path]):
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)
        logger.info(f"Saved ProfileEOF to {path}")

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> "ProfileEOF":
        with open(filepath, "rb") as f:
            obj = pickle.load(f)
        return obj
