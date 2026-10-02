"""
tests/test_eof_roundtrip.py
----------------------------
Verify that encode → decode roundtrip preserves profiles within tolerance.
"""

import numpy as np
import pytest
from sklearn.decomposition import PCA

from src.models.decoder import TorchEOFBridge
import torch


class TestEOFRoundtrip:
    @pytest.fixture
    def fitted_bridge(self):
        """Fit a real PCA on synthetic temperature-like profiles."""
        rng = np.random.default_rng(42)
        # Simulate realistic profiles: warm surface, cooler deep
        depths = np.array([0,5,10,20,30,50,75,100,125,150,200,300,500,700,1000])
        T0 = 28 + rng.normal(0, 1, 2000)
        profiles = np.array([
            T0[i] * np.exp(-d / 200.0) + 8.0 + rng.normal(0, 0.2, len(depths))
            for i, d in enumerate([0] * 2000)
        ]).reshape(2000, 15)
        # Simpler: just use warm-surface exponential decay
        profiles = np.zeros((2000, 15))
        for i in range(2000):
            sst = 26 + rng.normal(0, 2)
            for j, d in enumerate(depths):
                profiles[i, j] = sst * np.exp(-d / 250.0) + 4.0 + rng.normal(0, 0.3)

        pca = PCA(n_components=15).fit(profiles)
        return TorchEOFBridge.from_sklearn(pca), pca, profiles

    def test_sklearn_roundtrip_error(self, fitted_bridge):
        """sklearn PCA encode→decode error should be < 0.05°C mean."""
        bridge, pca, profiles = fitted_bridge
        coeffs = pca.transform(profiles)
        recon  = pca.inverse_transform(coeffs)
        mae = np.abs(profiles - recon).mean()
        assert mae < 0.05, f"PCA reconstruction error too large: {mae:.4f}°C"

    def test_torch_bridge_roundtrip(self, fitted_bridge):
        """TorchEOFBridge should match sklearn reconstruction."""
        bridge, pca, profiles = fitted_bridge
        # sklearn reference
        ref = pca.inverse_transform(pca.transform(profiles))

        # torch
        t = torch.tensor(profiles, dtype=torch.float32)
        coeffs = bridge.encode(t)
        recon  = bridge.decode(coeffs).numpy()

        np.testing.assert_allclose(recon, ref, atol=1e-4)

    def test_explained_variance(self, fitted_bridge):
        """15 modes should capture >99% variance on realistic profiles."""
        bridge, pca, _ = fitted_bridge
        cumvar = pca.explained_variance_ratio_.cumsum()[-1]
        assert cumvar > 0.99, f"Only {cumvar*100:.1f}% variance explained by 15 modes"

    def test_spatial_decode_shape(self, fitted_bridge):
        bridge, _, _ = fitted_bridge
        coeffs = torch.randn(2, 15, 100, 240)   # (B, M, H, W)
        prof   = bridge.decode(coeffs)
        assert prof.shape == (2, 15, 100, 240)
