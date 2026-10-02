"""
ML/src/evaluation/baselines.py
------------------------------
Baseline models for benchmark comparisons against Ocean Deja Vu:
1. ClimatologyBaseline: Day-of-year mean profile per pixel.
2. PersistenceBaseline: Profile from prior day t-1.
3. LinearBaseline: Per-pixel Ridge regression from surface channels to subsurface profiles.
4. PlainUNetBaseline: Standard convolutional U-Net predicting 15 depth levels directly.
"""

from __future__ import annotations

import logging
from typing import Dict, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
from sklearn.linear_model import Ridge

logger = logging.getLogger(__name__)


class ClimatologyBaseline:
    """Computes and predicts day-of-year mean profiles for each ocean grid cell."""

    def __init__(self, n_depths: int = 15, h: int = 100, w: int = 240):
        self.n_depths = n_depths
        self.h = h
        self.w = w
        # Climatology table: 366 DOYs x n_depths x H x W
        self.clim_table: Optional[np.ndarray] = None

    def fit(self, dates: list[str], target_profiles: np.ndarray):
        """
        Fits climatology from (N, n_depths, H, W) target profiles.
        """
        import pandas as pd
        doys = pd.to_datetime(dates).dayofyear.values - 1  # 0-indexed (0..365)
        self.clim_table = np.zeros((366, self.n_depths, self.h, self.w), dtype=np.float32)
        counts = np.zeros(366, dtype=int)

        for i, doy in enumerate(doys):
            self.clim_table[doy] += target_profiles[i]
            counts[doy] += 1

        for doy in range(366):
            if counts[doy] > 0:
                self.clim_table[doy] /= counts[doy]
            else:
                # Fallback to overall mean
                self.clim_table[doy] = np.nanmean(target_profiles, axis=0)

    def predict(self, doy: int) -> np.ndarray:
        """Returns (n_depths, H, W) climatological profile."""
        if self.clim_table is None:
            # Synthetic default
            return np.ones((self.n_depths, self.h, self.w), dtype=np.float32) * 20.0
        idx = max(0, min(doy - 1, 365))
        return self.clim_table[idx]


class PersistenceBaseline:
    """Predicts today's subsurface profile using yesterday's observed profile."""

    def __init__(self):
        self.last_profile: Optional[np.ndarray] = None

    def update(self, profile: np.ndarray):
        self.last_profile = profile.copy()

    def predict(self) -> np.ndarray:
        if self.last_profile is None:
            raise RuntimeError("Persistence model requires at least one prior day of observation.")
        return self.last_profile


class LinearBaseline:
    """Per-pixel Ridge regression mapping surface channels to 15 subsurface depths."""

    def __init__(self, alpha: float = 1.0):
        self.alpha = alpha
        self.models: list[Ridge] = []

    def fit(self, surface_samples: np.ndarray, target_samples: np.ndarray):
        """
        surface_samples: (N, 15, H, W)
        target_samples:  (N, 15, H, W)
        """
        N, C, H, W = surface_samples.shape
        # Spatial pooling or regional fitting to manage memory
        X = surface_samples.transpose(0, 2, 3, 1).reshape(-1, C)
        Y = target_samples.transpose(0, 2, 3, 1).reshape(-1, 15)

        ridge = Ridge(alpha=self.alpha)
        ridge.fit(X, Y)
        self.models = [ridge]

    def predict(self, surface: np.ndarray) -> np.ndarray:
        """Input: (C, H, W) -> Output: (15, H, W)"""
        C, H, W = surface.shape
        X = surface.transpose(1, 2, 0).reshape(-1, C)
        Y_pred = self.models[0].predict(X)
        return Y_pred.reshape(H, W, 15).transpose(2, 0, 1).astype(np.float32)


class PlainUNetBaseline(nn.Module):
    """
    Standard convolutional U-Net predicting 15 depth levels directly from 15 surface channels.
    Serves as the non-pre-trained deep learning benchmark.
    """

    def __init__(self, in_channels: int = 15, out_channels: int = 15, hidden_dims: tuple[int, ...] = (32, 64, 128)):
        super().__init__()
        self.enc1 = nn.Sequential(
            nn.Conv2d(in_channels, hidden_dims[0], 3, padding=1),
            nn.BatchNorm2d(hidden_dims[0]),
            nn.ReLU(inplace=True),
        )
        self.enc2 = nn.Sequential(
            nn.MaxPool2d(2),
            nn.Conv2d(hidden_dims[0], hidden_dims[1], 3, padding=1),
            nn.BatchNorm2d(hidden_dims[1]),
            nn.ReLU(inplace=True),
        )
        self.enc3 = nn.Sequential(
            nn.MaxPool2d(2),
            nn.Conv2d(hidden_dims[1], hidden_dims[2], 3, padding=1),
            nn.BatchNorm2d(hidden_dims[2]),
            nn.ReLU(inplace=True),
        )

        self.up2 = nn.ConvTranspose2d(hidden_dims[2], hidden_dims[1], 2, stride=2)
        self.dec2 = nn.Sequential(
            nn.Conv2d(hidden_dims[1] * 2, hidden_dims[1], 3, padding=1),
            nn.BatchNorm2d(hidden_dims[1]),
            nn.ReLU(inplace=True),
        )

        self.up1 = nn.ConvTranspose2d(hidden_dims[1], hidden_dims[0], 2, stride=2)
        self.dec1 = nn.Sequential(
            nn.Conv2d(hidden_dims[0] * 2, hidden_dims[0], 3, padding=1),
            nn.BatchNorm2d(hidden_dims[0]),
            nn.ReLU(inplace=True),
            nn.Conv2d(hidden_dims[0], out_channels, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        orig_h, orig_w = x.shape[-2:]
        e1 = self.enc1(x)
        e2 = self.enc2(e1)
        e3 = self.enc3(e2)

        d2 = self.up2(e3)
        if d2.shape[-2:] != e2.shape[-2:]:
            d2 = nn.functional.interpolate(d2, size=e2.shape[-2:], mode="bilinear", align_corners=False)
        d2 = torch.cat([d2, e2], dim=1)
        d2 = self.dec2(d2)

        d1 = self.up1(d2)
        if d1.shape[-2:] != e1.shape[-2:]:
            d1 = nn.functional.interpolate(d1, size=e1.shape[-2:], mode="bilinear", align_corners=False)
        d1 = torch.cat([d1, e1], dim=1)
        out = self.dec1(d1)

        if out.shape[-2:] != (orig_h, orig_w):
            out = nn.functional.interpolate(out, size=(orig_h, orig_w), mode="bilinear", align_corners=False)
        return out
