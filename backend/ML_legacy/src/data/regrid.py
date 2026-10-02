"""
ML/src/data/regrid.py
---------------------
Regridding pipeline to harmonize multi-source satellite and reanalysis grids
to the standard 0.25° North Indian Ocean target grid:
  lat: [5.125, 29.875] (100 cells)
  lon: [45.125, 104.875] (240 cells)

Supports:
- xESMF for mass-conserving or bilinear regridding (primary on Linux/Conda)
- Scipy RegularGridInterpolator fallback (works natively on pure Windows pip setups)
- Land-sea masking consistent with GLORYS-12
"""

from __future__ import annotations

import logging
from typing import Optional, Tuple, Union

import numpy as np
import xarray as xr

logger = logging.getLogger(__name__)

# Standard target coordinates: 100 lats x 240 lons = 24,000 cells
TARGET_LATS: np.ndarray = np.arange(5.125, 30.0, 0.25, dtype=np.float32)  # length 100
TARGET_LONS: np.ndarray = np.arange(45.125, 105.0, 0.25, dtype=np.float32)  # length 240

DEPTHS_15: np.ndarray = np.array(
    [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    dtype=np.float32,
)


def get_target_grid() -> xr.Dataset:
    """Returns the standardized 0.25° coordinate dataset."""
    return xr.Dataset(
        coords={
            "lat": (["lat"], TARGET_LATS),
            "lon": (["lon"], TARGET_LONS),
        }
    )


def regrid_scipy(
    da: xr.DataArray,
    target_lats: np.ndarray = TARGET_LATS,
    target_lons: np.ndarray = TARGET_LONS,
    method: str = "linear",
) -> xr.DataArray:
    """
    Interpolates a 2D or ND DataArray onto (target_lats, target_lons)
    using scipy.interpolate.RegularGridInterpolator.
    Robust fallback across all platforms without C-extension dependencies.
    """
    from scipy.interpolate import RegularGridInterpolator

    # Detect coordinate names
    lat_name = "lat" if "lat" in da.coords else "latitude"
    lon_name = "lon" if "lon" in da.coords else "longitude"

    src_lats = np.asarray(da[lat_name].values, dtype=np.float64)
    src_lons = np.asarray(da[lon_name].values, dtype=np.float64)

    # Ensure monotonic increasing
    lat_ascending = bool(src_lats[1] > src_lats[0]) if len(src_lats) > 1 else True
    if not lat_ascending:
        src_lats = src_lats[::-1]
        da = da.isel({lat_name: slice(None, None, -1)})

    # Handle 360 vs 180 lon system if needed
    if np.any(src_lons > 180) and np.all(target_lons <= 180):
        src_lons = np.where(src_lons > 180, src_lons - 360, src_lons)
        sort_idx = np.argsort(src_lons)
        src_lons = src_lons[sort_idx]
        da = da.isel({lon_name: sort_idx})

    # Build meshgrid for evaluation
    lat_grid, lon_grid = np.meshgrid(target_lats, target_lons, indexing="ij")
    eval_pts = np.stack([lat_grid.ravel(), lon_grid.ravel()], axis=-1)

    # Slice dimensions
    core_dims = [lat_name, lon_name]
    other_dims = [d for d in da.dims if d not in core_dims]

    if not other_dims:
        interp = RegularGridInterpolator(
            (src_lats, src_lons), da.values, method=method, bounds_error=False, fill_value=np.nan
        )
        out_vals = interp(eval_pts).reshape(len(target_lats), len(target_lons))
        return xr.DataArray(out_vals, coords={"lat": target_lats, "lon": target_lons}, dims=["lat", "lon"])

    # Iterate over leading dimensions (e.g. time, depth)
    out_shape = tuple(da.sizes[d] for d in other_dims) + (len(target_lats), len(target_lons))
    out_arr = np.empty(out_shape, dtype=np.float32)

    flat_iters = int(np.prod([da.sizes[d] for d in other_dims]))
    reshaped_src = da.values.reshape(flat_iters, len(src_lats), len(src_lons))
    reshaped_dst = out_arr.reshape(flat_iters, len(target_lats), len(target_lons))

    for i in range(flat_iters):
        interp = RegularGridInterpolator(
            (src_lats, src_lons), reshaped_src[i], method=method, bounds_error=False, fill_value=np.nan
        )
        reshaped_dst[i] = interp(eval_pts).reshape(len(target_lats), len(target_lons))

    coords = {d: da[d] for d in other_dims}
    coords["lat"] = target_lats
    coords["lon"] = target_lons
    return xr.DataArray(out_arr, coords=coords, dims=other_dims + ["lat", "lon"])


def regrid_xesmf(
    da: xr.DataArray,
    target_grid: Optional[xr.Dataset] = None,
    method: str = "bilinear",
    periodic: bool = False,
) -> xr.DataArray:
    """Uses xESMF conservative or bilinear regridder."""
    import xesmf as xe

    if target_grid is None:
        target_grid = get_target_grid()

    regridder = xe.Regridder(da, target_grid, method=method, periodic=periodic)
    return regridder(da)


def regrid(
    da: xr.DataArray,
    method: str = "bilinear",
    target_grid: Optional[xr.Dataset] = None,
    prefer_xesmf: bool = True,
) -> xr.DataArray:
    """
    Unified entry point for regridding.
    Attempts xESMF first if requested; falls back cleanly to scipy.
    """
    if prefer_xesmf:
        try:
            return regrid_xesmf(da, target_grid, method=method)
        except Exception as e:
            logger.debug(f"xESMF not available ({e}), falling back to scipy RegularGridInterpolator.")

    scipy_method = "nearest" if method == "nearest" else "linear"
    return regrid_scipy(da, method=scipy_method)


def extract_land_sea_mask(glorys_thetao_2d: xr.DataArray) -> np.ndarray:
    """
    Generates a boolean ocean mask (True=Ocean, False=Land) from GLORYS surface layer.
    Shape: (100, 240)
    """
    data = glorys_thetao_2d.values
    if data.ndim > 2:
        data = data[0]
    return ~np.isnan(data)
