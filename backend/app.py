import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go

st.set_page_config(page_title="Ocean Deja Vu", layout="wide", page_icon="🌊")

# Custom CSS for dark "deep ocean" theme
st.markdown("""
<style>
    .stApp {
        background-color: #050b14;
        color: #e2e8f0;
    }
    .stSidebar {
        background-color: #0a1628;
    }
    /* Add teal/cyan accents */
    .stButton>button {
        background-image: linear-gradient(to right, #00d4ff, #0ea5e9, #0891b2);
        color: white;
        border: none;
    }
</style>
""", unsafe_allow_html=True)

st.title("🌊 Ocean Deja Vu")
st.subheader("Hackathon Prototype v1")

# Layout
col1, col2 = st.columns([3, 1])

with col1:
    st.markdown("### Interactive Map")
    st.info("Mapbox GL / MapLibre visualization will go here.")
    
    # Placeholder heatmap for transect view fallback
    st.markdown("### Vertical Transect View")
    # Generate some dummy data for the heatmap
    depths = np.linspace(0, 300, 15)
    lons = np.linspace(80, 100, 50)
    temp_data = np.random.randn(len(depths), len(lons)) * 5 + 20
    
    fig = go.Figure(data=go.Heatmap(
        z=temp_data,
        x=lons,
        y=depths,
        colorscale='Viridis',
        colorbar=dict(title='Temperature (°C)')
    ))
    fig.update_layout(
        title='Temperature Profile (Placeholder)',
        xaxis_title='Longitude',
        yaxis_title='Depth (m)',
        yaxis_autorange='reversed',
        template='plotly_dark'
    )
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.markdown("### Controls & Analytics")
    
    date_input = st.date_input("Select Date")
    
    st.markdown("#### Explainability: Analog Retrieval")
    st.write("Most similar past dates:")
    st.dataframe(pd.DataFrame({
        "Date": ["2018-05-12", "2015-06-01", "2020-05-20"],
        "Similarity": ["92%", "88%", "85%"]
    }))
    
    st.markdown("#### Validation Metrics")
    st.metric("Overall RMSE", "0.45 °C", "-0.05 °C")
    st.metric("Skill Score", "0.82", "+0.03")

st.markdown("---")
st.markdown("### Advisory Alerts")
st.warning("⚠️ Marine Heatwave Warning: Elevated SST detected in the Bay of Bengal.")
