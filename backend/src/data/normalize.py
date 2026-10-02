"""
ML/src/data/normalize.py
------------------------
Per-channel standardization and anomaly computation for the Ocean Deja Vu pipeline.
Computes streaming channel-wise mean and standard deviation over ocean pixels,
and supports anomaly transformation relative to daily climatology.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Union

import numpy as np


CHANNEL_NAMES: List[str] = [
    "sst", "sss", "ssh", "uo", "vo", "uw", "vw",
    "curl_tau", "div_uv", "sst_grad_x", "sst_grad_y",
    "lat_sin", "lon_cos", "doy_sin", "doy_cos",
]


class ChannelStats:
    """
    Tracks and applies per-channel (C,) mean and std normalization.
    Preserves land masking so stats are only computed over ocean cells.
    """

    def __init__(
        self,
        mean: Optional[np.ndarray] = None,
        std: Optional[np.ndarray] = None,
        channel_names: Optional[List[str]] = None,
    ):
        self.channel_names = channel_names or CHANNEL_NAMES
        self.n_channels = len(self.channel_names)
        self.mean: np.ndarray = mean if mean is not None else np.zeros(self.n_channels, dtype=np.float32)
        self.std: np.ndarray = std if std is not None else np.ones(self.n_channels, dtype=np.float32)

    def fit_from_samples(self, samples: np.ndarray, mask: Optional[np.ndarray] = None):
        """
        Fits mean and std from an array of shape (N, C, H, W).
        If mask (H, W) is provided, only ocean pixels (mask == 1) are included.
        """
        N, C, H, W = samples.shape
        assert C == self.n_channels, f"Expected {self.n_channels} channels, got {C}"

        if mask is not None:
            # Flatten over N, H, W for valid ocean pixels
            ocean_indices = np.where(mask)
            # samples shape: (N, C, H, W)
            ocean_pixels = samples[:, :, ocean_indices[0], ocean_indices[1]]  # (N, C, n_ocean)
            flat = ocean_pixels.transpose(1, 0, 2).reshape(C, -1)  # (C, N*n_ocean)
        else:
            flat = samples.transpose(1, 0, 2, 3).reshape(C, -1)

        self.mean = np.nanmean(flat, axis=1).astype(np.float32)
        self.std = np.nanstd(flat, axis=1).astype(np.float32)
        # Prevent division by zero on static channels
        self.std = np.where(self.std < 1e-6, 1.0, self.std).astype(np.float32)

    def transform(self, x: np.ndarray) -> np.ndarray:
        """
        Normalizes input x: (C, H, W) or (B, C, H, W).
        Computes (x - mean) / (std + 1e-6).
        """
        if x.ndim == 3:
            return (x - self.mean[:, None, None]) / (self.std[:, None, None] + 1e-6)
        elif x.ndim == 4:
            return (x - self.mean[None, :, None, None]) / (self.std[None, :, None, None] + 1e-6)
        else:
            raise ValueError(f"Expected 3D or 4D array, got ndim={x.ndim}")

    def inverse_transform(self, x: np.ndarray) -> np.ndarray:
        """Denormalizes input x: (C, H, W) or (B, C, H, W)."""
        if x.ndim == 3:
            return x * (self.std[:, None, None] + 1e-6) + self.mean[:, None, None]
        elif x.ndim == 4:
            return x * (self.std[None, :, None, None] + 1e-6) + self.mean[None, :, None, None]
        else:
            raise ValueError(f"Expected 3D or 4D array, got ndim={x.ndim}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "channel_names": self.channel_names,
            "mean": self.mean.tolist(),
            "std": self.std.tolist(),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> ChannelStats:
        return cls(
            mean=np.array(d["mean"], dtype=np.float32),
            std=np.array(d["std"], dtype=np.float32),
            channel_names=d.get("channel_names", CHANNEL_NAMES),
        )

    def save(self, filepath: Union[str, Path]):
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> ChannelStats:
        with open(filepath, "r", encoding="utf-8") as f:
            d = json.load(f)
        return cls.from_dict(d)
