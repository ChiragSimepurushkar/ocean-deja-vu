"""Master data pipeline for Ocean Deja Vu.

Orchestrates:
1. Downloading satellite/reanalysis data (or generating the pilot dataset)
2. Regridding to standardized 0.25° grid and calendar alignment
3. Feature engineering (curl, div, sst gradients, coordinate channels)
4. Normalization and climatology fitting
5. Profile EOF decomposition and variance validation
6. Packaging into a high-performance Zarr store with train/val/test splits

Invoked via:
    python -m src.data.pipeline
or
    make data
"""

from __future__ import annotations
import os
import sys
import argparse
import logging
from pathlib import Path
from typing import Dict, Any, List
import numpy as np
import pandas as pd
import xarray as xr

from src.utils.seed import seed_everything
from src.utils.config import load_all_configs
from src.data.download import OceanDownloader
from src.data.regrid import OceanRegridder, create_target_grid
from src.data.features import compute_all_features
from src.data.normalize import ChannelStats
from src.data.eof import ProfileEOF
from src.data.zarr_store import ZarrOceanStore, OceanDataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("OceanDataPipeline")


def run_pipeline(
    config_dir: str | Path | None = None,
    force_pilot: bool = True,
    n_eof_modes: int = 8,
) -> Path:
    """Run the complete end-to-end data pipeline."""
    seed_everything(42)
    cfg = load_all_configs(config_dir)
    data_cfg = cfg["data"]

    domain = data_cfg["domain"]
    depths = data_cfg["depths"]
    lat_min, lat_max = domain["lat"]
    lon_min, lon_max = domain["lon"]
    res = domain["res"]

    paths = data_cfg["paths"]
    raw_dir = Path(paths["raw"])
    proc_dir = Path(paths["processed"])
    cache_dir = Path(paths["cache"])
    zarr_path = Path(paths["zarr_store"])
    stats_path = Path(paths["stats_file"])
    eof_path = Path(paths["eof_file"])

    raw_dir.mkdir(parents=True, exist_ok=True)
    proc_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    logger.info("==================================================")
    logger.info("OCEAN DEJA VU — DATA & PIPELINE (DEV 1)")
    logger.info("Domain: %s (%.2f-%.2f°N, %.2f-%.2f°E, res=%.2f°)", domain["name"], lat_min, lat_max, lon_min, lon_max, res)
    logger.info("Depths: %s levels (%s m)", len(depths), depths)
    logger.info("==================================================")

    # Step 1: Data Acquisition / Pilot Generation
    downloader = OceanDownloader(
        raw_dir=raw_dir,
        domain_bounds={"lat_min": lat_min, "lat_max": lat_max, "lon_min": lon_min, "lon_max": lon_max},
        depths=depths,
    )

    creds = downloader.check_credentials()
    logger.info("Credentials check: Copernicus=%s, NASA=%s", creds["copernicus_marine"], creds["nasa_earthdata"])

    # If force_pilot or credentials missing, generate pilot dataset
    pilot_dates = data_cfg["splits"]["pilot"]
    start_date = pilot_dates["start_date"]
    end_date = pilot_dates["end_date"]

    if force_pilot or not (creds["copernicus_marine"] and creds["nasa_earthdata"]):
        logger.info("Generating pilot dataset for %s to %s...", start_date, end_date)
        raw_files = downloader.generate_pilot_dataset(start_date=start_date, end_date=end_date, res=res)
    else:
        logger.info("Attempting download from Copernicus Marine and NASA PO.DAAC...")
        try:
            raw_files = {
                "sst": downloader.download_copernicus_product("sst", start_date, end_date),
                "ssh": downloader.download_copernicus_product("ssh", start_date, end_date),
                "sss": downloader.download_copernicus_product("sss", start_date, end_date),
                "glorys": downloader.download_copernicus_product("glorys", start_date, end_date),
                "currents": downloader.download_podaac_product("oscar", start_date, end_date),
                "winds": downloader.download_podaac_product("ccmp", start_date, end_date),
            }
        except Exception as e:
            logger.warning("Live download encountered %s; falling back to pilot dataset generator.", e)
            raw_files = downloader.generate_pilot_dataset(start_date=start_date, end_date=end_date, res=res)

    # Step 2: Open Raw Datasets & Regrid to Uniform Grid
    logger.info("Step 2: Regridding fields to uniform 0.25° grid...")
    regridder = OceanRegridder(
        lat_bounds=(lat_min, lat_max),
        lon_bounds=(lon_min, lon_max),
        res=res,
    )
    target_lats = regridder.target_lats
    target_lons = regridder.target_lons

    ds_sst = xr.open_dataset(raw_files["sst"])
    ds_sss = xr.open_dataset(raw_files["sss"])
    ds_ssh = xr.open_dataset(raw_files["ssh"])
    ds_currents = xr.open_dataset(raw_files["currents"])
    ds_winds = xr.open_dataset(raw_files["winds"])
    ds_glorys = xr.open_dataset(raw_files["glorys"])

    # Regrid variables
    da_sst = regridder.regrid_dataarray(ds_sst["analysed_sst"], method="conservative")
    da_sss = regridder.regrid_dataarray(ds_sss["sos"], method="bilinear")
    da_sla = regridder.regrid_dataarray(ds_ssh["sla"], method="bilinear")
    da_uo = regridder.regrid_dataarray(ds_currents["uo"], method="bilinear")
    da_vo = regridder.regrid_dataarray(ds_currents["vo"], method="bilinear")
    da_uw = regridder.regrid_dataarray(regridder.align_calendar_and_daily_mean(ds_winds["uw"]), method="bilinear")
    da_vw = regridder.regrid_dataarray(regridder.align_calendar_and_daily_mean(ds_winds["vw"]), method="bilinear")
    da_glorys = regridder.regrid_dataarray(ds_glorys["thetao"], method="conservative")

    # Extract land-sea mask
    ocean_mask = regridder.build_land_sea_mask(da_glorys)
    logger.info("Land-Sea mask built: %d ocean pixels, %d land pixels", int(ocean_mask.sum()), int((1 - ocean_mask).sum()))

    # Time coordination
    time_coords = pd.to_datetime(da_sst["time"].values)
    date_strs = [str(t.date()) for t in time_coords]
    n_days = len(date_strs)
    logger.info("Total dates in dataset: %d (from %s to %s)", n_days, date_strs[0], date_strs[-1])

    # Split dates into train / val / test
    n_train = int(n_days * pilot_dates["train_ratio"])
    n_val = int(n_days * pilot_dates["val_ratio"])
    train_dates = date_strs[:n_train]
    val_dates = date_strs[n_train:n_train + n_val]
    test_dates = date_strs[n_train + n_val:]
    logger.info("Splits: %d train, %d val, %d test", len(train_dates), len(val_dates), len(test_dates))

    # Step 3: Compute Features for all days
    logger.info("Step 3: Computing derived geophysical and coordinate features...")
    channel_names = [
        "sst", "sss", "ssh", "uo", "vo", "uw", "vw",
        "curl_tau", "div_uv", "sst_grad_x", "sst_grad_y",
        "lat_sin", "lon_cos", "doy_sin", "doy_cos",
    ]

    all_surface_days = {}
    all_target_profiles = {}
    all_sla_days = {}

    for t_idx, d_str in enumerate(date_strs):
        t_val = time_coords[t_idx]
        doy = t_val.dayofyear

        sst_slice = da_sst.isel(time=t_idx).values
        sss_slice = da_sss.isel(time=t_idx).values
        sla_slice = da_sla.isel(time=t_idx).values
        uo_slice = da_uo.isel(time=t_idx).values
        vo_slice = da_vo.isel(time=t_idx).values
        uw_slice = da_uw.isel(time=t_idx).values
        vw_slice = da_vw.isel(time=t_idx).values
        prof_slice = da_glorys.isel(time=t_idx).values  # (15, H, W)

        feats = compute_all_features(
            sst=sst_slice,
            sss=sss_slice,
            ssh=sla_slice,
            uo=uo_slice,
            vo=vo_slice,
            uw=uw_slice,
            vw=vw_slice,
            lats=target_lats,
            lons=target_lons,
            doy=doy,
            res_deg=res,
        )

        # Stack into (15, H, W) tensor
        stacked_features = np.stack([feats[ch] for ch in channel_names], axis=0)

        all_surface_days[d_str] = stacked_features
        all_target_profiles[d_str] = prof_slice
        all_sla_days[d_str] = sla_slice

    # Step 4: Fit Normalization & Climatologies on Train Split
    logger.info("Step 4: Fitting channel statistics and climatologies on training split...")
    train_channel_data = {
        ch: np.stack([all_surface_days[d][c_i] for d in train_dates], axis=0)
        for c_i, ch in enumerate(channel_names)
    }

    stats = ChannelStats()
    stats.fit(train_channel_data, ocean_mask=ocean_mask, dates=[pd.to_datetime(d) for d in train_dates])
    stats.save(stats_path)

    # Step 5: Fit EOF on Training Profiles
    logger.info("Step 5: Fitting ProfileEOF (%d modes) on training profiles...", n_eof_modes)
    train_profiles = np.stack([all_target_profiles[d] for d in train_dates], axis=0)  # (N_train, 15, H, W)
    eof_model = ProfileEOF(n_modes=n_eof_modes)
    eof_model.fit(train_profiles, ocean_mask=ocean_mask)
    eof_model.save(eof_path)

    # Validate EOF reconstruction quality
    recon = eof_model.decode(eof_model.encode(train_profiles))
    valid_mask = np.broadcast_to((ocean_mask > 0)[None, None, :, :], train_profiles.shape)
    diff = (recon[valid_mask] - train_profiles[valid_mask])
    rmse = np.sqrt(np.mean(diff ** 2))
    logger.info("Profile EOF training reconstruction RMSE: %.4f °C", rmse)

    # Step 6: Write to Zarr Store
    logger.info("Step 6: Writing dataset to Zarr store at %s...", zarr_path)
    if zarr_path.exists():
        import shutil
        if zarr_path.is_dir():
            shutil.rmtree(zarr_path)
        else:
            zarr_path.unlink()

    zarr_store = ZarrOceanStore(zarr_path, mode="w")
    zarr_store.initialize_store(
        lats=target_lats,
        lons=target_lons,
        depths=np.array(depths, dtype=np.float32),
        ocean_mask=ocean_mask,
        channel_names=channel_names,
        eof_modes=eof_model.n_modes,
    )

    for d_str in date_strs:
        surface_raw = all_surface_days[d_str]  # (15, H, W)
        target_prof = all_target_profiles[d_str]  # (15, H, W)
        sla_val = all_sla_days[d_str]

        # Standardize surface features
        normed_surface = np.zeros_like(surface_raw)
        for c_i, ch in enumerate(channel_names):
            normed_surface[c_i] = stats.transform_channel(
                ch,
                surface_raw[c_i],
                is_anomaly=(ch in ["sst", "ssh"]),
            )

        # Encode target EOF coefficients
        target_eof = eof_model.encode(target_prof)  # (n_modes, H, W)
        missing_mask = np.isnan(surface_raw[0]).astype(np.float32)

        zarr_store.write_day(
            date_str=d_str,
            surface=normed_surface,
            target_profiles=target_prof,
            target_eof=target_eof,
            sla=sla_val,
            missing_mask=missing_mask,
        )

    zarr_store.set_splits(train_dates, val_dates, test_dates)

    # Step 7: Verification and PyTorch Dataset Test
    logger.info("Step 7: Verifying Zarr store with PyTorch OceanDataset...")
    ds_train = OceanDataset(zarr_path, split="train")
    ds_val = OceanDataset(zarr_path, split="val")
    ds_test = OceanDataset(zarr_path, split="test")

    logger.info("Dataset verified: train=%d, val=%d, test=%d", len(ds_train), len(ds_val), len(ds_test))
    sample_surface, sample_eof, sample_mask, sample_prof, sample_sla = ds_train[0]
    logger.info("Item 0 shapes:")
    logger.info("  surface:         %s (C_surf, H, W)", tuple(sample_surface.shape))
    logger.info("  target_eof:      %s (n_modes, H, W)", tuple(sample_eof.shape))
    logger.info("  mask:            %s (H, W)", tuple(sample_mask.shape))
    logger.info("  target_profiles: %s (15, H, W)", tuple(sample_prof.shape))
    logger.info("  sla:             %s (H, W)", tuple(sample_sla.shape))

    logger.info("==================================================")
    logger.info("DATA PIPELINE COMPLETED SUCCESSFULLY!")
    logger.info("Zarr store ready at: %s", zarr_path)
    logger.info("Stats file ready at: %s", stats_path)
    logger.info("EOF model ready at:  %s", eof_path)
    logger.info("==================================================")

    return zarr_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ocean Deja Vu Data Pipeline")
    parser.add_argument("--config-dir", type=str, default=None, help="Directory containing configs")
    parser.add_argument("--force-pilot", action="store_true", default=True, help="Force pilot dataset generation")
    parser.add_argument("--modes", type=int, default=8, help="Number of EOF modes")
    args = parser.parse_args()

    run_pipeline(
        config_dir=args.config_dir,
        force_pilot=args.force_pilot,
        n_eof_modes=args.modes,
    )
