import os
import logging
from datetime import datetime, timedelta
from src.data.download import OceanDownloader

logging.basicConfig(level=logging.INFO)

# 1. Set dates to the past 7 days
end_date = datetime.utcnow().strftime("%Y-%m-%d")
start_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")

print(f"Downloading data from {start_date} to {end_date}")

# 2. Define the full globe bounding box
global_domain = {
    "lat_min": -90.0,
    "lat_max": 90.0,
    "lon_min": -180.0,
    "lon_max": 180.0,
}

# 3. Initialize your existing downloader
downloader = OceanDownloader(
    raw_dir="data/raw_global",
    domain_bounds=global_domain,
)

creds = downloader.check_credentials()
if not (creds["copernicus_marine"] and creds["nasa_earthdata"]):
    print("⚠️ Warning: Missing credentials!")
    print("Please export COPERNICUSMARINE_SERVICE_USERNAME, COPERNICUSMARINE_SERVICE_PASSWORD, EARTHDATA_USERNAME, and EARTHDATA_PASSWORD")
    print("Exiting...")
    exit(1)

# 4. Download ONLY the surface variables (skipping 'glorys' which is subsurface)
print("Downloading SST...")
downloader.download_copernicus_product("sst", start_date, end_date)

print("Downloading SSH (Sea Level Anomaly)...")
downloader.download_copernicus_product("ssh", start_date, end_date)

print("Downloading SSS (Sea Surface Salinity)...")
downloader.download_copernicus_product("sss", start_date, end_date)

print("Downloading Ocean Currents (OSCAR)...")
downloader.download_podaac_product("oscar", start_date, end_date)

print("Downloading Winds (CCMP)...")
downloader.download_podaac_product("ccmp", start_date, end_date)

print("✅ Global surface data downloads complete! Check the data/raw_global directory.")
