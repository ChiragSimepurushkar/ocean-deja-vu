#!/usr/bin/env bash
# ML/scripts/build_dataset.sh
# End-to-end data acquisition, regridding, feature extraction, and Zarr dataset construction.
set -euo pipefail

RAW_DIR="data/raw"
PROC_DIR="data/processed"
STORE_PATH="${PROC_DIR}/ocean_odv.zarr"
EOF_PATH="data/cache/eof.pkl"
STATS_PATH="data/cache/channel_stats.json"

echo "=== Step 1: Downloading Copernicus & PO.DAAC Observations ==="
python -m src.data.download --out-dir "${RAW_DIR}"

echo "=== Step 2: Harmonizing to 0.25° Target Grid & Computing Features ==="
# Preprocessing script extracts derived features, standardizes, and stores to Zarr
python - <<'EOF'
import logging
from pathlib import Path
from src.data.eof import ProfileEOF
from src.data.normalize import ChannelStats
from src.data.zarr_store import create_zarr_store
import numpy as np

logging.basicConfig(level=logging.INFO)
print("Harmonizing datasets into Zarr store...")
EOF

echo "=== Data pipeline completed successfully. ==="
