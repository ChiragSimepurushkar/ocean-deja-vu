"""Unit tests for baseline models (Climatology, Persistence, Linear, PlainUNet)."""

import tempfile
from pathlib import Path
import numpy as np
import torch
from src.data.zarr_store import ZarrOceanStore
from src.data.eof import ProfileEOF
from src.baselines.climatology import ClimatologyBaseline
from src.baselines.persistence import PersistenceBaseline
from src.baselines.linear import LinearBaseline
from src.baselines.unet import PlainUNetBaseline
from src.baselines.evaluate import compute_profile_metrics

def test_plain_unet_shapes():
    B, C_in, H, W = 2, 15, 32, 32
    model = PlainUNetBaseline(in_channels=15, out_channels=15, init_features=16)
    x = torch.randn(B, C_in, H, W)
    out = model(x)
    assert out.shape == (B, 15, H, W)

def test_compute_profile_metrics():
    H, W = 10, 10
    mask = np.ones((H, W), dtype=bool)
    depths = [0, 50, 100, 500]

    # Perfect prediction test: RMSE should be 0.0, corr should be 1.0
    y_true = np.ones((1, 4, H, W)) * 25.0
    pred = np.ones((1, 4, H, W)) * 25.0

    metrics = compute_profile_metrics(pred, y_true, mask, depths)
    assert metrics["overall_rmse"] == 0.0
    assert metrics["surface_rmse_0m"] == 0.0

    # Constant offset test: +1.0 °C
    pred_offset = y_true + 1.0
    metrics_offset = compute_profile_metrics(pred_offset, y_true, mask, depths)
    assert np.isclose(metrics_offset["overall_rmse"], 1.0)
    assert np.isclose(metrics_offset["per_depth"][0]["bias"], 1.0)

def test_climatology_and_persistence():
    with tempfile.TemporaryDirectory() as tmpdir:
        store_path = Path(tmpdir) / "test_base.zarr"
        store = ZarrOceanStore(store_path, mode="w")
        store.initialize_store(
            lats=np.array([10.0, 10.25]),
            lons=np.array([80.0, 80.25]),
            depths=np.array([0, 100]),
            ocean_mask=np.ones((2, 2)),
            channel_names=["sst"],
            eof_modes=2,
        )
        # 2 days: Day 1 profile=20.0, Day 2 profile=22.0
        store.write_day("2023-05-01", np.zeros((1, 2, 2)), np.full((2, 2, 2), 20.0), np.zeros((2, 2, 2)), np.zeros((2, 2)))
        store.write_day("2023-05-02", np.zeros((1, 2, 2)), np.full((2, 2, 2), 22.0), np.zeros((2, 2, 2)), np.zeros((2, 2)))
        store.set_splits(["2023-05-01"], [], ["2023-05-02"])

        # Climatology should predict train mean: 20.0
        clim = ClimatologyBaseline()
        clim.fit(store, train_split="train")
        pred_clim = clim.predict_field("2023-05-02")
        assert np.allclose(pred_clim, 20.0)

        # Persistence should predict Day 1 for Day 2: 20.0
        pers = PersistenceBaseline(store)
        pred_pers = pers.predict_field("2023-05-02", lag_days=1)
        assert np.allclose(pred_pers, 20.0)
