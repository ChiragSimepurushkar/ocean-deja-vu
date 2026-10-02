"""
ML/demo/pages/01_map.py
-----------------------
Spatial Explorer: Interactive 2D horizontal temperature and diagnostic field maps
over the North Indian Ocean domain (5-30°N, 45-105°E).
"""

from __future__ import annotations

import datetime
import numpy as np
import plotly.graph_objects as go
import streamlit as st

from src.serving.cache_warmer import generate_mock_field
from src.serving.api import load_cached_or_mock_field
from src.serving.inference import DEPTHS, compute_d20, compute_mld, compute_thermocline, compute_uhc

st.set_page_config(page_title="Spatial Explorer | Ocean Deja Vu", layout="wide", page_icon="🗺️")

st.title("🗺️ Spatial Ocean Field Explorer")
st.caption("Inspect 0.25° subsurface thermal structure and oceanographic diagnostics.")

LATS = np.arange(5.125, 30.0, 0.25, dtype=np.float32)
LONS = np.arange(45.125, 105.0, 0.25, dtype=np.float32)

col_ctrl1, col_ctrl2, col_ctrl3 = st.columns([1, 1, 1])

with col_ctrl1:
    selected_date = st.date_input(
        "Date",
        value=datetime.date(2023, 6, 1),
        min_value=datetime.date(2019, 1, 1),
        max_value=datetime.date(2023, 12, 31),
    )

with col_ctrl2:
    view_type = st.selectbox(
        "Display Variable",
        options=["Depth Layer (°C)", "Mixed Layer Depth (m)", "D20 Isotherm Depth (m)", "Upper Ocean Heat Content (kJ/cm²)"],
        index=0,
    )

with col_ctrl3:
    if view_type == "Depth Layer (°C)":
        depth_val = st.select_slider("Depth (m)", options=DEPTHS, value=50)
        var_key = f"temp_{int(depth_val)}m"
        unit_label = "°C"
        colorscale = "Viridis" if depth_val > 200 else "Thermal"
    elif view_type == "Mixed Layer Depth (m)":
        var_key = "mld"
        unit_label = "m"
        colorscale = "Blues_r"
    elif view_type == "D20 Isotherm Depth (m)":
        var_key = "d20"
        unit_label = "m"
        colorscale = "YlOrRd_r"
    else:
        var_key = "uhc"
        unit_label = "kJ/cm²"
        colorscale = "Hot"

# Load field
doy = selected_date.timetuple().tm_yday
field_data = generate_mock_field(var_key, doy=doy)

map_col, stat_col = st.columns([3, 1])

with map_col:
    fig = go.Figure(
        data=go.Heatmap(
            z=field_data,
            x=LONS,
            y=LATS,
            colorscale=colorscale,
            colorbar=dict(title=unit_label),
            zsmooth="best",
            hoverongaps=False,
        )
    )
    fig.update_layout(
        title=f"{view_type} — {selected_date.strftime('%Y-%m-%d')} (0.25° Grid)",
        xaxis_title="Longitude (°E)",
        yaxis_title="Latitude (°N)",
        height=540,
        template="plotly_dark",
        margin=dict(l=20, r=20, t=40, b=20),
    )
    st.plotly_chart(fig, use_container_width=True)

with stat_col:
    st.markdown("### 📍 Location Probe")
    probe_lat = st.slider("Probe Latitude (°N)", 6.0, 28.0, 15.0, 0.5)
    probe_lon = st.slider("Probe Longitude (°E)", 50.0, 100.0, 85.0, 0.5)

    ilat = int(np.clip(np.round((probe_lat - 5.125) / 0.25), 0, len(LATS) - 1))
    ilon = int(np.clip(np.round((probe_lon - 45.125) / 0.25), 0, len(LONS) - 1))
    val_at_probe = field_data[ilat, ilon]

    st.markdown("#### Selected Value")
    if np.isnan(val_at_probe):
        st.warning("Selected coordinates are over land.")
    else:
        st.metric(f"Value @ ({probe_lat}°N, {probe_lon}°E)", f"{val_at_probe:.2f} {unit_label}")

    st.markdown("---")
    st.markdown("#### Basin Classification")
    if probe_lon < 77.0:
        st.success("🌊 Arabian Sea Basin")
    else:
        st.info("🌊 Bay of Bengal Basin")

    st.markdown("---")
    st.markdown("""
    **Quick Insights:**
    - High thermal gradients visible along Somali Current upwelling.
    - Bay of Bengal features strong freshwater stratification in upper 30m.
    """)
