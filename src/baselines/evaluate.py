"""Baseline evaluation and benchmarking runner.

Evaluates all 4 reference baselines:
1. Climatology Baseline
2. Persistence Baseline
3. Linear Ridge Baseline
4. Plain U-Net Baseline

Computes depth-wise RMSE, MAE, Bias, and Pearson Correlation on the test split,
and formats the Hackathon Section 5 deliverables table.
"""

from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader

from src.utils.seed import seed_everything
from src.utils.config import load_all_configs
from src.data.zarr_store import ZarrOceanStore, OceanDataset
from src.data.eof import ProfileEOF
from src.baselines.climatology import ClimatologyBaseline
from src.baselines.persistence import PersistenceBaseline
from src.baselines.linear import LinearBaseline
from src.baselines.unet import PlainUNetBaseline, train_unet_baseline

logger = logging.getLogger(__name__)


def compute_profile_metrics(
    pred: np.ndarray,
    target: np.ndarray,
    ocean_mask: np.ndarray,
    depths: List[float],
) -> Dict[str, Any]:
    """Calculate depth-wise metrics between predicted and ground-truth fields.

    Args:
        pred: (T, 15, H, W) or (15, H, W) array.
        target: (T, 15, H, W) or (15, H, W) array.
        ocean_mask: (H, W) boolean mask (True for ocean).
        depths: List of 15 depth values in meters.

    Returns:
        Dict with depth-wise RMSE, MAE, bias, correlation, and overall mean RMSE.
    """
    if pred.ndim == 3:
        pred = pred[None, ...]
        target = target[None, ...]

    T, D, H, W = pred.shape
    ocean_idx = ocean_mask > 0

    per_depth = []
    for d_i, depth_m in enumerate(depths):
        p_d = pred[:, d_i, :, :][:, ocean_idx].reshape(-1)
        t_d = target[:, d_i, :, :][:, ocean_idx].reshape(-1)

        valid = (~np.isnan(p_d)) & (~np.isnan(t_d))
        p_valid = p_d[valid]
        t_valid = t_d[valid]

        if len(p_valid) < 2:
            rmse, mae, bias, corr = 0.0, 0.0, 0.0, 1.0
        else:
            diff = p_valid - t_valid
            rmse = float(np.sqrt(np.mean(diff ** 2)))
            mae = float(np.mean(np.abs(diff)))
            bias = float(np.mean(diff))
            std_p, std_t = np.std(p_valid), np.std(t_valid)
            if std_p > 1e-6 and std_t > 1e-6:
                corr = float(np.corrcoef(p_valid, t_valid)[0, 1])
            else:
                corr = 1.0 if std_p == std_t else 0.0

        per_depth.append({
            "depth_m": float(depth_m),
            "rmse": round(float(rmse), 4),
            "mae": round(float(mae), 4),
            "bias": round(float(bias), 4),
            "corr": round(float(corr), 4),
        })

    all_rmse = [row["rmse"] for row in per_depth]
    return {
        "overall_rmse": round(float(np.mean(all_rmse)), 4),
        "surface_rmse_0m": float(per_depth[0]["rmse"]),
        "thermocline_rmse_100m": float(per_depth[7]["rmse"]) if len(per_depth) > 7 else float(per_depth[-1]["rmse"]),
        "abyss_rmse_500m": float(per_depth[12]["rmse"]) if len(per_depth) > 12 else float(per_depth[-1]["rmse"]),
        "per_depth": per_depth,
    }


def evaluate_all_baselines(
    store_path: str | Path = "data/processed/ocean_odv.zarr",
    eof_path: str | Path = "data/cache/eof_model.pkl",
    out_metrics_file: str | Path = "data/cache/baseline_metrics.json",
    train_unet: bool = True,
    unet_epochs: int = 5,
) -> Dict[str, Any]:
    """Run evaluation for all 4 baselines on the test split."""
    seed_everything(42)
    store = ZarrOceanStore(store_path, mode="r")
    mask = store.get_mask()
    depths = list(store.get_depths())
    test_dates = store.get_dates("test")
    eof_model = ProfileEOF.load(eof_path)

    logger.info("Evaluating baselines on %d test days (%s to %s)...", len(test_dates), test_dates[0], test_dates[-1])

    # Load ground truth for all test days: (N_test, 15, H, W)
    y_true_list = []
    surface_list = []
    for d_str in test_dates:
        day_data = store.get_day(d_str)
        y_true_list.append(day_data["target_profiles"])
        surface_list.append(day_data["surface"])

    y_true = np.stack(y_true_list, axis=0)  # (T, 15, H, W)
    surfaces = np.stack(surface_list, axis=0)  # (T, 15, H, W)

    results: Dict[str, Any] = {}

    # 1. Climatology Baseline
    logger.info("Evaluating [1/4] Climatology Baseline...")
    clim_model = ClimatologyBaseline()
    clim_model.fit(store, train_split="train")
    pred_clim = np.stack([clim_model.predict_field(d_str) for d_str in test_dates], axis=0)
    results["Climatology"] = compute_profile_metrics(pred_clim, y_true, mask, depths)

    # 2. Persistence Baseline
    logger.info("Evaluating [2/4] Persistence Baseline...")
    pers_model = PersistenceBaseline(store)
    pred_pers = np.stack([pers_model.predict_field(d_str, lag_days=1, zarr_store=store) for d_str in test_dates], axis=0)
    results["Persistence"] = compute_profile_metrics(pred_pers, y_true, mask, depths)

    # 3. Linear Baseline (Ridge)
    logger.info("Evaluating [3/4] Linear Ridge Baseline...")
    lin_model = LinearBaseline(alpha=1.0, eof_model=eof_model)
    lin_model.fit(store, eof_model=eof_model, train_split="train")
    pred_lin = np.stack([lin_model.predict_field(surfaces[t_i]) for t_i in range(len(test_dates))], axis=0)
    results["Linear (Ridge)"] = compute_profile_metrics(pred_lin, y_true, mask, depths)

    # 4. Plain U-Net Baseline
    logger.info("Evaluating [4/4] Plain U-Net Baseline...")
    unet_model = PlainUNetBaseline(in_channels=15, out_channels=15, init_features=16)
    if train_unet:
        ds_train = OceanDataset(store_path, split="train")
        ds_val = OceanDataset(store_path, split="val")
        train_loader = DataLoader(ds_train, batch_size=4, shuffle=True)
        val_loader = DataLoader(ds_val, batch_size=4, shuffle=False)
        train_unet_baseline(unet_model, train_loader, val_loader, epochs=unet_epochs, lr=1e-3, device="cpu")

    unet_model.eval()
    with torch.no_grad():
        x_t = torch.nan_to_num(torch.from_numpy(surfaces).float(), nan=0.0)
        pred_unet = unet_model(x_t).numpy()
        pred_unet[:, :, mask == 0] = np.nan
    results["Plain U-Net"] = compute_profile_metrics(pred_unet, y_true, mask, depths)

    # Save metrics JSON
    out_file = Path(out_metrics_file)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=float)

    # Print Formatted Markdown Comparison Table
    print("\n" + "=" * 70)
    print("           OCEAN DEJA VU — BASELINE BENCHMARK RESULTS")
    print("=" * 70)
    print(f"{'Model':<18} | {'Mean RMSE':<10} | {'RMSE @ 0m':<10} | {'RMSE @ 100m':<12} | {'RMSE @ 500m':<12}")
    print("-" * 70)
    for model_name, m in results.items():
        print(f"{model_name:<18} | {m['overall_rmse']:<10.4f} | {m['surface_rmse_0m']:<10.4f} | {m['thermocline_rmse_100m']:<12.4f} | {m['abyss_rmse_500m']:<12.4f}")
    print("=" * 70 + "\n")

    return results


if __name__ == "__main__":
    evaluate_all_baselines()
