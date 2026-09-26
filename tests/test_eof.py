"""Unit tests for Empirical Orthogonal Function (EOF) profile compression."""

import tempfile
from pathlib import Path
import numpy as np
import torch
from src.data.eof import ProfileEOF

def test_eof_fit_and_variance():
    np.random.seed(42)
    # Generate realistic vertical temperature profiles: 15 depths
    # Depth profile: SST ~29°C decaying to ~6°C at depth
    depths = np.array([0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000])
    N = 200
    profiles = np.zeros((N, 15), dtype=np.float32)
    for i in range(N):
        sst = 28.0 + np.random.normal(0, 1.0)
        therm_depth = 80.0 + np.random.normal(0, 15.0)
        profiles[i] = 6.0 + (sst - 6.0) / (1.0 + np.exp((depths - therm_depth) / 30.0))

    eof = ProfileEOF(n_modes=5)
    eof.fit(profiles)

    assert eof.is_fitted
    assert eof.n_modes == 5
    explained = eof.pca.explained_variance_ratio_.cumsum()
    # 5 modes should capture over 95% of vertical profile variance
    assert explained[-1] > 0.95

def test_eof_encode_decode_roundtrip():
    np.random.seed(42)
    N = 100
    base = np.linspace(28.0, 6.0, 15)
    profiles = base[None, :] + np.random.normal(0, 0.5, (N, 15)).astype(np.float32)

    eof = ProfileEOF(n_modes=8)
    eof.fit(profiles)

    coeffs = eof.encode(profiles)
    assert coeffs.shape == (N, 8)

    reconstructed = eof.decode(coeffs)
    assert reconstructed.shape == (N, 15)

    rmse = np.sqrt(np.mean((reconstructed - profiles) ** 2))
    assert rmse < 0.35  # Reconstruction error on 15 levels with 8 modes

def test_eof_spatial_4d():
    np.random.seed(42)
    T, D, H, W = 4, 15, 20, 25
    profiles = np.random.normal(20.0, 5.0, (T, D, H, W)).astype(np.float32)

    eof = ProfileEOF(n_modes=6)
    eof.fit(profiles)

    coeffs = eof.encode(profiles)
    assert coeffs.shape == (T, 6, H, W)

    recon = eof.decode(coeffs)
    assert recon.shape == (T, 15, H, W)

def test_eof_decode_batch_pytorch():
    np.random.seed(42)
    profiles = np.random.normal(20.0, 4.0, (50, 15)).astype(np.float32)
    eof = ProfileEOF(n_modes=6)
    eof.fit(profiles)

    B, C, H, W = 3, 6, 10, 12
    coeffs_t = torch.randn(B, C, H, W, dtype=torch.float32)
    recon_t = eof.decode_batch(coeffs_t)
    assert recon_t.shape == (B, 15, H, W)
    assert recon_t.dtype == torch.float32

def test_eof_save_and_load():
    profiles = np.random.normal(20.0, 4.0, (50, 15)).astype(np.float32)
    eof = ProfileEOF(n_modes=5)
    eof.fit(profiles)

    with tempfile.TemporaryDirectory() as tmpdir:
        model_path = Path(tmpdir) / "eof.pkl"
        eof.save(model_path)
        assert model_path.exists()

        loaded_eof = ProfileEOF.load(model_path)
        assert loaded_eof.is_fitted
        assert loaded_eof.n_modes == 5
        assert np.allclose(loaded_eof.mean_profile, eof.mean_profile)
