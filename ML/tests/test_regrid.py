"""
ML/tests/test_regrid.py
-----------------------
Unit tests for the regridding pipeline.
Verifies shape alignment, coordinate mapping, and numerical accuracy on synthetic grids.
"""

from __future__ import annotations

import numpy as np
import pytest
import xarray as xr

from src.data.regrid import TARGET_LATS, TARGET_LONS, extract_land_sea_mask, get_target_grid, regrid_scipy


def test_target_grid_shape():
    grid = get_target_grid()
    assert len(grid["lat"]) == 100
    assert len(grid["lon"]) == 240
    assert np.isclose(grid["lat"].values[0], 5.125)
    assert np.isclose(grid["lat"].values[-1], 29.875)
    assert np.isclose(grid["lon"].values[0], 45.125)
    assert np.isclose(grid["lon"].values[-1], 104.875)


def test_regrid_scipy_preserves_constant_field():
    src_lats = np.linspace(4.0, 31.0, 50)
    src_lons = np.linspace(44.0, 106.0, 120)
    const_val = 27.5
    data = np.full((len(src_lats), len(src_lons)), const_val, dtype=np.float32)

    da = xr.DataArray(data, coords={"lat": src_lats, "lon": src_lons}, dims=["lat", "lon"])
    out = regrid_scipy(da)

    assert out.shape == (100, 240)
    assert np.allclose(out.values, const_val, atol=1e-4)


def test_land_sea_mask_extraction():
    data = np.ones((100, 240), dtype=np.float32)
    data[50:60, 50:60] = np.nan
    da = xr.DataArray(data, coords={"lat": TARGET_LATS, "lon": TARGET_LONS}, dims=["lat", "lon"])

    mask = extract_land_sea_mask(da)
    assert mask.shape == (100, 240)
    assert mask.dtype == bool
    assert not mask[55, 55]
    assert mask[0, 0]
