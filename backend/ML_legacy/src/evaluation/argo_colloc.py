"""
src/evaluation/argo_colloc.py
------------------------------
ARGO profile collocation and hold-out protocol for the Ocean Deja Vu
validation framework.

Collocation logic:
  - Snap each ARGO float observation to the nearest 0.25° grid cell.
  - Interpolate ARGO profiles onto the 15 standard depth levels.
  - Apply QC flag filtering (only keep QC=1 or QC=2 observations).

Hold-out protocol (leakage prevention):
  - GLORYS assimilates ARGO, so we need to validate on ARGO that was
    unlikely to influence the GLORYS fields we trained on.
  - Two hold-out strategies:
    1. Held-out years  — entire calendar years reserved for test.
    2. Held-out boxes  — spatial regions where floats are withheld from
                         training (see argo_holdout_boxes in data.yaml).
  - Both strategies are applied together; the most conservative set is used.

Data sources (in priority order):
  1. `argopy` Python package — easiest for a hackathon, live GDAC access.
  2. INCOIS LAS netCDF files — higher resolution, offline capable.

Usage:
    from src.evaluation.argo_colloc import load_argo_argopy, collocate_to_grid

    profiles = load_argo_argopy(
        lat_bounds=(5, 30), lon_bounds=(45, 105),
        start="2023-01-01", end="2023-12-31"
    )
    collocated = collocate_to_grid(profiles)
"""

from __future__ import annotations

import warnings
from typing import Optional

import numpy as np
import pandas as pd
from scipy.interpolate import interp1d


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
GRID_LAT0, GRID_RES_LAT = 5.0, 0.25     # 5°N – 30°N
GRID_LON0, GRID_RES_LON = 45.0, 0.25    # 45°E – 105°E
GRID_NLAT, GRID_NLON = 100, 240


# ──────────────────────────────────────────────────────────────────────────────
# Loading ARGO data
# ──────────────────────────────────────────────────────────────────────────────

def load_argo_argopy(
    lat_bounds: tuple[float, float] = (5.0, 30.0),
    lon_bounds: tuple[float, float] = (45.0, 105.0),
    start: str = "2023-01-01",
    end:   str = "2023-12-31",
    pressure_max: float = 1100.0,
) -> pd.DataFrame:
    """
    Load ARGO profiles via the `argopy` package (live GDAC access).

    Returns a long-format DataFrame with columns:
        float_id, date, lat, lon, depth_m, temp_C, psal, qc_flag

    Parameters
    ----------
    lat_bounds, lon_bounds : bounding box
    start, end : ISO-8601 date strings
    pressure_max : maximum pressure (dbar ≈ m) to include
    """
    try:
        import argopy
        from argopy import DataFetcher as ArgoDataFetcher
    except ImportError:
        raise ImportError("Install argopy: `pip install argopy`")

    argopy.set_options(src="gdac")

    argo_fetch = ArgoDataFetcher(
        src="gdac", mode="standard"
    ).region([
        lon_bounds[0], lon_bounds[1],
        lat_bounds[0], lat_bounds[1],
        0, pressure_max,
        start, end,
    ])

    ds = argo_fetch.to_xarray()

    df = ds[["PRES_ADJUSTED", "TEMP_ADJUSTED", "PSAL_ADJUSTED",
             "TEMP_ADJUSTED_QC", "LATITUDE", "LONGITUDE", "TIME",
             "PLATFORM_NUMBER"]].to_dataframe().reset_index(drop=True)

    df = df.rename(columns={
        "PRES_ADJUSTED":    "depth_m",
        "TEMP_ADJUSTED":    "temp_C",
        "PSAL_ADJUSTED":    "psal",
        "TEMP_ADJUSTED_QC": "qc_flag",
        "LATITUDE":         "lat",
        "LONGITUDE":        "lon",
        "TIME":             "date",
        "PLATFORM_NUMBER":  "float_id",
    })

    # Keep good-quality data (QC 1 = good, 2 = probably good)
    df = df[df["qc_flag"].isin([b"1", b"2", "1", "2", 1, 2])].copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.dropna(subset=["depth_m", "temp_C"])
    df = df[df["depth_m"] <= pressure_max]
    return df


def load_argo_incois(netcdf_path: str) -> pd.DataFrame:
    """
    Load ARGO profiles from an INCOIS LAS netCDF file.

    Expected variables: TIME, LATITUDE, LONGITUDE, PRES, TEMP, TEMP_QC.
    Returns same schema as load_argo_argopy.
    """
    import xarray as xr
    ds = xr.open_dataset(netcdf_path)

    records = []
    n_prof = ds.dims.get("N_PROF", ds.dims.get("n_prof", 0))
    n_lev  = ds.dims.get("N_LEVELS", ds.dims.get("n_levels", 0))

    for ip in range(n_prof):
        lat  = float(ds["LATITUDE"][ip].values)
        lon  = float(ds["LONGITUDE"][ip].values)
        dt   = pd.to_datetime(ds["TIME"][ip].values)
        fid  = str(ds.get("PLATFORM_NUMBER", [b"unknown"])[ip].values)
        pres = ds["PRES"][ip].values     # (n_levels,)
        temp = ds["TEMP"][ip].values     # (n_levels,)
        qc   = ds.get("TEMP_QC", ds.get("TEMPERATURE_QC"))[ip].values

        for iz in range(n_lev):
            if np.ma.is_masked(temp[iz]) or np.isnan(temp[iz]):
                continue
            records.append({
                "float_id": fid, "date": dt,
                "lat": lat, "lon": lon,
                "depth_m": float(pres[iz]),
                "temp_C":  float(temp[iz]),
                "qc_flag": int(qc[iz]) if not np.ma.is_masked(qc[iz]) else -1,
            })

    df = pd.DataFrame(records)
    df = df[df["qc_flag"].isin([1, 2])].copy()
    return df


# ──────────────────────────────────────────────────────────────────────────────
# Grid collocation
# ──────────────────────────────────────────────────────────────────────────────

def collocate_to_grid(argo_df: pd.DataFrame) -> pd.DataFrame:
    """
    Snap each ARGO profile to the nearest 0.25° grid cell and
    interpolate to the 15 standard depth levels.

    Returns a DataFrame where each row represents one (date, grid_cell)
    pair with columns: date, ilat, ilon, lat, lon, month, temp_0m, temp_5m, ...
    (one column per depth level).
    """
    # Snap to grid
    argo_df = argo_df.copy()
    argo_df["ilat"] = np.round((argo_df["lat"] - GRID_LAT0) / GRID_RES_LAT).astype(int)
    argo_df["ilon"] = np.round((argo_df["lon"] - GRID_LON0) / GRID_RES_LON).astype(int)

    # Keep only points within the NIO domain
    argo_df = argo_df[
        (argo_df["ilat"] >= 0) & (argo_df["ilat"] < GRID_NLAT) &
        (argo_df["ilon"] >= 0) & (argo_df["ilon"] < GRID_NLON)
    ].copy()

    # Interpolate to standard depths, per profile (grouped by float_id × date)
    records = []
    group_cols = ["float_id", "date", "ilat", "ilon", "lat", "lon"]
    for (fid, dt, ilat, ilon, lat, lon), g in argo_df.groupby(group_cols):
        g = g.sort_values("depth_m")
        pres = g["depth_m"].values
        temp = g["temp_C"].values

        # Need at least 3 depth levels for interpolation
        if len(pres) < 3:
            continue

        try:
            f = interp1d(pres, temp, kind="linear",
                         bounds_error=False, fill_value=np.nan)
            interp_temps = f(DEPTHS)
        except Exception:
            continue

        row = {
            "float_id": fid, "date": pd.to_datetime(dt),
            "ilat": ilat, "ilon": ilon,
            "lat": lat, "lon": lon,
            "month": pd.to_datetime(dt).month,
        }
        for d_idx, d in enumerate(DEPTHS):
            row[f"temp_{d}m"] = interp_temps[d_idx]
        records.append(row)

    result = pd.DataFrame(records)
    result["date"] = pd.to_datetime(result["date"])
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Hold-out protocol
# ──────────────────────────────────────────────────────────────────────────────

def apply_holdout(
    argo_collocated: pd.DataFrame,
    holdout_years: list[int],
    holdout_boxes: list[list[float]],   # [[lat0, lat1, lon0, lon1], ...]
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split ARGO observations into in-sample and held-out subsets.

    A profile is held out if either:
      - Its year is in `holdout_years`, OR
      - Its lat/lon falls within any `holdout_box`.

    Parameters
    ----------
    argo_collocated : output of collocate_to_grid
    holdout_years   : e.g. [2023]
    holdout_boxes   : e.g. [[10, 20, 75, 90]]

    Returns
    -------
    in_sample   : profiles NOT held out (can be used for validation tuning)
    held_out    : profiles reserved for independent test evaluation
    """
    df = argo_collocated.copy()
    df["year"] = df["date"].dt.year

    year_holdout = df["year"].isin(holdout_years)

    box_holdout = pd.Series(False, index=df.index)
    for box in holdout_boxes:
        lat0, lat1, lon0, lon1 = box
        in_box = (
            (df["lat"] >= lat0) & (df["lat"] <= lat1) &
            (df["lon"] >= lon0) & (df["lon"] <= lon1)
        )
        box_holdout |= in_box

    is_holdout = year_holdout | box_holdout
    return df[~is_holdout].copy(), df[is_holdout].copy()


# ──────────────────────────────────────────────────────────────────────────────
# Profile array extraction (for metrics.py)
# ──────────────────────────────────────────────────────────────────────────────

def to_profile_arrays(
    argo_collocated: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Extract NumPy arrays from the collocated DataFrame for use in metrics.py.

    Returns
    -------
    lats   : (N,)
    lons   : (N,)
    months : (N,) integer month
    temps  : (N, 15) temperature at each standard depth
    """
    lats   = argo_collocated["lat"].values
    lons   = argo_collocated["lon"].values
    months = argo_collocated["month"].values.astype(int)
    depth_cols = [f"temp_{d}m" for d in DEPTHS]
    temps  = argo_collocated[depth_cols].values.astype(np.float32)
    return lats, lons, months, temps
