"""Zarr dataset store and PyTorch Dataset module for Ocean Deja Vu.

Provides:
- ZarrOceanStore: High-throughput chunked Zarr v2/v3 storage for multi-year
  surface observations, derived geophysical channels, EOF targets, and masks.
- OceanDataset: PyTorch Dataset yielding ready-to-train tensors for Dev 2's
  encoder/decoder models, baseline models, and Dev 3's API serving.
"""

from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import torch
from torch.utils.data import Dataset
import zarr

logger = logging.getLogger(__name__)


class ZarrOceanStore:
    """Manages writing and reading daily ocean snapshot fields in Zarr."""

    def __init__(self, store_path: str | Path, mode: str = "r"):
        self.store_path = Path(store_path)
        self.mode = mode
        if mode == "w":
            self.store_path.parent.mkdir(parents=True, exist_ok=True)
            self.root = zarr.open_group(str(self.store_path), mode="w")
        else:
            if not self.store_path.exists():
                raise FileNotFoundError(f"Zarr store does not exist at {self.store_path}")
            self.root = zarr.open_group(str(self.store_path), mode="r")

    def initialize_store(
        self,
        lats: np.ndarray,
        lons: np.ndarray,
        depths: np.ndarray,
        ocean_mask: np.ndarray,
        channel_names: List[str],
        eof_modes: int,
    ):
        """Create groups and write static coordinates and metadata."""
        self._write_array(self.root, "lat", np.asarray(lats, dtype=np.float32))
        self._write_array(self.root, "lon", np.asarray(lons, dtype=np.float32))
        self._write_array(self.root, "depths", np.asarray(depths, dtype=np.float32))
        self._write_array(self.root, "mask", np.asarray(ocean_mask, dtype=np.float32))

        # Store metadata
        meta_dict = {
            "nlat": int(len(lats)),
            "nlon": int(len(lons)),
            "ndepths": int(len(depths)),
            "eof_modes": int(eof_modes),
            "channel_names": channel_names,
        }
        meta_bytes = np.frombuffer(json.dumps(meta_dict).encode("utf-8"), dtype=np.uint8)
        self._write_array(self.root, "metadata_json", meta_bytes)

        # Create sub-groups
        for grp in ["surface", "target_profiles", "target_eof", "sla", "missing_mask", "dates"]:
            if grp not in self.root:
                self.root.create_group(grp)

    def write_day(
        self,
        date_str: str,
        surface: np.ndarray,
        target_profiles: np.ndarray,
        target_eof: np.ndarray,
        sla: np.ndarray,
        missing_mask: Optional[np.ndarray] = None,
    ):
        """Write single-day arrays to the Zarr store.

        Args:
            date_str: ISO date string (e.g. '2023-05-01').
            surface: (C_surf, H, W) float32 array.
            target_profiles: (15, H, W) float32 array.
            target_eof: (N_modes, H, W) float32 array.
            sla: (H, W) float32 array.
            missing_mask: Optional (H, W) float32 array (1=missing, 0=valid).
        """
        self._write_array(self.root["surface"], date_str, np.asarray(surface, dtype=np.float32))
        self._write_array(self.root["target_profiles"], date_str, np.asarray(target_profiles, dtype=np.float32))
        self._write_array(self.root["target_eof"], date_str, np.asarray(target_eof, dtype=np.float32))
        self._write_array(self.root["sla"], date_str, np.asarray(sla, dtype=np.float32))

        if missing_mask is not None:
            self._write_array(self.root["missing_mask"], date_str, np.asarray(missing_mask, dtype=np.float32))

    def set_splits(self, train_dates: List[str], val_dates: List[str], test_dates: List[str]):
        """Save train/val/test date index splits."""
        for split_name, d_list in [("train", train_dates), ("val", val_dates), ("test", test_dates)]:
            b_data = np.frombuffer(json.dumps(d_list).encode("utf-8"), dtype=np.uint8)
            self._write_array(self.root["dates"], split_name, b_data)

    def get_dates(self, split: str = "train") -> List[str]:
        """Retrieve list of dates for a given split."""
        raw_bytes = self.root["dates"][split][:].tobytes()
        return json.loads(raw_bytes.decode("utf-8"))

    def get_day(self, date_str: str) -> Dict[str, np.ndarray]:
        """Fetch all fields for a given date."""
        return {
            "surface": self.root["surface"][date_str][:],
            "target_profiles": self.root["target_profiles"][date_str][:],
            "target_eof": self.root["target_eof"][date_str][:],
            "sla": self.root["sla"][date_str][:],
            "mask": self.root["mask"][:],
            "missing_mask": self.root["missing_mask"][date_str][:] if "missing_mask" in self.root and date_str in self.root["missing_mask"] else None,
        }

    def get_mask(self) -> np.ndarray:
        return self.root["mask"][:]

    def get_lats(self) -> np.ndarray:
        return self.root["lat"][:]

    def get_lons(self) -> np.ndarray:
        return self.root["lon"][:]

    def get_depths(self) -> np.ndarray:
        return self.root["depths"][:]

    def get_metadata(self) -> Dict[str, Any]:
        raw_bytes = self.root["metadata_json"][:].tobytes()
        return json.loads(raw_bytes.decode("utf-8"))

    @staticmethod
    def _write_array(group: Any, name: str, data: np.ndarray):
        """Helper to create or overwrite an array in a zarr group."""
        if hasattr(group, "create_array"):
            # Zarr 3.x API
            if name in group:
                del group[name]
            group.create_array(name, data=data)
        elif hasattr(group, "create_dataset"):
            # Zarr 2.x API
            if name in group:
                del group[name]
            group.create_dataset(name, data=data)
        else:
            group[name] = data


class OceanDataset(Dataset):
    """PyTorch Dataset returning surface features and profile targets for training & evaluation.

    Each item yields:
      surface: (C_surf, H, W) tensor
      target_eof: (N_modes, H, W) tensor
      mask: (H, W) tensor (1.0 = ocean, 0.0 = land)
      target_profiles: (15, H, W) tensor
      sla: (H, W) tensor
    """

    def __init__(
        self,
        store_path: str | Path,
        split: str = "train",
        return_dict: bool = False,
    ):
        self.store = ZarrOceanStore(store_path, mode="r")
        self.split = split
        self.dates = self.store.get_dates(split)
        self.mask = torch.from_numpy(self.store.get_mask()).float()
        self.return_dict = return_dict

    def __len__(self) -> int:
        return len(self.dates)

    def __getitem__(self, idx: int) -> Union[Tuple[torch.Tensor, ...], Dict[str, Any]]:
        date_str = self.dates[idx]
        data = self.store.get_day(date_str)

        surface_t = torch.from_numpy(data["surface"]).float()
        target_eof_t = torch.from_numpy(data["target_eof"]).float()
        mask_t = self.mask
        target_prof_t = torch.from_numpy(data["target_profiles"]).float()
        sla_t = torch.from_numpy(data["sla"]).float()

        if self.return_dict:
            return {
                "date": date_str,
                "surface": surface_t,
                "target_eof": target_eof_t,
                "mask": mask_t,
                "target_profiles": target_prof_t,
                "sla": sla_t,
            }

        return surface_t, target_eof_t, mask_t, target_prof_t, sla_t
