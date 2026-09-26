"""Unit tests for ZarrOceanStore and PyTorch OceanDataset."""

import tempfile
from pathlib import Path
import numpy as np
import torch
from src.data.zarr_store import ZarrOceanStore, OceanDataset

def test_zarr_store_write_and_read():
    with tempfile.TemporaryDirectory() as tmpdir:
        store_path = Path(tmpdir) / "test.zarr"
        store = ZarrOceanStore(store_path, mode="w")

        lats = np.array([10.0, 10.25, 10.5])
        lons = np.array([80.0, 80.25, 80.5])
        depths = np.array([0, 10, 50, 100])
        mask = np.ones((3, 3), dtype=np.float32)
        channel_names = ["sst", "sss"]

        store.initialize_store(
            lats=lats,
            lons=lons,
            depths=depths,
            ocean_mask=mask,
            channel_names=channel_names,
            eof_modes=4,
        )

        # Write day
        surface = np.ones((2, 3, 3), dtype=np.float32)
        target_prof = np.full((4, 3, 3), 25.0, dtype=np.float32)
        target_eof = np.zeros((4, 3, 3), dtype=np.float32)
        sla = np.zeros((3, 3), dtype=np.float32)

        store.write_day("2023-05-01", surface, target_prof, target_eof, sla)
        store.set_splits(["2023-05-01"], [], [])

        # Read back
        reader = ZarrOceanStore(store_path, mode="r")
        assert reader.get_dates("train") == ["2023-05-01"]
        day_data = reader.get_day("2023-05-01")
        assert day_data["surface"].shape == (2, 3, 3)
        assert day_data["target_profiles"].shape == (4, 3, 3)
        assert np.allclose(day_data["target_profiles"], 25.0)

def test_pytorch_ocean_dataset():
    with tempfile.TemporaryDirectory() as tmpdir:
        store_path = Path(tmpdir) / "test_ds.zarr"
        store = ZarrOceanStore(store_path, mode="w")

        store.initialize_store(
            lats=np.array([10.0, 10.25]),
            lons=np.array([80.0, 80.25]),
            depths=np.array([0, 100]),
            ocean_mask=np.ones((2, 2)),
            channel_names=["sst"],
            eof_modes=3,
        )

        dates = ["2023-05-01", "2023-05-02"]
        for d in dates:
            store.write_day(
                d,
                surface=np.ones((1, 2, 2)),
                target_profiles=np.ones((2, 2, 2)) * 26.0,
                target_eof=np.ones((3, 2, 2)),
                sla=np.zeros((2, 2)),
            )
        store.set_splits(["2023-05-01"], ["2023-05-02"], [])

        ds_train = OceanDataset(store_path, split="train")
        assert len(ds_train) == 1

        surface, target_eof, mask, target_prof, sla = ds_train[0]
        assert isinstance(surface, torch.Tensor)
        assert surface.shape == (1, 2, 2)
        assert target_eof.shape == (3, 2, 2)
        assert target_prof.shape == (2, 2, 2)
        assert mask.shape == (2, 2)
        assert sla.shape == (2, 2)
