"""Unit tests for ChannelStats normalization and anomaly computation."""

import tempfile
from pathlib import Path
import numpy as np
from src.data.normalize import ChannelStats

def test_channel_stats_fit_transform():
    T, H, W = 10, 20, 20
    channel_data = {
        "sst": np.random.normal(28.0, 2.0, (T, H, W)).astype(np.float32),
        "sss": np.random.normal(34.0, 1.0, (T, H, W)).astype(np.float32),
    }

    stats = ChannelStats()
    stats.fit(channel_data)

    assert stats.is_fitted
    assert "sst" in stats.stats
    assert np.isclose(stats.stats["sst"]["mean"], 28.0, atol=0.5)

    # Test transform
    sample = channel_data["sst"][0]
    normed = stats.transform_channel("sst", sample)
    assert np.isclose(np.mean(normed), 0.0, atol=0.5)
    assert np.isclose(np.std(normed), 1.0, atol=0.5)

    # Test inverse transform
    restored = stats.inverse_transform_channel("sst", normed)
    assert np.allclose(sample, restored, atol=1e-4)

def test_climatology_and_anomaly():
    T, H, W = 30, 10, 10
    dates = [f"2023-05-{i:02d}" for i in range(1, 31)]
    # Create SST with base climatology of 28.0
    sst = np.full((T, H, W), 28.0, dtype=np.float32)
    # Add a 2°C heatwave anomaly in the second half
    sst[15:] += 2.0

    channel_data = {"sst": sst}
    stats = ChannelStats()
    stats.fit(channel_data, dates=dates)

    assert "sst" in stats.climatologies
    # Transform as anomaly
    normed_anomaly = stats.transform_channel("sst", sst[20], is_anomaly=True)
    # Mean of anomaly should reflect the deviation
    assert np.mean(normed_anomaly) > 0.0

def test_channel_stats_save_load():
    stats = ChannelStats()
    stats.fit({"sst": np.array([[[20.0, 22.0], [24.0, 26.0]]])})

    with tempfile.TemporaryDirectory() as tmpdir:
        json_file = Path(tmpdir) / "stats.json"
        stats.save(json_file)
        assert json_file.exists()

        loaded_stats = ChannelStats.load(json_file)
        assert loaded_stats.is_fitted
        assert "sst" in loaded_stats.stats
        assert np.isclose(loaded_stats.stats["sst"]["mean"], stats.stats["sst"]["mean"])
