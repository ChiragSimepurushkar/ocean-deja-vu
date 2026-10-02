# Ocean Deja Vu: Data Workbench Implementation Plan

## 1. Architectural Overview
We will implement a **Dual Workspace** model. The frontend application will be split into two primary routes to separate the immersive visualization from the heavy-duty data extraction.
- `/visualizer`: The existing 3D experience (OceanMap, DiveExperience).
- `/workbench`: A new, dedicated 2D interface optimized for precision selection and data extraction.

### Tech Stack Additions
*   **Frontend:** `react-router-dom` (for tab routing), `@mapbox/mapbox-gl-draw` (for bounding box/transect selection on the map), `recharts` (for data preview charts), `papaparse` (for CSV upload parsing).
*   **Backend (FastAPI):** `pandas`, `xarray`, `netCDF4` (for generating export files).

---

## 2. Phase 1: Frontend Scaffolding & Routing
*Goal: Set up the dual-tab structure without breaking the existing app.*

1.  **Install Router:** `npm install react-router-dom` in the `frontend/` directory.
2.  **Refactor `App.tsx`:** 
    *   Create a top-level Navigation Bar with two tabs: "3D Visualizer" and "Data Workbench".
    *   Move the existing 3D components into a new `Visualizer` page component.
    *   Create a placeholder `Workbench` page component.
3.  **State Sharing:** Use a lightweight global context (or URL parameters) to share the selected date between the two views so they stay in sync when a user switches tabs.

---

## 3. Phase 2: The Data Workbench UI
*Goal: Build the 2D precision map and configuration panels.*

### A. The 2D Map (Left Panel - 70% width)
1.  Initialize a standard MapLibre map locked to a 2D top-down view (pitch: 0).
2.  Integrate `@mapbox/mapbox-gl-draw` to give users a toolbar to draw:
    *   **Points:** For Virtual Mooring (Time Series).
    *   **Rectangles:** For Regional Extraction.
3.  Add a **Depth Slider** (0 to 1000m) floating over the map that updates a 2D heatmap layer.

### B. The Control Panel (Right Panel - 30% width)
Create a dynamic sidebar that changes based on what the user draws on the map:
1.  **If a Point is clicked (Virtual Mooring):**
    *   Show Latitude/Longitude.
    *   Show Date Range Picker.
    *   Button: `Generate Time Series (CSV)`.
2.  **If a Rectangle is drawn (Region Export):**
    *   Show Bounding Box Coordinates.
    *   Show Variable Checkboxes (Temp, MLD, UHC).
    *   Format Selector (NetCDF vs CSV).
    *   Button: `Export Region Data`.
3.  **Batch Upload Tab:**
    *   A drag-and-drop zone for `CSV` files (trajectory analysis).

---

## 4. Phase 3: FastAPI Backend Extension
*Goal: Add REST endpoints to handle the new extraction requests.*

Add a new router (e.g., `ML/src/serving/export.py`) with the following endpoints:

### 1. Region Export (`POST /export/region`)
*   **Input:** GeoJSON Polygon, Start Date, End Date, Variables List, Format (`nc` or `csv`).
*   **Logic:** 
    *   Load Zarr store via `xarray`.
    *   Slice data using `.sel(lat=slice(), lon=slice(), time=slice())`.
    *   Run inference pipeline on the sliced grid.
    *   Save output to a temporary `.nc` or `.csv` file.
*   **Output:** Return `FileResponse` for download.

### 2. Time Series Export (`GET /export/timeseries`)
*   **Input:** Lat, Lon, Start Date, End Date.
*   **Logic:**
    *   Extract surface variables for the single point across the time range.
    *   Run inference (treating time as the batch dimension).
*   **Output:** Return JSON array for frontend charting, or CSV for download.

### 3. Trajectory Batch Upload (`POST /export/trajectory`)
*   **Input:** `UploadFile` (CSV with `date`, `lat`, `lon`).
*   **Logic:**
    *   Parse CSV with `pandas`.
    *   Vectorized extraction of surface features for those specific points.
    *   Batch inference.
    *   Append columns (temp_0m...1000m, mld, analogs) to dataframe.
*   **Output:** Return enriched CSV file.

---

## 5. Phase 4: The "Handoff" Feature
*Goal: Allow users to seamlessly transition from visual discovery to data extraction.*

1.  In the **3D Visualizer**, when a user clicks on an interesting point or station, add an **"Analyze in Workbench"** button to the existing tooltip/popup.
2.  Clicking this button routes the user to `/workbench?lat=X&lon=Y&date=Z`.
3.  The Workbench reads the URL parameters, instantly drops a pin on the 2D map at those coordinates, and opens the "Time Series" extraction panel, ready for the researcher to download.
