"""
ML/src/data/zarr_store.py
-------------------------
Zarr dataset builder and PyTorch Dataset for Ocean Deja Vu.
Stores daily 0.25° surface and 15-level target fields over the North Indian Ocean.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
import torch
from torch.utils.data import Dataset

logger = logging.getLogger(__name__)

DEPTHS_15 = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]


class OceanDataset(Dataset):
    """
    PyTorch Dataset providing:
      - surface: (15, 100, 240) normalized satellite surface tensor
      - target_eof: (n_modes, 100, 240) per-pixel EOF coefficients (or physical profiles)
      - mask: (100, 240) binary ocean mask (1=ocean, 0=land)
      - metadata: dict with date, sla, etc.
    """

    def __init__(
        self,
        store_path: Optional[Union[str, Path]] = None,
        split: str = "train",
        stats: Optional[Any] = None,
        eof: Optional[Any] = None,
        n_modes: int = 15,
        synthetic: bool = False,
        num_synthetic_days: int = 30,
    ):
        self.split = split
        self.stats = stats
        self.eof = eof
        self.n_modes = n_modes
        self.synthetic = synthetic

        if synthetic or store_path is None or not Path(store_path).exists():
            logger.info(f"Initializing synthetic OceanDataset ({split}) with {num_synthetic_days} samples.")
            self.synthetic = True
            self.num_samples = num_synthetic_days
            self.dates = [f"2023-01-{i+1:02d}" for i in range(min(num_synthetic_days, 28))]
            # Standard NIO ocean-land mask (100, 240)
            self.mask = np.ones((100, 240), dtype=np.float32)
            # Create a simple synthetic land boundary (north/east representing Indian subcontinent)
            self.mask[60:, 80:160] = 0.0  # mock peninsula
        else:
            import zarr
            self.store = zarr.open(str(store_path), mode="r")
            self.dates = list(self.store[f"dates/{split}"][:])
            self.num_samples = len(self.dates)
            self.mask = self.store["mask"][:].astype(np.float32)

    def __len__(self) -> int:
        return self.num_samples

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        if self.synthetic:
            # Generate deterministic synthetic data based on idx
            np.random.seed(42 + idx)
            # Surface 15 channels (SST, SSS, SSH, currents, winds, curl, div, grads, coords)
            surface = np.random.randn(15, 100, 240).astype(np.float32)
            # Add seasonal SST cycle ~28°C
            surface[0] += 28.0
            # Target 15 depths
            targets = np.zeros((15, 100, 240), dtype=np.float32)
            for d_idx, depth in enumerate(DEPTHS_15):
                # Ocean thermocline profile: T(z) drops from ~28°C to ~4°C at 1000m
                targets[d_idx] = 28.0 * np.exp(-depth / 300.0) + 4.0 + 0.5 * np.random.randn(100, 240)

            # If EOF is provided, encode targets to EOF coefficients
            if self.eof is not None:
                # flat: (H*W, 15)
                flat_prof = targets.reshape(15, -1).T
                eof_flat = self.eof.encode(flat_prof)  # (H*W, n_modes)
                eof_coeffs = eof_flat.T.reshape(-1, 100, 240)
            else:
                eof_coeffs = targets[:self.n_modes]

            if self.stats is not None:
                surface = self.stats.transform(surface)

            return (
                torch.from_numpy(surface),
                torch.from_numpy(eof_coeffs),
                torch.from_numpy(self.mask),
            )

        # Real Zarr store access
        date_str = str(self.dates[idx])
        surface = self.store[f"surface/{date_str}"][:].astype(np.float32)
        target = self.store[f"target/{date_str}"][:].astype(np.float32)

        if self.stats is not None:
            surface = self.stats.transform(surface)

        if self.eof is not None:
            flat_prof = target.reshape(15, -1).T
            eof_flat = self.eof.encode(flat_prof)
            eof_coeffs = eof_flat.T.reshape(-1, 100, 240).astype(np.float32)
        else:
            eof_coeffs = target[:self.n_modes]

        return (
            torch.from_numpy(surface),
            torch.from_numpy(eof_coeffs),
            torch.from_numpy(self.mask),
        )


def create_zarr_store(
    out_path: Union[str, Path],
    surface_dict: Dict[str, np.ndarray],
    target_dict: Dict[str, np.ndarray],
    mask: np.ndarray,
    splits: Dict[str, List[str]],
):
    """
    Saves dates, surface tensors, and target profiles into a chunked Zarr store.
    """
    import zarr

    store = zarr.open(str(out_path), mode="w")
    store.create_dataset("mask", data=mask.astype(bool), chunks=(100, 240))

    for split_name, dates in splits.items():
        store.create_dataset(f"dates/{split_name}", data=np.array(dates, dtype="U10"))

    surf_grp = store.create_group("surface")
    for date, arr in surface_dict.items():
        surf_grp.create_dataset(date, data=arr.astype(np.float32), chunks=(15, 50, 120))

    target_grp = store.create_group("target")
    for date, arr in target_dict.items():
        target_grp.create_dataset(date, data=arr.astype(np.float32), chunks=(15, 50, 120))

    logger.info(f"Successfully constructed Zarr store at {out_path}")
