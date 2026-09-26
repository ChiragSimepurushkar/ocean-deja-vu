"""
ML/src/data/features.py
-----------------------
Physical and kinematic feature extraction for the 15 surface channels:
1. SST: Sea Surface Temperature (OSTIA)
2. SSS: Sea Surface Salinity (SMAP/SMOS)
3. SSH: Sea Level Anomaly (DUACS)
4. uo: Zonal surface current (OSCAR)
5. vo: Meridional surface current (OSCAR)
6. uw: Zonal 10m wind (CCMP)
7. vw: Meridional 10m wind (CCMP)
8. curl_tau: Wind stress curl ∂(τ_y)/∂x − ∂(τ_x)/∂y (Ekman pumping proxy)
9. div_uv: Surface current divergence ∂u/∂x + ∂v/∂y (upwelling indicator)
10. sst_grad_x: Zonal thermal front gradient ∂(SST)/∂x
11. sst_grad_y: Meridional thermal front gradient ∂(SST)/∂y
12. lat_sin: sin(lat) spatial position encoding
13. lon_cos: cos(lon) spatial position encoding
14. doy_sin: sin(2π·doy/365.25) seasonal phase encoding
15. doy_cos: cos(2π·doy/365.25) seasonal phase encoding
"""

from __future__ import annotations

from typing import Dict, Optional, Tuple, Union

import numpy as np
import xarray as xr

# Conversion constants
R_EARTH = 6_371_000.0  # meters
DEG_TO_RAD = np.pi / 180.0
DEG_LAT_METERS = 111_195.0  # ~111.2 km per degree latitude


def wind_stress_curl(
    uw: Union[np.ndarray, xr.DataArray],
    vw: Union[np.ndarray, xr.DataArray],
    lats: Optional[np.ndarray] = None,
    dx_deg: float = 0.25,
    dy_deg: float = 0.25,
    rho_air: float = 1.225,
    cd: float = 1.3e-3,
) -> np.ndarray:
    """
    Computes Ekman pumping proxy (wind stress curl) in N/m³:
      τ = ρ_air · Cd · |U| · U
      curl(τ) = ∂(τ_y)/∂x - ∂(τ_x)/∂y
    """
    uw_vals = np.asarray(uw.values if hasattr(uw, "values") else uw, dtype=np.float32)
    vw_vals = np.asarray(vw.values if hasattr(vw, "values") else vw, dtype=np.float32)

    if lats is None:
        if hasattr(uw, "lat"):
            lats = np.asarray(uw.lat.values, dtype=np.float32)
        else:
            lats = np.linspace(5.125, 29.875, uw_vals.shape[-2], dtype=np.float32)

    wspd = np.hypot(uw_vals, vw_vals)
    tau_x = rho_air * cd * wspd * uw_vals
    tau_y = rho_air * cd * wspd * vw_vals

    # Metric distance scaling
    # dx varies with latitude: dx = dx_deg * 111km * cos(lat)
    cos_lat = np.cos(np.deg2rad(lats))
    cos_lat = np.clip(cos_lat, 0.05, 1.0)
    dx = dx_deg * DEG_LAT_METERS * cos_lat[:, None]
    dy = dy_deg * DEG_LAT_METERS

    d_tau_y_dx = np.gradient(tau_y, axis=-1) / dx
    d_tau_x_dy = np.gradient(tau_x, axis=-2) / dy
    curl = d_tau_y_dx - d_tau_x_dy

    # Nan out infinite values over land
    curl = np.nan_to_num(curl, nan=0.0, posinf=0.0, neginf=0.0)
    return curl.astype(np.float32)


def surface_divergence(
    uo: Union[np.ndarray, xr.DataArray],
    vo: Union[np.ndarray, xr.DataArray],
    lats: Optional[np.ndarray] = None,
    dx_deg: float = 0.25,
    dy_deg: float = 0.25,
) -> np.ndarray:
    """
    Computes horizontal surface current divergence (s⁻¹):
      div(u) = ∂u/∂x + ∂v/∂y
    Positive values correspond to surface divergence (upwelling).
    """
    uo_vals = np.asarray(uo.values if hasattr(uo, "values") else uo, dtype=np.float32)
    vo_vals = np.asarray(vo.values if hasattr(vo, "values") else vo, dtype=np.float32)

    if lats is None:
        if hasattr(uo, "lat"):
            lats = np.asarray(uo.lat.values, dtype=np.float32)
        else:
            lats = np.linspace(5.125, 29.875, uo_vals.shape[-2], dtype=np.float32)

    cos_lat = np.clip(np.cos(np.deg2rad(lats)), 0.05, 1.0)
    dx = dx_deg * DEG_LAT_METERS * cos_lat[:, None]
    dy = dy_deg * DEG_LAT_METERS

    du_dx = np.gradient(uo_vals, axis=-1) / dx
    dv_dy = np.gradient(vo_vals, axis=-2) / dy
    div = du_dx + dv_dy

    return np.nan_to_num(div, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)


def sst_gradients(
    sst: Union[np.ndarray, xr.DataArray],
    lats: Optional[np.ndarray] = None,
    dx_deg: float = 0.25,
    dy_deg: float = 0.25,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes horizontal thermal front gradients (°C/m):
      (∂SST/∂x, ∂SST/∂y)
    """
    sst_vals = np.asarray(sst.values if hasattr(sst, "values") else sst, dtype=np.float32)

    if lats is None:
        if hasattr(sst, "lat"):
            lats = np.asarray(sst.lat.values, dtype=np.float32)
        else:
            lats = np.linspace(5.125, 29.875, sst_vals.shape[-2], dtype=np.float32)

    cos_lat = np.clip(np.cos(np.deg2rad(lats)), 0.05, 1.0)
    dx = dx_deg * DEG_LAT_METERS * cos_lat[:, None]
    dy = dy_deg * DEG_LAT_METERS

    grad_x = np.gradient(sst_vals, axis=-1) / dx
    grad_y = np.gradient(sst_vals, axis=-2) / dy

    return (
        np.nan_to_num(grad_x, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32),
        np.nan_to_num(grad_y, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32),
    )


def coordinate_channels(
    nlat: int = 100,
    nlon: int = 240,
    lats: Optional[np.ndarray] = None,
    lons: Optional[np.ndarray] = None,
    doy: float = 180.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Broadcasts sinusoidal position and seasonal temporal encodings:
      lat_sin: sin(lat)
      lon_cos: cos(lon)
      doy_sin: sin(2π · doy / 365.25)
      doy_cos: cos(2π · doy / 365.25)
    Returns: 4 arrays of shape (nlat, nlon)
    """
    if lats is None:
        lats = np.linspace(5.125, 29.875, nlat, dtype=np.float32)
    if lons is None:
        lons = np.linspace(45.125, 104.875, nlon, dtype=np.float32)

    lat_rad = np.deg2rad(lats)
    lon_rad = np.deg2rad(lons)

    lat_sin = np.sin(lat_rad)[:, None] * np.ones((1, nlon), dtype=np.float32)
    lon_cos = np.cos(lon_rad)[None, :] * np.ones((nlat, 1), dtype=np.float32)

    omega = 2.0 * np.pi * float(doy) / 365.25
    doy_sin = np.full((nlat, nlon), np.sin(omega), dtype=np.float32)
    doy_cos = np.full((nlat, nlon), np.cos(omega), dtype=np.float32)

    return lat_sin, lon_cos, doy_sin, doy_cos


def build_15_channel_surface(
    sst: np.ndarray,
    sss: np.ndarray,
    ssh: np.ndarray,
    uo: np.ndarray,
    vo: np.ndarray,
    uw: np.ndarray,
    vw: np.ndarray,
    doy: float,
    lats: Optional[np.ndarray] = None,
    lons: Optional[np.ndarray] = None,
) -> np.ndarray:
    """
    Assembles the complete (15, H, W) surface tensor from primary satellite inputs.
    """
    H, W = sst.shape
    curl = wind_stress_curl(uw, vw, lats=lats)
    div = surface_divergence(uo, vo, lats=lats)
    gx, gy = sst_gradients(sst, lats=lats)
    ls, lc, ds, dc = coordinate_channels(nlat=H, nlon=W, lats=lats, lons=lons, doy=doy)

    channels = [
        sst, sss, ssh, uo, vo, uw, vw,
        curl, div, gx, gy,
        ls, lc, ds, dc,
    ]
    return np.stack([c.astype(np.float32) for c in channels], axis=0)
