import math
import json
import os

days = ["2023-06-01", "2023-06-02", "2023-06-03", "2023-06-04", "2023-06-05", "2023-06-06", "2023-06-07"]

# 5-30N (100 cells), 45-105E (240 cells)
for day in days:
    sst = []
    sal = []
    for y in range(100):
        lat = 5 + y * 0.25
        row_sst = []
        row_sal = []
        for x in range(240):
            lon = 45 + x * 0.25
            # Spatial smoothness based on lat/lon
            t = 28 + 3 * math.sin(lat * 0.2) + 2 * math.cos(lon * 0.1)
            s = 35 + 1 * math.sin(lon * 0.3)
            row_sst.append(t)
            row_sal.append(s)
        sst.append(row_sst)
        sal.append(row_sal)

    data = {
        "date": day,
        "grid": { "latMin": 5, "latMax": 30, "lonMin": 45, "lonMax": 105, "resolution": 0.25 },
        "surface": {
            "sst": sst,
            "salinity": sal
        },
        "depths": [0,5,10,20,30,50,75,100,125,150,200,300,500,700,1000],
        "reconstructed": {
            "temperature": [],
            "salinity": [],
            "currents": []
        }
    }
    
    for d in range(15):
        depth_factor = d / 15.0
        t_layer = []
        s_layer = []
        c_layer = []
        for y in range(100):
            lat = 5 + y * 0.25
            row_t = []
            row_s = []
            row_c = []
            for x in range(240):
                lon = 45 + x * 0.25
                t = 28 + 3 * math.sin(lat * 0.2) + 2 * math.cos(lon * 0.1) - (depth_factor * 20)
                s = 35 + 1 * math.sin(lon * 0.3)
                c = 1.0 - depth_factor * 0.8
                row_t.append(t)
                row_s.append(s)
                row_c.append(c)
            t_layer.append(row_t)
            s_layer.append(row_s)
            c_layer.append(row_c)
        data["reconstructed"]["temperature"].append(t_layer)
        data["reconstructed"]["salinity"].append(s_layer)
        data["reconstructed"]["currents"].append(c_layer)

    with open(f'public/data/{day}.json', 'w') as f:
        json.dump(data, f)
    print(f"Generated {day}.json")
