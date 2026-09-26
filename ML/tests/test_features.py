"""
ML/tests/test_features.py
-------------------------
Unit tests for kinematic and physical feature extraction.
Verifies:
  - curl of constant wind field is zero
  - divergence of uniform flow is zero
  - gradient of constant SST is zero
  - 15-channel surface builder outputs correct shapes and finite values
"""

from __future__ import annotations

import numpy as np
import pytest

from src.data.features import (
    build_15_channel_surface,
    coordinate_channels,
    sst_gradients,
    surface_divergence,
    wind_stress_curl,
)


def test_curl_constant_wind():
    H, W = 100, 240
    uw = np.full((H, W), 5.0, dtype=np.float32)
    vw = np.full((H, W), -3.0, dtype=np.float32)
    curl = wind_stress_curl(uw, vw)
    assert curl.shape == (H, W)
    # Interior curl of uniform wind should be zero within numerical gradient precision
    assert np.allclose(curl[5:-5, 5:-5], 0.0, atol=1e-5)


def test_divergence_uniform_flow():
    H, W = 100, 240
    uo = np.full((H, W), 0.5, dtype=np.float32)
    vo = np.full((H, W), 0.2, dtype=np.float32)
    div = surface_divergence(uo, vo)
    assert div.shape == (H, W)
    assert np.allclose(div[5:-5, 5:-5], 0.0, atol=1e-5)


def test_sst_gradient_constant():
    H, W = 100, 240
    sst = np.full((H, W), 28.0, dtype=np.float32)
    gx, gy = sst_gradients(sst)
    assert gx.shape == (H, W)
    assert gy.shape == (H, W)
    assert np.allclose(gx, 0.0, atol=1e-6)
    assert np.allclose(gy, 0.0, atol=1e-6)


def test_coordinate_channels():
    H, W = 100, 240
    ls, lc, ds, dc = coordinate_channels(nlat=H, nlon=W, doy=180)
    assert ls.shape == (H, W)
    assert lc.shape == (H, W)
    assert ds.shape == (H, W)
    assert dc.shape == (H, W)
    assert np.all(np.abs(ls) <= 1.0)
    assert np.all(np.abs(lc) <= 1.0)
    assert np.all(np.abs(ds) <= 1.0)
    assert np.all(np.abs(dc) <= 1.0)


def test_build_15_channel_surface():
    H, W = 100, 240
    sst = np.ones((H, W), dtype=np.float32) * 28.0
    sss = np.ones((H, W), dtype=np.float32) * 34.0
    ssh = np.zeros((H, W), dtype=np.float32)
    uo  = np.zeros((H, W), dtype=np.float32)
    vo  = np.zeros((H, W), dtype=np.float32)
    uw  = np.ones((H, W), dtype=np.float32) * 5.0
    vw  = np.zeros((H, W), dtype=np.float32)

    surf = build_15_channel_surface(sst, sss, ssh, uo, vo, uw, vw, doy=100)
    assert surf.shape == (15, H, W)
    assert not np.isnan(surf).any()
