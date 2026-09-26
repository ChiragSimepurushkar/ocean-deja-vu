"""
src/evaluation/metrics.py
--------------------------
RMSE, bias, and Pearson correlation skill metrics for the Ocean Deja Vu
validation framework.

All metrics are reported:
  - Per depth level (all 15 standard depths)
  - Per season (DJF, MAM, JJA, SON, and 'annual')
  - Per basin (full domain, Bay of Bengal, Arabian Sea)

Output is always a pandas DataFrame so results can be logged to W&B as tables
and rendered in the Streamlit dashboard.

Depth levels:  [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
Seasons: DJF (Dec-Jan-Feb), MAM (Mar-Apr-May), JJA (Jun-Jul-Aug), SON (Sep-Oct-Nov)

Basins (approximate bounding boxes):
  Bay of Bengal  : lat 5–22°N, lon 80–100°E
  Arabian Sea    : lat 5–25°N, lon 45–78°E
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Optional


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

SEASONS: dict[str, list[int]] = {
    "DJF": [12, 1, 2],
    "MAM": [3, 4, 5],
    "JJA": [6, 7, 8],
    "SON": [9, 10, 11],
}

BASINS: dict[str, dict] = {
    "full_domain":  {"lat": (5, 30),   "lon": (45, 105)},
    "bay_of_bengal": {"lat": (5, 22),  "lon": (80, 100)},
    "arabian_sea":   {"lat": (5, 25),  "lon": (45, 78)},
}


# ──────────────────────────────────────────────────────────────────────────────
# Core scalar metrics
# ──────────────────────────────────────────────────────────────────────────────

def rmse(pred: np.ndarray, obs: np.ndarray) -> float:
    valid = ~np.isnan(obs) & ~np.isnan(pred)
    if valid.sum() == 0:
        return float("nan")
    return float(np.sqrt(np.mean((pred[valid] - obs[valid]) ** 2)))


def bias(pred: np.ndarray, obs: np.ndarray) -> float:
    valid = ~np.isnan(obs) & ~np.isnan(pred)
    if valid.sum() == 0:
        return float("nan")
    return float(np.mean(pred[valid] - obs[valid]))


def correlation(pred: np.ndarray, obs: np.ndarray) -> float:
    valid = ~np.isnan(obs) & ~np.isnan(pred)
    if valid.sum() < 3:
        return float("nan")
    return float(np.corrcoef(pred[valid], obs[valid])[0, 1])


# ──────────────────────────────────────────────────────────────────────────────
# Season / basin filters
# ──────────────────────────────────────────────────────────────────────────────

def _season_mask(months: np.ndarray, season: str) -> np.ndarray:
    """Return boolean mask for rows whose month falls in `season`."""
    if season == "annual":
        return np.ones(len(months), dtype=bool)
    return np.isin(months, SEASONS[season])


def _basin_mask(
    lats: np.ndarray, lons: np.ndarray, basin: str
) -> np.ndarray:
    b = BASINS[basin]
    return (
        (lats >= b["lat"][0]) & (lats <= b["lat"][1]) &
        (lons >= b["lon"][0]) & (lons <= b["lon"][1])
    )


# ──────────────────────────────────────────────────────────────────────────────
# Main skill table
# ──────────────────────────────────────────────────────────────────────────────

def compute_skill(
    pred: np.ndarray,         # (N, n_depths) predictions in °C
    obs:  np.ndarray,         # (N, n_depths) ARGO observations in °C
    months: np.ndarray,       # (N,) integer month (1–12)
    lats:   np.ndarray,       # (N,) latitude of each profile
    lons:   np.ndarray,       # (N,) longitude of each profile
    depths: list[int] | None = None,
    seasons: list[str] | None = None,
    basins:  list[str] | None = None,
) -> pd.DataFrame:
    """
    Compute RMSE, bias, and correlation for every combination of
    (depth, season, basin).

    Parameters
    ----------
    pred   : (N, n_depths) model predictions
    obs    : (N, n_depths) observed temperatures
    months : (N,) observation months (1–12)
    lats   : (N,) observation latitudes
    lons   : (N,) observation longitudes
    depths : which depth levels to report (default: all 15)
    seasons: which seasons (default: all 4 + annual)
    basins : which basins (default: full + BoB + AS)

    Returns
    -------
    pd.DataFrame with columns: depth, season, basin, n_obs, rmse, bias, corr
    """
    depths  = depths  or DEPTHS
    seasons = seasons or ["annual"] + list(SEASONS.keys())
    basins  = basins  or list(BASINS.keys())

    rows = []
    for basin in basins:
        b_mask = _basin_mask(lats, lons, basin)
        for season in seasons:
            s_mask = _season_mask(months, season)
            combined = b_mask & s_mask
            if combined.sum() == 0:
                continue
            for d_idx, depth in enumerate(depths):
                p = pred[combined, d_idx]
                o = obs[combined, d_idx]
                rows.append({
                    "depth":  depth,
                    "season": season,
                    "basin":  basin,
                    "n_obs":  int((~np.isnan(o)).sum()),
                    "rmse":   rmse(p, o),
                    "bias":   bias(p, o),
                    "corr":   correlation(p, o),
                })

    df = pd.DataFrame(rows)
    return df


# ──────────────────────────────────────────────────────────────────────────────
# Convenience: RMSE-vs-depth array (for quick plots)
# ──────────────────────────────────────────────────────────────────────────────

def rmse_profile(pred: np.ndarray, obs: np.ndarray) -> np.ndarray:
    """
    Compute RMSE at each depth level independently.

    Parameters
    ----------
    pred, obs : (N, n_depths)

    Returns
    -------
    (n_depths,) array of RMSE values
    """
    return np.array([
        rmse(pred[:, i], obs[:, i]) for i in range(pred.shape[1])
    ])


# ──────────────────────────────────────────────────────────────────────────────
# Model comparison table (for ablation section)
# ──────────────────────────────────────────────────────────────────────────────

def compare_models(
    predictions: dict[str, np.ndarray],   # model_name → (N, n_depths)
    obs:  np.ndarray,
    months: np.ndarray,
    lats:   np.ndarray,
    lons:   np.ndarray,
) -> pd.DataFrame:
    """
    Run compute_skill for multiple models and concatenate into one table.

    Returns DataFrame with an additional 'model' column.
    """
    frames = []
    for name, pred in predictions.items():
        df = compute_skill(pred, obs, months, lats, lons)
        df["model"] = name
        frames.append(df)
    return pd.concat(frames, ignore_index=True)
