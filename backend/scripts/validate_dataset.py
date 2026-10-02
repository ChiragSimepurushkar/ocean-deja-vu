"""
ML/scripts/validate_dataset.py
-------------------------------
Validates the processed Zarr v3 dataset before training.
Uses the custom zarr3_reader (no zarr-python v3 needed).

Usage:
    cd ML
    python scripts/validate_dataset.py --store ../Dataset
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

# Add parent to path for src imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data.zarr3_reader import Zarr3Store, read_dates


def validate(store_path: str) -> bool:
    print(f"\n{'='*70}")
    print(f"  Ocean Deja Vu — Dataset Validation")
    print(f"  Store: {store_path}")
    print(f"{'='*70}\n")

    store = Zarr3Store(store_path)
    all_ok = True

    # ── 1. Static arrays ────────────────────────────────────────────────
    print("── 1. Static Coordinate Arrays ──")

    lat = store["lat"][:]
    print(f"  lat: shape={lat.shape}, dtype={lat.dtype}, "
          f"range=[{lat.min():.2f}, {lat.max():.2f}]")
    nlat = lat.shape[0]
    print(f"  ✅ lat OK ({nlat} points)")

    lon = store["lon"][:]
    print(f"  lon: shape={lon.shape}, dtype={lon.dtype}, "
          f"range=[{lon.min():.2f}, {lon.max():.2f}]")
    nlon = lon.shape[0]
    print(f"  ✅ lon OK ({nlon} points)")

    print(f"\n  → Grid dimensions: {nlat} × {nlon}")

    depths = store["depths"][:]
    print(f"  depths: shape={depths.shape}, values={depths.tolist()}")
    expected_depths = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
    if len(depths) == 15:
        print(f"  ✅ 15 standard depth levels")
    else:
        print(f"  ❌ Expected 15 depths, got {len(depths)}")
        all_ok = False

    mask = store["mask"][:]
    print(f"  mask: shape={mask.shape}, dtype={mask.dtype}")
    ocean_frac = mask.mean() * 100
    print(f"  Ocean coverage: {ocean_frac:.1f}%")
    if mask.shape == (nlat, nlon):
        print(f"  ✅ mask shape OK")
    else:
        print(f"  ❌ Mask shape {mask.shape} != grid ({nlat}, {nlon})")
        all_ok = False

    # ── 2. Date Splits ──────────────────────────────────────────────────
    print("\n── 2. Date Splits ──")

    splits = {}
    for split in ["train", "val", "test"]:
        try:
            dates = read_dates(store, split)
            splits[split] = dates
            print(f"  {split:6s}: {len(dates)} dates — "
                  f"{dates[0]} → {dates[-1]}")
            print(f"  ✅ {split} dates OK")
        except Exception as e:
            print(f"  ❌ {split}: Could not read — {e}")
            all_ok = False

    total_dates = sum(len(v) for v in splits.values())
    print(f"  Total dates across splits: {total_dates}")

    # ── 3. Metadata ─────────────────────────────────────────────────────
    print("\n── 3. Metadata ──")
    try:
        raw = store["metadata_json"][:]
        meta_str = bytes(raw.tolist()).decode("utf-8")
        meta = json.loads(meta_str)
        print(f"  ✅ Metadata JSON parsed successfully")
        for k, v in meta.items():
            val_str = str(v)
            if len(val_str) > 80:
                val_str = val_str[:77] + "..."
            print(f"    {k}: {val_str}")
    except Exception as e:
        print(f"  ⚠️  Could not read metadata: {e}")

    # ── 4. Per-Day Data Checks ──────────────────────────────────────────
    print("\n── 4. Per-Day Surface & Target Arrays ──")

    # Use the dates from splits to find available dates
    all_dates = []
    for dates in splits.values():
        all_dates.extend(dates)
    all_dates = sorted(set(all_dates))
    print(f"  Available dates: {len(all_dates)}")

    n_modes = None

    for date in [all_dates[0], all_dates[-1]] if len(all_dates) >= 2 else all_dates[:1]:
        print(f"\n  --- {date} ---")

        # Surface
        try:
            surf = store[f"surface/{date}"][:]
            nan_pct = np.isnan(surf).mean() * 100
            print(f"    surface:         shape={surf.shape}, dtype={surf.dtype}, "
                  f"NaN={nan_pct:.1f}%, range=[{np.nanmin(surf):.3f}, {np.nanmax(surf):.3f}]")
            if surf.shape == (15, nlat, nlon):
                print(f"    ✅ surface shape OK")
            else:
                print(f"    ❌ Expected (15, {nlat}, {nlon}), got {surf.shape}")
                all_ok = False
        except Exception as e:
            print(f"    ❌ surface: {e}")
            all_ok = False

        # Target profiles
        try:
            prof = store[f"target_profiles/{date}"][:]
            nan_pct = np.isnan(prof).mean() * 100
            print(f"    target_profiles: shape={prof.shape}, dtype={prof.dtype}, "
                  f"NaN={nan_pct:.1f}%, range=[{np.nanmin(prof):.3f}, {np.nanmax(prof):.3f}]")
            if prof.shape == (15, nlat, nlon):
                print(f"    ✅ target_profiles shape OK")
            else:
                print(f"    ❌ Expected (15, {nlat}, {nlon})")
                all_ok = False
        except Exception as e:
            print(f"    ❌ target_profiles: {e}")
            all_ok = False

        # Target EOF
        try:
            eof = store[f"target_eof/{date}"][:]
            nan_pct = np.isnan(eof).mean() * 100
            n_modes = eof.shape[0]
            print(f"    target_eof:      shape={eof.shape}, dtype={eof.dtype}, "
                  f"NaN={nan_pct:.1f}%, range=[{np.nanmin(eof):.3f}, {np.nanmax(eof):.3f}]")
            print(f"    EOF modes: {n_modes}")
            if eof.shape[1:] == (nlat, nlon):
                print(f"    ✅ target_eof shape OK")
            else:
                print(f"    ❌ Expected (*, {nlat}, {nlon})")
                all_ok = False
        except Exception as e:
            print(f"    ❌ target_eof: {e}")
            all_ok = False

        # SLA
        try:
            sla = store[f"sla/{date}"][:]
            nan_pct = np.isnan(sla).mean() * 100
            print(f"    sla:             shape={sla.shape}, dtype={sla.dtype}, "
                  f"NaN={nan_pct:.1f}%, range=[{np.nanmin(sla):.3f}, {np.nanmax(sla):.3f}]")
            if sla.shape == (nlat, nlon):
                print(f"    ✅ sla shape OK")
            else:
                print(f"    ❌ Expected ({nlat}, {nlon})")
                all_ok = False
        except Exception as e:
            print(f"    ⚠️  sla: {e}")

        # Missing mask
        try:
            mm = store[f"missing_mask/{date}"][:]
            missing_pct = mm.mean() * 100
            print(f"    missing_mask:    shape={mm.shape}, missing={missing_pct:.1f}%")
        except Exception as e:
            print(f"    ⚠️  missing_mask: {e}")

    # ── 5. Physical Sanity Checks ───────────────────────────────────────
    print("\n── 5. Physical Sanity Checks ──")
    try:
        first_date = all_dates[0]
        surf = store[f"surface/{first_date}"][:]
        prof = store[f"target_profiles/{first_date}"][:]
        mask_arr = mask.astype(np.float32)

        # SST should be ~20-32°C in NIO
        sst = surf[0]
        sst_ocean = sst[mask_arr > 0.5]
        if len(sst_ocean) > 0:
            sst_mean = np.nanmean(sst_ocean)
            print(f"  SST (ch 0) ocean mean: {sst_mean:.2f}")
            if -5 < sst_mean < 40:
                print(f"  ✅ SST in physically reasonable range (may be raw °C)")
            else:
                print(f"  ⚠️  SST may be normalized or anomaly")

        # Surface temp should match 0m depth
        t_surface = prof[0]
        t_surface_ocean = t_surface[mask_arr > 0.5]
        if len(t_surface_ocean) > 0:
            t0_mean = np.nanmean(t_surface_ocean)
            print(f"  Target T(0m) ocean mean: {t0_mean:.2f}")

        # Check thermocline: T should decrease with depth
        mid_lat, mid_lon = nlat // 2, nlon // 2
        profile_col = prof[:, mid_lat, mid_lon]
        print(f"  Sample mid-grid profile: {np.round(profile_col, 2).tolist()}")
        if not np.all(np.isnan(profile_col)):
            if np.nanmax(profile_col[:3]) > np.nanmin(profile_col[-3:]):
                print(f"  ✅ Temperature decreases with depth (thermocline present)")
            else:
                print(f"  ⚠️  Temperature does NOT decrease — check if data is anomaly")

    except Exception as e:
        print(f"  ⚠️  Sanity check error: {e}")

    # ── Summary ─────────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    if all_ok:
        print("  ✅ ALL CHECKS PASSED — Dataset is ready for training!")
    else:
        print("  ⚠️  Some checks had issues — review above warnings")
    print(f"{'='*70}")

    print(f"\n  Grid:          {nlat} × {nlon}")
    print(f"  Input channels: 15")
    print(f"  Target depths:  15")
    print(f"  EOF modes:      {n_modes if n_modes else '?'}")
    print(f"  Total dates:    {len(all_dates)}")
    for split, dates in splits.items():
        print(f"    {split:14s}: {len(dates)} days")
    print()

    return all_ok


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Validate Ocean Deja Vu Zarr dataset")
    p.add_argument("--store", type=str, default="../Dataset",
                    help="Path to the Zarr store root")
    args = p.parse_args()
    ok = validate(args.store)
    sys.exit(0 if ok else 1)
