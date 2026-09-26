"""Unit tests for geophysical feature engineering."""

import numpy as np
from src.data.features import (
    compute_grid_metrics,
    wind_stress_curl,
    surface_divergence,
    sst_gradients,
    coordinate_channels,
    compute_all_features,
)

def test_compute_grid_metrics():
    lats = np.array([0.0, 30.0, 60.0])
    dx, dy = compute_grid_metrics(lats, res_deg=0.25)
    assert len(dx) == 3
    assert dy > 27000.0  # ~27.78 km
    # Longitude spacing decreases towards poles
    assert dx[0] > dx[1] > dx[2]

def test_wind_stress_curl_uniform():
    # Uniform wind field should have approximately zero curl
    lats = np.linspace(10, 20, 41)
    uw = np.full((41, 41), 10.0, dtype=np.float32)
    vw = np.full((41, 41), 5.0, dtype=np.float32)
    curl = wind_stress_curl(uw, vw, lats=lats, res_deg=0.25)
    assert curl.shape == (41, 41)
    # Check interior values are near zero
    assert np.allclose(curl[5:-5, 5:-5], 0.0, atol=1e-8)

def test_surface_divergence_uniform():
    # Uniform ocean currents should have zero divergence
    lats = np.linspace(10, 20, 41)
    uo = np.full((41, 41), 0.5, dtype=np.float32)
    vo = np.full((41, 41), -0.2, dtype=np.float32)
    div = surface_divergence(uo, vo, lats=lats, res_deg=0.25)
    assert div.shape == (41, 41)
    assert np.allclose(div[5:-5, 5:-5], 0.0, atol=1e-8)

def test_sst_gradients():
    lats = np.linspace(10, 20, 41)
    # Linearly increasing SST in latitude: dT/dy is constant
    lons = np.linspace(80, 90, 41)
    lon_g, lat_g = np.meshgrid(lons, lats)
    sst = lat_g * 0.5  # 0.5 deg C per degree lat

    grad_x, grad_y = sst_gradients(sst, lats, res_deg=0.25)
    assert grad_x.shape == (41, 41)
    assert grad_y.shape == (41, 41)
    # grad_x should be 0
    assert np.allclose(grad_x[2:-2, 2:-2], 0.0, atol=1e-7)
    # grad_y should be positive
    assert np.all(grad_y[2:-2, 2:-2] > 0.0)

def test_coordinate_channels():
    lats = np.array([0.0, 30.0])
    lons = np.array([0.0, 90.0, 180.0])
    lat_sin, lon_cos, doy_sin, doy_cos = coordinate_channels(lats, lons, doy=100)

    assert lat_sin.shape == (2, 3)
    assert lon_cos.shape == (2, 3)
    assert doy_sin.shape == (2, 3)
    assert doy_cos.shape == (2, 3)

    # sin(0) = 0
    assert np.isclose(lat_sin[0, 0], 0.0)
    # sin(30 deg) = 0.5
    assert np.isclose(lat_sin[1, 0], 0.5, atol=1e-3)
    # cos(0 deg) = 1.0
    assert np.isclose(lon_cos[0, 0], 1.0, atol=1e-3)
    # cos(90 deg) = 0.0
    assert np.isclose(lon_cos[0, 1], 0.0, atol=1e-3)

def test_compute_all_features_assembly():
    H, W = 20, 25
    lats = np.linspace(10, 15, H)
    lons = np.linspace(80, 86, W)
    feats = compute_all_features(
        sst=np.ones((H, W)),
        sss=np.ones((H, W)) * 34.0,
        ssh=np.zeros((H, W)),
        uo=np.zeros((H, W)),
        vo=np.zeros((H, W)),
        uw=np.ones((H, W)) * 5.0,
        vw=np.ones((H, W)) * 5.0,
        lats=lats,
        lons=lons,
        doy=120,
        res_deg=0.25,
    )
    assert len(feats) == 15
    for k, arr in feats.items():
        assert arr.shape == (H, W), f"Channel {k} has shape {arr.shape}, expected {(H, W)}"
