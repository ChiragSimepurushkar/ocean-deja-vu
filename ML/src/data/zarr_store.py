"""
ML/src/data/zarr_store.py
-------------------------
Zarr dataset builder and PyTorch Dataset for Ocean Deja Vu.
Reads the processed Zarr v3 store produced by dev3's data pipeline.

Uses the custom zarr3_reader module (not zarr-python) because:
  - Dataset is in Zarr v3 format (zarr.json, not .zgroup/.zarray)
  - zarr-python v3 requires Python >= 3.11
  - Our pytorch env uses Python 3.10

Store layout expected:
    Dataset/
    ├── surface/{date}/        (15, H, W) float32  — 15 surface channels
    ├── target_profiles/{date}/ (15, H, W) float32 — temperature at 15 depths
    ├── target_eof/{date}/     (M, H, W) float32   — M EOF coefficients
    ├── sla/{date}/            (H, W) float32       — sea level anomaly
    ├── missing_mask/{date}/   (H, W) float32       — per-day missing data mask
    ├── mask/                  (H, W) float32       — static ocean mask
    ├── lat/                   (H,) float32
    ├── lon/                   (W,) float32
    ├── depths/                (15,) float32
    ├── dates/train/           uint8 bytes → JSON list of date strings
    ├── dates/val/
    ├── dates/test/
    └── metadata_json/         uint8 bytes → JSON metadata
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader

logger = logging.getLogger(__name__)

DEPTHS_15 = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]


def _open_store(path: Union[str, Path]):
    """Open a Zarr store, using custom v3 reader or zarr-python."""
    from src.data.zarr3_reader import Zarr3Store
    return Zarr3Store(path)


def _read_dates(store, split: str) -> List[str]:
    """Read a dates/{split} uint8 array and decode as JSON list of date strings."""
    raw = store[f"dates/{split}"][:]
    text = bytes(raw.tolist()).decode("utf-8")
    return json.loads(text)


class OceanDataset(Dataset):
    """
    PyTorch Dataset providing:
      - surface: (C, H, W) normalized satellite surface tensor
      - target_eof: (n_modes, H, W) per-pixel EOF coefficients
      - mask: (H, W) binary ocean mask (1=ocean, 0=land)
      - sla: (H, W) sea level anomaly (optional)

    Works with both the real Zarr store and synthetic data for testing.
    """

    def __init__(
        self,
        store_path: Optional[Union[str, Path]] = None,
        split: str = "train",
        stats: Optional[Any] = None,
        eof: Optional[Any] = None,
        n_modes: int = 8,
        return_sla: bool = False,
        return_profiles: bool = False,
        synthetic: bool = False,
        num_synthetic_days: int = 30,
    ):
        self.split = split
        self.stats = stats
        self.eof = eof
        self.n_modes = n_modes
        self.return_sla = return_sla
        self.return_profiles = return_profiles
        self.synthetic = synthetic

        if synthetic or store_path is None or not Path(store_path).exists():
            logger.info(f"Initializing synthetic OceanDataset ({split}) "
                        f"with {num_synthetic_days} samples.")
            self.synthetic = True
            self.num_samples = num_synthetic_days
            self.dates = [f"2023-01-{i+1:02d}" for i in range(min(num_synthetic_days, 28))]
            self._H, self._W = 101, 241
            # Standard NIO ocean-land mask
            self.mask = np.ones((self._H, self._W), dtype=np.float32)
            self.mask[60:, 80:160] = 0.0  # mock peninsula
        else:
            self.store = _open_store(store_path)
            self.dates = _read_dates(self.store, split)
            self.num_samples = len(self.dates)
            self.mask = np.array(self.store["mask"][:]).astype(np.float32)
            self._H, self._W = self.mask.shape
            logger.info(f"OceanDataset({split}): {self.num_samples} dates, "
                        f"grid {self._H}×{self._W}")

    def __len__(self) -> int:
        return self.num_samples

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, ...]:
        if self.synthetic:
            return self._get_synthetic(idx)
        return self._get_real(idx)

    def _get_real(self, idx: int) -> Tuple[torch.Tensor, ...]:
        """Load from the real Zarr store."""
        date_str = self.dates[idx]

        # Surface (15, H, W)
        surface = np.array(self.store[f"surface/{date_str}"][:]).astype(np.float32)

        # Target: pre-computed EOF coefficients (M, H, W)
        target_eof = np.array(self.store[f"target_eof/{date_str}"][:]).astype(np.float32)

        # Apply normalization if stats are available
        if self.stats is not None:
            surface = self.stats.transform(surface)

        # Replace NaN with 0 (land/missing values)
        surface = np.nan_to_num(surface, nan=0.0)
        target_eof = np.nan_to_num(target_eof, nan=0.0)

        result = [
            torch.from_numpy(surface),
            torch.from_numpy(target_eof),
            torch.from_numpy(self.mask),
        ]

        if self.return_sla:
            try:
                sla = np.array(self.store[f"sla/{date_str}"][:]).astype(np.float32)
                sla = np.nan_to_num(sla, nan=0.0)
            except (KeyError, Exception):
                sla = np.zeros((self._H, self._W), dtype=np.float32)
            result.append(torch.from_numpy(sla))

        if self.return_profiles:
            try:
                profiles = np.array(
                    self.store[f"target_profiles/{date_str}"][:]
                ).astype(np.float32)
                profiles = np.nan_to_num(profiles, nan=0.0)
            except (KeyError, Exception):
                profiles = np.zeros((15, self._H, self._W), dtype=np.float32)
            result.append(torch.from_numpy(profiles))

        return tuple(result)

    def _get_synthetic(self, idx: int) -> Tuple[torch.Tensor, ...]:
        """Generate deterministic synthetic data based on idx."""
        np.random.seed(42 + idx)
        H, W = self._H, self._W

        # Surface 15 channels
        surface = np.random.randn(15, H, W).astype(np.float32)
        surface[0] += 28.0  # SST ~ 28°C

        # Target 15 depths → then EOF-encode
        targets = np.zeros((15, H, W), dtype=np.float32)
        for d_idx, depth in enumerate(DEPTHS_15):
            targets[d_idx] = (28.0 * np.exp(-depth / 300.0) + 4.0
                              + 0.5 * np.random.randn(H, W))

        # EOF encode if available
        if self.eof is not None:
            flat_prof = targets.reshape(15, -1).T
            eof_flat = self.eof.encode(flat_prof)
            eof_coeffs = eof_flat.T.reshape(-1, H, W)
        else:
            eof_coeffs = targets[:self.n_modes]

        if self.stats is not None:
            surface = self.stats.transform(surface)

        result = [
            torch.from_numpy(surface),
            torch.from_numpy(eof_coeffs),
            torch.from_numpy(self.mask),
        ]

        if self.return_sla:
            sla = np.random.randn(H, W).astype(np.float32) * 0.05
            result.append(torch.from_numpy(sla))

        if self.return_profiles:
            result.append(torch.from_numpy(targets))

        return tuple(result)


# ── DataLoader factory ──────────────────────────────────────────────────────

def make_dataloaders(
    store_path: Union[str, Path],
    batch_size: int = 8,
    num_workers: int = 0,
    return_sla: bool = False,
    return_profiles: bool = False,
    stats: Optional[Any] = None,
    eof: Optional[Any] = None,
    n_modes: int = 8,
    synthetic: bool = False,
    num_synthetic_days: int = 30,
) -> Tuple[DataLoader, DataLoader]:
    """
    Create train and validation DataLoaders from the Zarr store.

    Returns:
        (train_loader, val_loader)
    """
    common_kwargs = dict(
        store_path=store_path,
        stats=stats,
        eof=eof,
        n_modes=n_modes,
        return_sla=return_sla,
        return_profiles=return_profiles,
        synthetic=synthetic,
        num_synthetic_days=num_synthetic_days,
    )

    train_ds = OceanDataset(split="train", **common_kwargs)
    val_ds = OceanDataset(split="val", **common_kwargs)

    # On Windows, num_workers>0 with zarr/file I/O can cause issues
    import platform
    if platform.system() == "Windows" and num_workers > 0:
        logger.warning("Reducing num_workers to 0 on Windows to avoid "
                       "multiprocessing issues.")
        num_workers = 0

    train_dl = DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True,
        drop_last=True,
    )
    val_dl = DataLoader(
        val_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
    )

    logger.info(f"DataLoaders created: train={len(train_ds)} samples, "
                f"val={len(val_ds)} samples, batch_size={batch_size}")
    return train_dl, val_dl


# ── Zarr store builder (for creating new stores — uses zarr-python v2) ─────

def create_zarr_store(
    out_path: Union[str, Path],
    surface_dict: Dict[str, np.ndarray],
    target_dict: Dict[str, np.ndarray],
    mask: np.ndarray,
    splits: Dict[str, List[str]],
):
    """
    Saves dates, surface tensors, and target profiles into a chunked Zarr store.
    Uses zarr-python v2 for WRITING (which is what we have installed).
    """
    import zarr

    store = zarr.open(str(out_path), mode="w")
    H, W = mask.shape
    store.create_dataset("mask", data=mask.astype(bool), chunks=(H, W))

    for split_name, dates in splits.items():
        store.create_dataset(f"dates/{split_name}",
                             data=np.array(dates, dtype="U10"))

    surf_grp = store.create_group("surface")
    for date, arr in surface_dict.items():
        surf_grp.create_dataset(date, data=arr.astype(np.float32),
                                chunks=(15, H // 2, W))

    target_grp = store.create_group("target_profiles")
    for date, arr in target_dict.items():
        target_grp.create_dataset(date, data=arr.astype(np.float32),
                                  chunks=(15, H // 2, W))

    logger.info(f"Successfully constructed Zarr store at {out_path}")
