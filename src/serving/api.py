from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from src.serving import inference

app = FastAPI(title="Ocean Deja Vu API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dummy cache and data for the prototype
# In a real scenario, this would load the Zarr datasets/pre-cached files
DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

class DummyCache:
    def load_field(self, date, var):
        depth = 0
        if "temp_" in var and "m" in var:
            try:
                depth = int(var.split("_")[1].replace("m", ""))
            except:
                pass
                
        lats_grid = np.linspace(5.0, 30.0, 100)[:, None]
        lons_grid = np.linspace(45.0, 105.0, 240)[None, :]
        
        # Temperature is warmer near the equator (low lat)
        lat_effect = (30.0 - lats_grid) / 25.0 * 5.0
        
        # Exponential decay of temperature with depth (thermocline)
        depth_effect = 22.0 * np.exp(-depth / 200.0)
        
        base_temp = 5.0 + depth_effect + lat_effect
        
        # Add some smooth spatial variation
        spatial_pattern = np.sin(lons_grid / 5.0) * np.cos(lats_grid / 5.0) * 1.5
        
        # Add a tiny bit of random noise for realism
        noise = np.random.randn(100, 240) * 0.2
        
        return base_temp + spatial_pattern + noise

cache = DummyCache()
lats = np.linspace(5.0, 30.0, 100)
lons = np.linspace(45.0, 105.0, 240)

@app.get("/field/{date}")
async def get_field(
    date: str,                           # YYYY-MM-DD
    var: str = Query("temp_0m"),         # e.g. temp_100m, mld, d20, uhc
    fmt: str = Query("json"),            # json | zarr
):
    """Return a 100x240 field for the given date and variable."""
    field = cache.load_field(date, var)
    return {"lat": lats.tolist(), "lon": lons.tolist(), "data": field.tolist()}

@app.get("/profile/{date}")
async def get_profile(
    date: str,
    lat: float = Query(...),
    lon: float = Query(...),
):
    """Return a temperature profile with uncertainty and analog dates."""
    # Using dummy response for now
    pred = np.linspace(28, 5, len(DEPTHS)) + np.random.randn(len(DEPTHS))
    lo = pred - 0.5
    hi = pred + 0.5
    
    return {
        "depths": DEPTHS,
        "temp_pred": pred.tolist(),
        "temp_lo":   lo.tolist(),
        "temp_hi":   hi.tolist(),
        "analog_dates": ["2018-05-12", "2015-06-01", "2020-05-20"],
        "analog_weights": [0.5, 0.3, 0.2],
    }

@app.get("/diagnostics/{date}")
async def get_diagnostics(date: str, lat: float, lon: float):
    """MLD, thermocline depth, D20, upper heat content."""
    # Fetch dummy profile
    profile = np.linspace(28, 5, len(DEPTHS))
    
    return {
        "mld": inference.compute_mld(profile, DEPTHS),
        "thermocline_depth": 50.0, # Dummy
        "d20": inference.compute_d20(profile, DEPTHS),
        "uhc": inference.compute_uhc(profile, DEPTHS),
    }

@app.get("/transect/{date}")
async def get_transect(
    date: str,
    lat: float = Query(None, description="Provide lat for a zonal (East-West) transect"),
    lon: float = Query(None, description="Provide lon for a meridional (North-South) transect"),
    var: str = Query("temp", description="Variable to slice (temp, salt, etc.)")
):
    """Return a 2D vertical slice for the frontend heatmap."""
    # Dummy data for a 15 (depths) x 50 (points) transect
    if lat is not None:
        points = np.linspace(45.0, 105.0, 50)
        axis = "lon"
    else:
        points = np.linspace(5.0, 30.0, 50)
        axis = "lat"
        
    slice_data = np.random.randn(len(DEPTHS), len(points)) * 5 + 20
    
    return {
        "depths": DEPTHS,
        axis: points.tolist(),
        "data": slice_data.tolist()
    }

@app.get("/advisory/{date}")
async def get_advisory(date: str, lat: float, lon: float):
    """Bot/Advisory system returning natural language insights for the location."""
    # Placeholder logic for Marine Heatwave or anomalous conditions
    field = cache.load_field(date, "temp_0m")
    local_sst = field.mean() # Simplified dummy logic
    
    alerts = []
    if local_sst > 28.0:
        alerts.append("⚠️ Marine Heatwave Warning: Elevated SST detected in this region.")
    
    return {
        "summary": f"The ocean conditions at this location are currently stable with a surface temperature around {local_sst:.1f}°C.",
        "alerts": alerts,
        "recommendation": "Monitor the thermocline depth for potential acoustic or biological shifts."
    }

