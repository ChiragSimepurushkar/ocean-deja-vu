"""Geophysical feature engineering module for ocean surface fields.

Calculates:
- Wind stress curl: ∂(τ_y)/∂x − ∂(τ_x)/∂y using quadratic bulk formula
- Surface ocean current divergence: ∂(u_o)/∂x + ∂(v_o)/∂y
- SST gradients: ∂(SST)/∂x and ∂(SST)/∂y
- Spatiotemporal coordinates: lat_sin, lon_cos, doy_sin, doy_cos
- Missing observation mask channel
"""

from __future__ import annotations
from typing import Tuple, Dict, Any, Optional
import numpy as np
import xarray as xr

# Physical constants
R_EARTH = 6.371e6            # Earth radius in meters
DEG_TO_RAD = np.pi / 180.0
DEG_TO_METERS = 111_139.0    # Approximate meters per degree latitude
RHO_AIR = 1.225              # Air density kg/m³
CD_BULK = 1.3e-3             # Dimensionless drag coefficient


def compute_grid_metrics(lats: np.ndarray, res_deg: float = 0.25) -> Tuple[np.ndarray, float]:
    """Compute spherical metric factors dx(lat) and dy in meters.

    Args:
        lats: 1D array of latitudes in degrees.
        res_deg: Grid spacing in degrees.

    Returns:
        dx: 1D array of longitude spacing in meters at each latitude.
        dy: Scalar latitude spacing in meters.
    """
    dy = res_deg * DEG_TO_METERS
    dx = res_deg * DEG_TO_METERS * np.cos(lats * DEG_TO_RAD)
    # Prevent divide by zero at high latitudes
    dx = np.maximum(dx, 1000.0)
    return dx, dy


def wind_stress_curl(
    uw: np.ndarray | xr.DataArray,
    vw: np.ndarray | xr.DataArray,
    lats: np.ndarray,
    res_deg: float = 0.25,
    rho_air: float = RHO_AIR,
    cd: float = CD_BULK,
) -> np.ndarray:
    """Compute wind stress curl ∂(τ_y)/∂x − ∂(τ_x)/∂y [N/m³].

    Args:
        uw: Eastward wind component (m/s), shape (..., H, W).
        vw: Northward wind component (m/s), shape (..., H, W).
        lats: 1D array of latitudes (length H).
        res_deg: Spatial resolution in degrees.
        rho_air: Air density (kg/m³).
        cd: Bulk drag coefficient.

    Returns:
        np.ndarray of wind stress curl with the same shape as uw.
    """
    uw_arr = uw.values if isinstance(uw, xr.DataArray) else np.asarray(uw)
    vw_arr = vw.values if isinstance(vw, xr.DataArray) else np.asarray(vw)

    w_spd = np.hypot(uw_arr, vw_arr)
    tau_x = rho_air * cd * w_spd * uw_arr
    tau_y = rho_air * cd * w_spd * vw_arr

    dx, dy = compute_grid_metrics(lats, res_deg)

    # Gradient along longitude (axis -1) and latitude (axis -2)
    # Using np.gradient with per-latitude spacing for dx
    dtau_y_dx = np.gradient(tau_y, axis=-1) / dx[..., None]
    dtau_x_dy = np.gradient(tau_x, axis=-2) / dy

    curl = dtau_y_dx - dtau_x_dy
    return np.asarray(curl, dtype=np.float32)


def surface_divergence(
    uo: np.ndarray | xr.DataArray,
    vo: np.ndarray | xr.DataArray,
    lats: np.ndarray,
    res_deg: float = 0.25,
) -> np.ndarray:
    """Compute ocean surface current horizontal divergence ∂u/∂x + ∂v/∂y [s⁻¹].

    Args:
        uo: Eastward ocean current (m/s), shape (..., H, W).
        vo: Northward ocean current (m/s), shape (..., H, W).
        lats: 1D array of latitudes (length H).
        res_deg: Spatial resolution in degrees.

    Returns:
        np.ndarray of divergence with the same shape as uo.
    """
    uo_arr = uo.values if isinstance(uo, xr.DataArray) else np.asarray(uo)
    vo_arr = vo.values if isinstance(vo, xr.DataArray) else np.asarray(vo)

    dx, dy = compute_grid_metrics(lats, res_deg)

    duo_dx = np.gradient(uo_arr, axis=-1) / dx[..., None]
    dvo_dy = np.gradient(vo_arr, axis=-2) / dy

    div = duo_dx + dvo_dy
    return np.asarray(div, dtype=np.float32)


def sst_gradients(
    sst: np.ndarray | xr.DataArray,
    lats: np.ndarray,
    res_deg: float = 0.25,
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute SST spatial gradients ∂(SST)/∂x and ∂(SST)/∂y [°C/m].

    Args:
        sst: Sea surface temperature (°C), shape (..., H, W).
        lats: 1D array of latitudes (length H).
        res_deg: Spatial resolution in degrees.

    Returns:
        grad_x, grad_y: Arrays of zonal and meridional gradients.
    """
    sst_arr = sst.values if isinstance(sst, xr.DataArray) else np.asarray(sst)
    dx, dy = compute_grid_metrics(lats, res_deg)

    grad_x = np.gradient(sst_arr, axis=-1) / dx[..., None]
    grad_y = np.gradient(sst_arr, axis=-2) / dy

    return np.asarray(grad_x, dtype=np.float32), np.asarray(grad_y, dtype=np.float32)


def coordinate_channels(
    lats: np.ndarray,
    lons: np.ndarray,
    doy: int | float | np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Broadcast sin(lat), cos(lon), sin(doy), cos(doy) across (H, W) grid.

    Returns:
        lat_sin, lon_cos, doy_sin, doy_cos each of shape (H, W).
    """
    nlat = len(lats)
    nlon = len(lons)

    lat_rad = np.deg2rad(lats)[:, None]
    lon_rad = np.deg2rad(lons)[None, :]

    lat_sin = np.sin(lat_rad) * np.ones((1, nlon), dtype=np.float32)
    lon_cos = np.cos(lon_rad) * np.ones((nlat, 1), dtype=np.float32)

    # Day of year harmonic representation (365.25 days)
    doy_rad = 2.0 * np.pi * doy / 365.25
    doy_sin = np.full((nlat, nlon), np.sin(doy_rad), dtype=np.float32)
    doy_cos = np.full((nlat, nlon), np.cos(doy_rad), dtype=np.float32)

    return (
        np.asarray(lat_sin, dtype=np.float32),
        np.asarray(lon_cos, dtype=np.float32),
        np.asarray(doy_sin, dtype=np.float32),
        np.asarray(doy_cos, dtype=np.float32),
    )


def compute_all_features(
    sst: np.ndarray,
    sss: np.ndarray,
    ssh: np.ndarray,
    uo: np.ndarray,
    vo: np.ndarray,
    uw: np.ndarray,
    vw: np.ndarray,
    lats: np.ndarray,
    lons: np.ndarray,
    doy: int | float,
    res_deg: float = 0.25,
) -> Dict[str, np.ndarray]:
    """Assemble all 15 surface feature channels for a given snapshot.

    Channels:
      7 observation channels: sst, sss, ssh, uo, vo, uw, vw
      4 derived geophysical channels: curl_tau, div_uv, sst_grad_x, sst_grad_y
      4 coordinate / temporal channels: lat_sin, lon_cos, doy_sin, doy_cos

    Returns:
        Dict mapping channel name to 2D np.ndarray of shape (H, W).
    """
    # 4 Derived geophysical channels
    curl = wind_stress_curl(uw, vw, lats, res_deg=res_deg)
    div = surface_divergence(uo, vo, lats, res_deg=res_deg)
    grad_x, grad_y = sst_gradients(sst, lats, res_deg=res_deg)

    # 4 Coordinate channels
    lat_sin, lon_cos, doy_sin, doy_cos = coordinate_channels(lats, lons, doy)

    features = {
        "sst": np.asarray(sst, dtype=np.float32),
        "sss": np.asarray(sss, dtype=np.float32),
        "ssh": np.asarray(ssh, dtype=np.float32),
        "uo": np.asarray(uo, dtype=np.float32),
        "vo": np.asarray(vo, dtype=np.float32),
        "uw": np.asarray(uw, dtype=np.float32),
        "vw": np.asarray(vw, dtype=np.float32),
        "curl_tau": curl,
        "div_uv": div,
        "sst_grad_x": grad_x,
        "sst_grad_y": grad_y,
        "lat_sin": lat_sin,
        "lon_cos": lon_cos,
        "doy_sin": doy_sin,
        "doy_cos": doy_cos,
    }
    return features


if __name__ == "__main__":
    print("=" * 60)
    print("🌊 Ocean Deja Vu — Testing Feature Engineering Module")
    print("=" * 60)
    lats = np.linspace(5.0, 25.0, 81)
    lons = np.linspace(80.0, 100.0, 81)
    feats = compute_all_features(
        sst=np.ones((81, 81)) * 29.0,
        sss=np.ones((81, 81)) * 34.0,
        ssh=np.zeros((81, 81)),
        uo=np.zeros((81, 81)),
        vo=np.zeros((81, 81)),
        uw=np.ones((81, 81)) * 8.0,
        vw=np.ones((81, 81)) * 8.0,
        lats=lats,
        lons=lons,
        doy=145,
    )
    print(f"Successfully computed all {len(feats)} feature channels:")
    for k, v in feats.items():
        print(f"  • {k:<12}: shape {v.shape}, mean = {float(v.mean()):.4f}")
    print("✅ All 15 channels assembled cleanly!")
    print("=" * 60)

