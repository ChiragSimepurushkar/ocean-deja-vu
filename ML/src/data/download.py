"""
ML/src/data/download.py
-----------------------
Automated data ingestion pipeline for Ocean Deja Vu.
Downloads Copernicus Marine Service (OSTIA SST, DUACS SSH, SMAP/SMOS SSS, GLORYS reanalysis)
and NASA PO.DAAC (OSCAR surface currents, CCMP winds) datasets.

All downloads are scoped to the North Indian Ocean domain:
  lat: [4.5, 30.5] °N, lon: [44.5, 105.5] °E
  dates: 2019-01-01 to 2023-12-31 (5 years)
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Bounding box for raw downloads (padded slightly beyond target grid [5, 30]N, [45, 105]E)
BOUNDS: Dict[str, float] = {
    "min_lat": 4.5,
    "max_lat": 30.5,
    "min_lon": 44.5,
    "max_lon": 105.5,
}

# Standard 15 target depth levels
DEPTHS_15: List[float] = [
    0.0, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0, 125.0, 150.0,
    200.0, 300.0, 500.0, 700.0, 1000.0
]

COPERNICUS_PRODUCTS: Dict[str, Dict[str, Any]] = {
    "sst": {
        "dataset_id": "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2",
        "variables": ["analysed_sst"],
        "start_datetime": "2019-01-01T00:00:00",
        "end_datetime": "2023-12-31T23:59:59",
    },
    "ssh": {
        "dataset_id": "SEALEVEL_GLO_PHY_L4_MY_008_047",
        "variables": ["sla", "adt"],
        "start_datetime": "2019-01-01T00:00:00",
        "end_datetime": "2023-12-31T23:59:59",
    },
    "sss": {
        "dataset_id": "MULTIOBS_GLO_PHY_S_SURFACE_MYNRT_015_013",
        "variables": ["sos"],
        "start_datetime": "2019-01-01T00:00:00",
        "end_datetime": "2023-12-31T23:59:59",
    },
    "glorys": {
        "dataset_id": "GLOBAL_MULTIYEAR_PHY_001_030",
        "variables": ["thetao"],
        "start_datetime": "2019-01-01T00:00:00",
        "end_datetime": "2023-12-31T23:59:59",
    },
}


def download_copernicus_product(
    name: str,
    spec: Dict[str, Any],
    out_dir: str | Path,
    skip_existing: bool = True,
) -> Path:
    """Download a single product from Copernicus Marine Service via python SDK."""
    import copernicusmarine as cm

    out_path = Path(out_dir) / name
    out_path.mkdir(parents=True, exist_ok=True)
    dst_file = out_path / f"{name}.nc"

    if skip_existing and dst_file.exists():
        logger.info(f"Skipping {name}: already exists at {dst_file}")
        return dst_file

    logger.info(f"Downloading Copernicus product '{name}' (dataset_id={spec['dataset_id']})...")
    cm.subset(
        dataset_id=spec["dataset_id"],
        variables=spec["variables"],
        minimum_latitude=BOUNDS["min_lat"],
        maximum_latitude=BOUNDS["max_lat"],
        minimum_longitude=BOUNDS["min_lon"],
        maximum_longitude=BOUNDS["max_lon"],
        start_datetime=spec["start_datetime"],
        end_datetime=spec["end_datetime"],
        output_directory=str(out_path),
        output_filename=f"{name}.nc",
        force_download=True,
    )
    return dst_file


def download_oscar_currents(
    out_dir: str | Path,
    start_date: str = "2019-01-01",
    end_date: str = "2023-12-31",
    skip_existing: bool = True,
) -> Path:
    """Download OSCAR ocean surface currents from PO.DAAC via earthaccess."""
    import earthaccess

    out_path = Path(out_dir) / "oscar"
    out_path.mkdir(parents=True, exist_ok=True)

    if skip_existing and any(out_path.glob("*.nc")):
        logger.info(f"Skipping OSCAR: files already exist in {out_path}")
        return out_path

    logger.info("Authenticating with NASA Earthdata for OSCAR data...")
    earthaccess.login(strategy="environment")

    results = earthaccess.search_data(
        short_name="OSCAR_L4_OC_FINAL_V2.0",
        temporal=(start_date, end_date),
        bounding_box=(BOUNDS["min_lon"], BOUNDS["min_lat"], BOUNDS["max_lon"], BOUNDS["max_lat"]),
    )
    logger.info(f"Found {len(results)} OSCAR granules. Downloading...")
    earthaccess.download(results, str(out_path))
    return out_path


def download_ccmp_winds(
    out_dir: str | Path,
    start_date: str = "2019-01-01",
    end_date: str = "2023-12-31",
    skip_existing: bool = True,
) -> Path:
    """Download CCMP v3.0 Cross-Calibrated Multi-Platform surface winds."""
    import earthaccess

    out_path = Path(out_dir) / "ccmp"
    out_path.mkdir(parents=True, exist_ok=True)

    if skip_existing and any(out_path.glob("*.nc")):
        logger.info(f"Skipping CCMP winds: files already exist in {out_path}")
        return out_path

    logger.info("Authenticating with NASA Earthdata for CCMP winds...")
    earthaccess.login(strategy="environment")

    results = earthaccess.search_data(
        short_name="CCMP_RT_WIND_VECTOR_L4_V3.0",
        temporal=(start_date, end_date),
        bounding_box=(BOUNDS["min_lon"], BOUNDS["min_lat"], BOUNDS["max_lon"], BOUNDS["max_lat"]),
    )
    logger.info(f"Found {len(results)} CCMP granules. Downloading...")
    earthaccess.download(results, str(out_path))
    return out_path


def download_all(out_dir: str = "data/raw", skip_existing: bool = True) -> Dict[str, Path]:
    """Orchestrates all downloads for the 5-year ocean dataset."""
    dest = Path(out_dir)
    dest.mkdir(parents=True, exist_ok=True)
    downloaded = {}

    for name, spec in COPERNICUS_PRODUCTS.items():
        try:
            p = download_copernicus_product(name, spec, dest, skip_existing=skip_existing)
            downloaded[name] = p
        except Exception as e:
            logger.warning(f"Failed to download Copernicus product '{name}': {e}")

    try:
        downloaded["oscar"] = download_oscar_currents(dest, skip_existing=skip_existing)
    except Exception as e:
        logger.warning(f"Failed to download OSCAR: {e}")

    try:
        downloaded["ccmp"] = download_ccmp_winds(dest, skip_existing=skip_existing)
    except Exception as e:
        logger.warning(f"Failed to download CCMP winds: {e}")

    return downloaded


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Download satellite observations and GLORYS reanalysis")
    parser.add_argument("--out-dir", type=str, default="data/raw", help="Target output folder")
    parser.add_argument("--no-skip", action="store_true", help="Re-download existing files")
    args = parser.parse_args()

    download_all(out_dir=args.out_dir, skip_existing=not args.no_skip)
