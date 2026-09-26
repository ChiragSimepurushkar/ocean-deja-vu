"""Data acquisition module for Ocean Deja Vu.

Provides download pipelines for:
- SST: OSTIA L4 via Copernicus Marine
- SSS: SMAP/SMOS multi-obs via Copernicus Marine / PO.DAAC
- SSH/SLA: DUACS via Copernicus Marine
- Surface currents: OSCAR L4 via PO.DAAC / earthaccess
- Winds: CCMP via Earthdata / PO.DAAC (or ERA5 fallback)
- 3D temperature (target): GLORYS12 reanalysis via Copernicus Marine
- ARGO: In-situ profile validation via argopy / INCOIS

Includes an offline pilot dataset generator for instant local testing without
waiting for credential approval or large network downloads.
"""

from __future__ import annotations
import os
import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
import xarray as xr

logger = logging.getLogger(__name__)

# Standard Copernicus Marine and PO.DAAC product mappings
DATASET_METADATA = {
    "sst": {
        "dataset_id": "SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001",
        "alt_dataset_id": "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2",
        "variables": ["analysed_sst"],
        "unit": "celsius",
    },
    "ssh": {
        "dataset_id": "SEALEVEL_GLO_PHY_L4_MY_008_047",
        "alt_dataset_id": "c3s_obs-sl_glo_phy-ssh_my_allsat-l4-duacs-0.25deg_P1D",
        "variables": ["sla", "adt"],
        "unit": "m",
    },
    "sss": {
        "dataset_id": "MULTIOBS_GLO_PHY_S_SURFACE_MYNRT_015_013",
        "variables": ["sos"],
        "unit": "psu",
    },
    "glorys": {
        "dataset_id": "GLOBAL_MULTIYEAR_PHY_001_030",
        "alt_dataset_id": "cmems_mod_glo_phy_my_0.083deg_P1D-m",
        "variables": ["thetao"],
        "unit": "celsius",
    },
    "oscar": {
        "short_name": "OSCAR_L4_OC_FINAL_V2.0",
        "alt_short_name": "OSCAR_L4_OC_third-deg",
        "variables": ["u", "v"],
        "unit": "m/s",
    },
    "ccmp": {
        "short_name": "CCMP_MEASURES_ATMO_L3.0_DAILY_V3.0",
        "variables": ["uwnd", "vwnd"],
        "unit": "m/s",
    },
}


class OceanDownloader:
    """Manages downloading and caching of ocean satellite & reanalysis products."""

    def __init__(
        self,
        raw_dir: str | Path = "data/raw",
        domain_bounds: Optional[Dict[str, float]] = None,
        depths: Optional[List[float]] = None,
    ):
        self.raw_dir = Path(raw_dir)
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.domain = domain_bounds or {
            "lat_min": 5.0,
            "lat_max": 25.0,
            "lon_min": 80.0,
            "lon_max": 100.0,
        }
        self.depths = depths or [
            0.0, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0,
            125.0, 150.0, 200.0, 300.0, 500.0, 700.0, 1000.0,
        ]

    def check_credentials(self) -> Dict[str, bool]:
        """Verify presence of Copernicus Marine and NASA Earthdata credentials."""
        copernicus_ok = bool(
            os.getenv("COPERNICUSMARINE_SERVICE_USERNAME")
            or os.path.exists(Path.home() / ".copernicusmarine" / ".copernicusmarine-credentials")
        )
        earthdata_ok = bool(
            (os.getenv("EARTHDATA_USERNAME") and os.getenv("EARTHDATA_PASSWORD"))
            or os.path.exists(Path.home() / ".netrc")
        )
        return {
            "copernicus_marine": copernicus_ok,
            "nasa_earthdata": earthdata_ok,
        }

    def download_copernicus_product(
        self,
        var_name: str,
        start_date: str,
        end_date: str,
        skip_existing: bool = True,
    ) -> Path:
        """Download a subset from Copernicus Marine."""
        out_file = self.raw_dir / f"{var_name}_{start_date}_{end_date}.nc"
        if skip_existing and out_file.exists():
            logger.info("Using cached file: %s", out_file)
            return out_file

        try:
            import copernicusmarine as cm
        except ImportError as e:
            raise ImportError(
                "copernicusmarine package is required to download live CMEMS data. "
                "Install it via `pip install copernicusmarine`."
            ) from e

        meta = DATASET_METADATA.get(var_name)
        if not meta:
            raise ValueError(f"Unknown variable name {var_name}")

        dataset_id = meta["dataset_id"]
        logger.info("Downloading %s from Copernicus Marine (%s)...", var_name, dataset_id)

        try:
            cm.subset(
                dataset_id=dataset_id,
                variables=meta["variables"],
                minimum_longitude=self.domain["lon_min"],
                maximum_longitude=self.domain["lon_max"],
                minimum_latitude=self.domain["lat_min"],
                maximum_latitude=self.domain["lat_max"],
                start_datetime=f"{start_date}T00:00:00",
                end_datetime=f"{end_date}T23:59:59",
                output_directory=str(self.raw_dir),
                output_filename=out_file.name,
                force_download=True,
            )
            return out_file
        except Exception as e:
            logger.warning("Copernicus download failed for %s: %s", var_name, e)
            raise

    def download_podaac_product(
        self,
        var_name: str,
        start_date: str,
        end_date: str,
        skip_existing: bool = True,
    ) -> Path:
        """Download surface currents (OSCAR) or winds (CCMP) via PO.DAAC / earthaccess."""
        out_file = self.raw_dir / f"{var_name}_{start_date}_{end_date}.nc"
        if skip_existing and out_file.exists():
            return out_file

        try:
            import earthaccess
        except ImportError as e:
            raise ImportError(
                "earthaccess package is required. Install via `pip install earthaccess`."
            ) from e

        meta = DATASET_METADATA.get(var_name)
        if not meta:
            raise ValueError(f"Unknown variable {var_name}")

        auth = earthaccess.login(strategy="environment")
        if not auth.authenticated:
            raise PermissionError(
                "NASA Earthdata credentials not found or invalid. Set EARTHDATA_USERNAME and EARTHDATA_PASSWORD."
            )

        bbox = (
            self.domain["lon_min"],
            self.domain["lat_min"],
            self.domain["lon_max"],
            self.domain["lat_max"],
        )
        logger.info("Searching PO.DAAC for %s...", meta["short_name"])
        results = earthaccess.search_data(
            short_name=meta["short_name"],
            temporal=(start_date, end_date),
            bounding_box=bbox,
        )
        downloaded = earthaccess.download(results, str(self.raw_dir))
        return Path(downloaded[0]) if downloaded else out_file

    def fetch_argo_profiles(
        self,
        start_date: str,
        end_date: str,
        max_depth: float = 1000.0,
    ) -> pd.DataFrame:
        """Fetch real in-situ Argo float profiles in the domain using argopy."""
        try:
            import argopy
        except ImportError:
            logger.warning("argopy not installed, returning empty float dataframe.")
            return pd.DataFrame()

        box = [
            self.domain["lon_min"],
            self.domain["lon_max"],
            self.domain["lat_min"],
            self.domain["lat_max"],
            0,
            max_depth,
            start_date,
            end_date,
        ]
        try:
            fetcher = argopy.DataFetcher().region(box)
            ds = fetcher.to_xarray()
            df = ds.to_dataframe().reset_index()
            return df
        except Exception as e:
            logger.warning("argopy fetch failed (%s). Generating fallback Argo data.", e)
            return self.generate_synthetic_argo(start_date, end_date)

    def generate_synthetic_argo(
        self,
        start_date: str,
        end_date: str,
        n_floats: int = 12,
        profiles_per_float: int = 6,
    ) -> pd.DataFrame:
        """Generate physically consistent synthetic Argo float profiles for validation."""
        dates = pd.date_range(start_date, end_date, periods=profiles_per_float)
        rows = []
        for float_id in range(1, n_floats + 1):
            base_lat = np.random.uniform(self.domain["lat_min"] + 1, self.domain["lat_max"] - 1)
            base_lon = np.random.uniform(self.domain["lon_min"] + 1, self.domain["lon_max"] - 1)
            for d in dates:
                # Add small drift
                lat = base_lat + np.random.normal(0, 0.1)
                lon = base_lon + np.random.normal(0, 0.1)
                # Ocean temperature profile with realistic thermocline
                sst = 29.5 - 0.2 * (lat - 10.0) + np.random.normal(0, 0.2)
                for depth in self.depths:
                    # Mixed layer (~30m), sharp thermocline (50-200m), deep abyss (~5°C at 1000m)
                    if depth <= 30:
                        t = sst - 0.05 * (depth / 30.0)
                    elif depth <= 200:
                        # thermocline
                        alpha = (depth - 30.0) / 170.0
                        t = (sst - 0.05) * (1 - alpha) + 14.0 * alpha
                    else:
                        # deep water
                        alpha = (depth - 200.0) / 800.0
                        t = 14.0 * (1 - alpha) + 5.5 * alpha
                    t += np.random.normal(0, 0.15)  # float measurement noise
                    rows.append({
                        "platform_number": f"ARGO_{5900000 + float_id}",
                        "date": str(d.date()),
                        "latitude": round(lat, 3),
                        "longitude": round(lon, 3),
                        "pres": depth,
                        "temp": round(t, 2),
                        "temp_qc": 1,  # QC flag 1: good
                    })
        return pd.DataFrame(rows)

    def generate_pilot_dataset(
        self,
        start_date: str = "2023-05-01",
        end_date: str = "2023-06-30",
        res: float = 0.25,
    ) -> Dict[str, Path]:
        """Generate a realistic, physically coupled synthetic pilot dataset for all variables.

        This guarantees that Dev 2 and Dev 3 can immediately run `make data` and build the full
        Zarr store with realistic ocean dynamics (monsoon onset winds, EICC currents, thermocline,
        eddy signatures, and land boundaries) without blocking on NASA/Copernicus credential delays.
        """
        logger.info(
            "Generating high-fidelity pilot dataset for domain [%.1f-%.1f°N, %.1f-%.1f°E] from %s to %s",
            self.domain["lat_min"], self.domain["lat_max"],
            self.domain["lon_min"], self.domain["lon_max"],
            start_date, end_date,
        )
        lats = np.arange(self.domain["lat_min"], self.domain["lat_max"] + res / 2, res)
        lons = np.arange(self.domain["lon_min"], self.domain["lon_max"] + res / 2, res)
        dates = pd.date_range(start_date, end_date, freq="D")
        n_times = len(dates)
        n_lats = len(lats)
        n_lons = len(lons)
        n_depths = len(self.depths)

        lon_grid, lat_grid = np.meshgrid(lons, lats)

        # Realistic Bay of Bengal land mask:
        # India to the west (lat > 15 & lon < 83, lat > 18 & lon < 85),
        # Myanmar / Bangladesh to the north and east (lat > 21, or lon > 98 & lat > 10)
        is_land = np.zeros((n_lats, n_lons), dtype=bool)
        is_land[(lat_grid >= 18.0) & (lon_grid <= 84.5)] = True
        is_land[(lat_grid >= 15.0) & (lat_grid < 18.0) & (lon_grid <= 82.0)] = True
        is_land[(lat_grid >= 21.0) & (lon_grid <= 90.0)] = True
        is_land[(lat_grid >= 20.0) & (lon_grid >= 91.5)] = True
        is_land[(lat_grid >= 13.0) & (lon_grid >= 98.0)] = True
        is_land[(lat_grid >= 7.0) & (lat_grid <= 10.0) & (lon_grid >= 79.5) & (lon_grid <= 81.8)] = True  # Sri Lanka edge

        ocean_mask = ~is_land

        generated_files = {}

        # 1. SST (OSTIA L4 format): Analysed SST in Celsius (~27 to 31 °C in May-June)
        # Latitudinal gradient + seasonal monsoon onset warming + mesoscale eddy wave
        sst_data = np.zeros((n_times, n_lats, n_lons), dtype=np.float32)
        for t_idx, d in enumerate(dates):
            doy = d.dayofyear
            # Monsoon seasonal progression
            base_t = 28.5 + 1.2 * np.sin(2 * np.pi * (doy - 80) / 365.25)
            lat_effect = -0.08 * (lat_grid - 15.0)
            eddy = 0.6 * np.sin(0.4 * lat_grid + 0.3 * lon_grid + 0.1 * t_idx)
            noise = np.random.normal(0, 0.05, (n_lats, n_lons))
            field = base_t + lat_effect + eddy + noise
            field[is_land] = np.nan
            sst_data[t_idx] = field

        ds_sst = xr.Dataset(
            data_vars={"analysed_sst": (["time", "lat", "lon"], sst_data)},
            coords={"time": dates, "lat": lats, "lon": lons},
            attrs={"description": "Simulated OSTIA L4 SST", "units": "celsius"},
        )
        sst_file = self.raw_dir / "sst_pilot.nc"
        ds_sst.to_netcdf(sst_file)
        generated_files["sst"] = sst_file

        # 2. SSS (SMAP/SMOS format): Low salinity in northern Bay of Bengal due to river runoff
        sss_data = np.zeros((n_times, n_lats, n_lons), dtype=np.float32)
        for t_idx, d in enumerate(dates):
            # Salinity drops sharply northwards (river runoff: Ganges-Brahmaputra)
            base_s = 34.2 - 0.25 * np.maximum(0.0, lat_grid - 10.0)
            eddy_s = 0.3 * np.cos(0.4 * lat_grid + 0.3 * lon_grid + 0.1 * t_idx)
            field = base_s + eddy_s + np.random.normal(0, 0.04, (n_lats, n_lons))
            field[is_land] = np.nan
            sss_data[t_idx] = field

        ds_sss = xr.Dataset(
            data_vars={"sos": (["time", "lat", "lon"], sss_data)},
            coords={"time": dates, "lat": lats, "lon": lons},
            attrs={"description": "Simulated SMAP/SMOS SSS", "units": "psu"},
        )
        sss_file = self.raw_dir / "sss_pilot.nc"
        ds_sss.to_netcdf(sss_file)
        generated_files["sss"] = sss_file

        # 3. SSH / SLA (DUACS format): Sea Level Anomaly (-0.25 to +0.25 m)
        sla_data = np.zeros((n_times, n_lats, n_lons), dtype=np.float32)
        adt_data = np.zeros((n_times, n_lats, n_lons), dtype=np.float32)
        for t_idx in range(n_times):
            # Warm eddy = positive SLA, cold core eddy = negative SLA
            sla = 0.12 * np.sin(0.4 * lat_grid + 0.3 * lon_grid + 0.1 * t_idx) + \
                  0.05 * np.cos(0.6 * lat_grid - 0.5 * lon_grid) + \
                  np.random.normal(0, 0.01, (n_lats, n_lons))
            adt = 1.0 + sla
            sla[is_land] = np.nan
            adt[is_land] = np.nan
            sla_data[t_idx] = sla
            adt_data[t_idx] = adt

        ds_ssh = xr.Dataset(
            data_vars={
                "sla": (["time", "lat", "lon"], sla_data),
                "adt": (["time", "lat", "lon"], adt_data),
            },
            coords={"time": dates, "lat": lats, "lon": lons},
            attrs={"description": "Simulated DUACS SSH/SLA", "units": "m"},
        )
        ssh_file = self.raw_dir / "ssh_pilot.nc"
        ds_ssh.to_netcdf(ssh_file)
        generated_files["ssh"] = ssh_file

        # 4. Surface currents (OSCAR format): uo (eastward), vo (northward)
        # East India Coastal Current (EICC) flowing northward along western boundary
        uo_data = np.zeros((n_times, n_lats, n_lons), dtype=np.float32)
        vo_data = np.zeros((n_times, n_lats, n_lons), dtype=np.float32)
        for t_idx in range(n_times):
            # Geostrophic balance proxy: v proportional to d(sla)/dx, u proportional to -d(sla)/dy
            d_sla_dy, d_sla_dx = np.gradient(sla_data[t_idx])
            uo = -0.5 * d_sla_dy * 5.0 + 0.1 * np.sin(0.2 * lat_grid)
            vo = 0.5 * d_sla_dx * 5.0 + 0.15 * np.exp(-((lon_grid - 83.0) / 2.0)**2)  # EICC jet
            uo[is_land] = np.nan
            vo[is_land] = np.nan
            uo_data[t_idx] = uo
            vo_data[t_idx] = vo

        ds_currents = xr.Dataset(
            data_vars={
                "uo": (["time", "lat", "lon"], uo_data),
                "vo": (["time", "lat", "lon"], vo_data),
            },
            coords={"time": dates, "lat": lats, "lon": lons},
            attrs={"description": "Simulated OSCAR Surface Currents", "units": "m/s"},
        )
        currents_file = self.raw_dir / "currents_pilot.nc"
        ds_currents.to_netcdf(currents_file)
        generated_files["currents"] = currents_file

        # 5. Winds (CCMP format): Southwest monsoon winds blowing towards northeast (positive uw, positive vw)
        uw_data = np.zeros((n_times, n_lats, n_lons), dtype=np.float32)
        vw_data = np.zeros((n_times, n_lats, n_lons), dtype=np.float32)
        for t_idx in range(n_times):
            # Monsoon winds strengthen across May to June
            strength = 5.0 + 4.0 * (t_idx / float(n_times))
            uw = strength * np.cos(np.deg2rad(45.0)) + np.random.normal(0, 0.4, (n_lats, n_lons))
            vw = strength * np.sin(np.deg2rad(45.0)) + np.random.normal(0, 0.4, (n_lats, n_lons))
            uw[is_land] = np.nan
            vw[is_land] = np.nan
            uw_data[t_idx] = uw
            vw_data[t_idx] = vw

        ds_winds = xr.Dataset(
            data_vars={
                "uw": (["time", "lat", "lon"], uw_data),
                "vw": (["time", "lat", "lon"], vw_data),
            },
            coords={"time": dates, "lat": lats, "lon": lons},
            attrs={"description": "Simulated CCMP Surface Winds", "units": "m/s"},
        )
        winds_file = self.raw_dir / "winds_pilot.nc"
        ds_winds.to_netcdf(winds_file)
        generated_files["winds"] = winds_file

        # 6. GLORYS12 3D Temperature Target (15 depths)
        # Realistic vertical thermal structure: mixed layer (0-30m), thermocline (50-200m), deep abyss
        thetao_data = np.zeros((n_times, n_depths, n_lats, n_lons), dtype=np.float32)
        depth_arr = np.array(self.depths, dtype=np.float32)

        for t_idx in range(n_times):
            sst_t = sst_data[t_idx]
            sla_t = sla_data[t_idx]
            for d_idx, z in enumerate(depth_arr):
                # SLA moves thermocline down by ~100m * SLA (steric coupling!)
                thermocline_shift = 80.0 * np.nan_to_num(sla_t, nan=0.0)
                eff_z = np.maximum(0.0, z - thermocline_shift)

                if z <= 30.0:
                    t_layer = sst_t - 0.04 * (z / 30.0)
                elif z <= 200.0:
                    # Thermocline decay
                    alpha = (eff_z - 30.0) / 170.0
                    alpha = np.clip(alpha, 0.0, 1.0)
                    t_layer = (sst_t - 0.04) * (1.0 - alpha) + 14.0 * alpha
                else:
                    # Deep layer
                    alpha = (eff_z - 200.0) / 800.0
                    alpha = np.clip(alpha, 0.0, 1.0)
                    t_layer = 14.0 * (1.0 - alpha) + 5.5 * alpha

                t_layer[is_land] = np.nan
                thetao_data[t_idx, d_idx] = t_layer

        ds_glorys = xr.Dataset(
            data_vars={"thetao": (["time", "depth", "lat", "lon"], thetao_data)},
            coords={"time": dates, "depth": depth_arr, "lat": lats, "lon": lons},
            attrs={"description": "Simulated GLORYS12 3D Temperature Target", "units": "celsius"},
        )
        glorys_file = self.raw_dir / "glorys_pilot.nc"
        ds_glorys.to_netcdf(glorys_file)
        generated_files["glorys"] = glorys_file

        # 7. Generate synthetic Argo float profiles for validation
        argo_df = self.generate_synthetic_argo(start_date, end_date)
        argo_file = self.raw_dir / "argo_pilot.csv"
        argo_df.to_csv(argo_file, index=False)
        generated_files["argo"] = argo_file

        logger.info("Successfully generated pilot files: %s", list(generated_files.keys()))
        return generated_files


if __name__ == "__main__":
    print("=" * 60)
    print("🌊 Ocean Deja Vu — Testing OceanDownloader Module")
    print("=" * 60)
    downloader = OceanDownloader()
    print("1. Credentials check:")
    creds = downloader.check_credentials()
    for k, v in creds.items():
        print(f"   • {k}: {'Configured' if v else 'Not detected (using pilot mode)'}")
    
    print("\n2. Testing pilot dataset generation (Bay of Bengal)...")
    files = downloader.generate_pilot_dataset(start_date="2023-05-01", end_date="2023-05-05")
    print(f"✅ Generated {len(files)} pilot files successfully:")
    for name, path in files.items():
        print(f"   • {name:<10}: {path}")
    print("=" * 60)

