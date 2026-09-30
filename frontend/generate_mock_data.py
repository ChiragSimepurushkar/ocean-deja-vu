import json
import random
import os

days = ["2023-06-01", "2023-06-02", "2023-06-03", "2023-06-04", "2023-06-05", "2023-06-06", "2023-06-07"]

# 5-30N (100 cells), 45-105E (240 cells)
for day in days:
    data = {
        "date": day,
        "grid": { "latMin": 5, "latMax": 30, "lonMin": 45, "lonMax": 105, "resolution": 0.25 },
        "surface": {
            "sst": [[random.uniform(25, 32) for _ in range(240)] for _ in range(100)],
            "salinity": [[random.uniform(33, 36) for _ in range(240)] for _ in range(100)]
        },
        "depths": [0,5,10,20,30,50,75,100,125,150,200,300,500,700,1000],
        "reconstructed": {
            "temperature": [],
            "salinity": [],
            "currents": []
        }
    }
    
    # Fill reconstructed with mock structures (depth, lat, lon)
    # To keep size small, we'll only mock a subset or use smaller grids for 3D
    # Wait, 15 * 100 * 240 is 360,000 points. 3 parameters = ~1M points.
    # We will just fill it with empty arrays to prevent frontend crash if it just accesses a single value.
    # Actually, the probe only accesses a single lat/lon/depth index. 
    # Let's populate the full arrays for the sake of completeness.
    for d in range(15):
        data["reconstructed"]["temperature"].append([[random.uniform(2, 32) for _ in range(240)] for _ in range(100)])
        data["reconstructed"]["salinity"].append([[random.uniform(33, 36) for _ in range(240)] for _ in range(100)])
        data["reconstructed"]["currents"].append([[random.uniform(0, 1.5) for _ in range(240)] for _ in range(100)])

    with open(f'public/data/{day}.json', 'w') as f:
        json.dump(data, f)
    print(f"Generated {day}.json")
