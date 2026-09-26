"""Unit tests for regridding, coordinate alignment, and masking."""

import numpy as np
import xarray as xr
from src.data.regrid import create_target_grid, OceanRegridder

def test_create_target_grid():
    grid = create_target_grid(lat_min=5.0, lat_max=10.0, lon_min=80.0, lon_max=85.0, res=0.25)
    assert "lat" in grid.coords
    assert "lon" in grid.coords
    assert len(grid["lat"]) == 21  # 5.0 to 10.0 inclusive with 0.25 step
    assert len(grid["lon"]) == 21
    assert np.isclose(grid["lat"].values[0], 5.0)
    assert np.isclose(grid["lat"].values[-1], 10.0)

def test_regrid_scipy_bilinear():
    regridder = OceanRegridder(
        lat_bounds=(5.0, 10.0),
        lon_bounds=(80.0, 85.0),
        res=0.25,
    )
    # Create coarse source data (0.5 degree)
    src_lats = np.arange(4.5, 10.51, 0.5)
    src_lons = np.arange(79.5, 85.51, 0.5)
    lon_g, lat_g = np.meshgrid(src_lons, src_lats)
    data = 2.0 * lat_g + 3.0 * lon_g

    da_src = xr.DataArray(
        data,
        coords={"lat": src_lats, "lon": src_lons},
        dims=["lat", "lon"],
    )

    regridded = regridder.regrid_dataarray(da_src, method="bilinear")
    assert regridded.shape == (21, 21)
    # Check linear interpolation exactness on linear function
    expected_center = 2.0 * 7.5 + 3.0 * 82.5
    center_val = float(regridded.sel(lat=7.5, lon=82.5, method="nearest").values)
    assert np.isclose(center_val, expected_center, atol=1e-3)

def test_build_land_sea_mask():
    arr = np.array([
        [28.0, np.nan, 29.0],
        [np.nan, 27.5, 28.5],
    ])
    da = xr.DataArray(arr, dims=["lat", "lon"])
    mask = OceanRegridder.build_land_sea_mask(da)
    assert mask.shape == (2, 3)
    assert mask[0, 0] == 1.0  # Ocean
    assert mask[0, 1] == 0.0  # Land / NaN
    assert mask[1, 0] == 0.0  # Land / NaN
    assert mask[1, 1] == 1.0  # Ocean

def test_compute_missing_channel():
    arr = np.array([[25.0, np.nan], [26.0, 27.0]])
    da = xr.DataArray(arr, dims=["lat", "lon"])
    missing_mask = OceanRegridder.compute_missing_channel(da)
    assert missing_mask.values[0, 0] == 0.0
    assert missing_mask.values[0, 1] == 1.0
    assert missing_mask.values[1, 0] == 0.0
