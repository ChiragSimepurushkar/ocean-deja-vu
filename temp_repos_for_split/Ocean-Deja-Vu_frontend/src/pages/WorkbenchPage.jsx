import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOceanSessionStore } from '../store/oceanSessionStore';
import { Map, Source, Layer } from 'react-map-gl/maplibre';
import { config } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
config.WORKER_URL = workerUrl;

import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Activity, MapPin, Square, FileText, Download, Loader2, AlertCircle, X, Box, CheckSquare, Trash2 } from 'lucide-react';
import './WorkbenchPage.css';

import { useOceanDataset } from '../hooks/useOceanDataset';
import { buildSstOverlay } from '../utils/buildSstTexture';

// Mock Interfaces as requested
/*
RegionExportRequest { polygon: GeoJSON, startDate, endDate, variables: string[], format: 'nc'|'csv' }
TimeSeriesRequest { lat, lon, startDate, endDate }
*/

const DOMAIN_BOUNDS = { minLat: 5, maxLat: 30, minLon: 45, maxLon: 105 };

function isPointInDomain(lat, lon) {
  return lat >= DOMAIN_BOUNDS.minLat && lat <= DOMAIN_BOUNDS.maxLat && lon >= DOMAIN_BOUNDS.minLon && lon <= DOMAIN_BOUNDS.maxLon;
}

function isBboxInDomain(bbox) {
  // bbox: [minLon, minLat, maxLon, maxLat]
  return (
    bbox[1] >= DOMAIN_BOUNDS.minLat && bbox[3] <= DOMAIN_BOUNDS.maxLat &&
    bbox[0] >= DOMAIN_BOUNDS.minLon && bbox[2] <= DOMAIN_BOUNDS.maxLon
  );
}

const mockTimeSeriesData = Array.from({ length: 30 }).map((_, i) => ({
  day: i,
  temp: 25 + Math.sin(i * 0.5) * 2 + Math.random()
}));

export default function WorkbenchPage() {
  const { currentLat, currentLon, currentDate, currentDepth, setDepth } = useOceanSessionStore();
  const [activeTab, setActiveTab] = useState('point');
  
  // Selection State
  const [selectedPoint, setSelectedPoint] = useState({ lat: currentLat, lon: currentLon });
  const [selectedBbox, setSelectedBbox] = useState(null);
  
  // Form State
  const [startDate, setStartDate] = useState(currentDate);
  const [endDate, setEndDate] = useState(currentDate);
  const [format, setFormat] = useState('csv');
  const [variables, setVariables] = useState(['temp']);
  
  // Estimate & Status State
  // Estimate & Status State
  const [estimate, setEstimate] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  
  // Data & Overlay
  const { data: oceanData } = useOceanDataset(startDate);
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [activeDrawMode, setActiveDrawMode] = useState('draw_point'); // Track active mode

  useEffect(() => {
    if (oceanData?.data) {
      buildSstOverlay(oceanData).then(setOverlayUrl).catch(console.error);
    }
  }, [oceanData]);

  const mapRef = useRef(null);
  const drawRef = useRef(null);

  // Validate selection against domain
  const pointValid = isPointInDomain(selectedPoint.lat, selectedPoint.lon);
  const bboxValid = selectedBbox ? isBboxInDomain(selectedBbox) : false;
  
  const selectionValid = activeTab === 'point' ? pointValid : (activeTab === 'region' ? bboxValid : true);

  // Debounced estimate mock
  useEffect(() => {
    if (!selectionValid) {
      setEstimate(null);
      return;
    }
    const timer = setTimeout(() => {
      if (activeTab === 'point') {
        setEstimate({ cells: 1, sizeBytes: 15 * 1024, seconds: 0.5 });
      } else if (activeTab === 'region' && selectedBbox) {
        // mock calculation
        const lonDiff = selectedBbox[2] - selectedBbox[0];
        const latDiff = selectedBbox[3] - selectedBbox[1];
        const cells = Math.floor(lonDiff * latDiff * 144);
        setEstimate({ cells, sizeBytes: cells * 15 * 4, seconds: Math.max(1, cells / 10000) });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [activeTab, selectedPoint, selectedBbox, startDate, endDate, variables]);

  const onMapLoad = useCallback((e) => {
    const map = e.target;
    // Setup Mapbox Draw
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { point: false, polygon: false, trash: false },
      defaultMode: 'draw_point'
    });
    map.addControl(draw, 'top-right');
    drawRef.current = draw;

    // Set initial point
    draw.add({
      id: 'initial-point',
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [currentLon, currentLat] }
    });

    const updateSelection = () => {
      const data = draw.getAll();
      if (data.features.length === 0) return;
      const latest = data.features[data.features.length - 1];
      
      if (latest.geometry.type === 'Point') {
        setSelectedPoint({ lon: latest.geometry.coordinates[0], lat: latest.geometry.coordinates[1] });
        setActiveTab('point');
      } else if (latest.geometry.type === 'Polygon') {
        // Compute bbox
        const coords = latest.geometry.coordinates[0];
        let minL = 180, minLa = 90, maxL = -180, maxLa = -90;
        coords.forEach(([l, la]) => {
          if (l < minL) minL = l;
          if (l > maxL) maxL = l;
          if (la < minLa) minLa = la;
          if (la > maxLa) maxLa = la;
        });
        setSelectedBbox([minL, minLa, maxL, maxLa]);
        setActiveTab('region');
      }
    };

    map.on('draw.create', updateSelection);
    map.on('draw.update', updateSelection);
  }, [currentLat, currentLon]);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      // Mock network delay based on estimate
      await new Promise(r => setTimeout(r, (estimate?.seconds || 1) * 1000));
      // Simulate success
      setIsExporting(false);
      // In real app, trigger FileResponse download here
      alert("Download completed!");
    } catch (err) {
      setError({ code: 'EXPORT_FAILED', message: 'Failed to process the export request. Please try a smaller region.' });
      setIsExporting(false);
    }
  };

  return (
    <div className="workbench-container">
      {/* 70% Map Panel */}
      <div className="wb-map-panel">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: currentLon,
            latitude: currentLat,
            zoom: 4,
            pitch: 0,
            bearing: 0
          }}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          onLoad={onMapLoad}
          pitchWithRotate={false}
        >
          {/* Domain Boundary Line */}
          <Source
            id="domain-boundary"
            type="geojson"
            data={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [DOMAIN_BOUNDS.minLon, DOMAIN_BOUNDS.minLat],
                  [DOMAIN_BOUNDS.maxLon, DOMAIN_BOUNDS.minLat],
                  [DOMAIN_BOUNDS.maxLon, DOMAIN_BOUNDS.maxLat],
                  [DOMAIN_BOUNDS.minLon, DOMAIN_BOUNDS.maxLat],
                  [DOMAIN_BOUNDS.minLon, DOMAIN_BOUNDS.minLat]
                ]]
              }
            }}
          >
            <Layer
              id="domain-boundary-line"
              type="line"
              paint={{
                'line-color': '#38bdf8',
                'line-width': 2,
                'line-dasharray': [4, 4],
                'line-opacity': 0.6
              }}
            />
          </Source>

          {overlayUrl && (
            <Source
              id="sst-overlay"
              type="image"
              url={overlayUrl}
              coordinates={[
                [DOMAIN_BOUNDS.minLon, DOMAIN_BOUNDS.maxLat],
                [DOMAIN_BOUNDS.maxLon, DOMAIN_BOUNDS.maxLat],
                [DOMAIN_BOUNDS.maxLon, DOMAIN_BOUNDS.minLat],
                [DOMAIN_BOUNDS.minLon, DOMAIN_BOUNDS.minLat]
              ]}
            >
              <Layer
                id="sst-layer"
                type="raster"
                paint={{ 'raster-opacity': 0.85 }}
                beforeId="domain-boundary-line"
              />
            </Source>
          )}
        </Map>

        {/* Custom Drawing Tools Toolbar */}
        <div className="wb-draw-tools">
          <button 
            className={activeDrawMode === 'draw_point' ? 'active' : ''} 
            onClick={() => { drawRef.current?.changeMode('draw_point'); setActiveDrawMode('draw_point'); }} 
            title="Draw Point"
          >
            <MapPin size={16} />
          </button>
          <button 
            className={activeDrawMode === 'draw_polygon' ? 'active' : ''} 
            onClick={() => { drawRef.current?.changeMode('draw_polygon'); setActiveDrawMode('draw_polygon'); }} 
            title="Draw Region (Polygon)"
          >
            <Square size={16} />
          </button>
          <button 
            onClick={() => { drawRef.current?.deleteAll(); setSelectedBbox(null); setActiveTab('point'); setActiveDrawMode('draw_point'); drawRef.current?.changeMode('draw_point'); }} 
            title="Clear All"
          >
            <Trash2 size={16} />
          </button>
        </div>
        
        {/* Depth Slider Overlay (reused style) */}
        <div className="wb-depth-slider">
          <label>Depth: {currentDepth}m</label>
          <input 
            type="range" 
            min="0" max="1000" 
            value={currentDepth} 
            onChange={e => setDepth(Number(e.target.value))}
          />
        </div>
        
        {!selectionValid && (
          <div className="wb-domain-warning">
            <AlertCircle size={16} /> Selected area is outside the data domain (5-30°N, 45-105°E).
          </div>
        )}
      </div>

      {/* 30% Control Panel */}
      <div className="wb-control-panel">
        <div className="wb-header">
          <h2>Data Extraction Workbench</h2>
          <p>Select a region or point to extract data.</p>
        </div>

        <div className="wb-tabs">
          <button className={activeTab === 'point' ? 'active' : ''} onClick={() => setActiveTab('point')}><MapPin size={14}/> Virtual Mooring</button>
          <button className={activeTab === 'region' ? 'active' : ''} onClick={() => setActiveTab('region')}><Square size={14}/> Region Export</button>
          <button className={activeTab === 'batch' ? 'active' : ''} onClick={() => setActiveTab('batch')}><FileText size={14}/> Trajectory Batch</button>
        </div>

        <div className="wb-tab-content">
          {error && (
            <div className="wb-error-banner">
              <AlertCircle size={16} />
              <div style={{ flex: 1 }}>
                <strong>{error.code}</strong>
                <p>{error.message}</p>
              </div>
              <button onClick={() => setError(null)}><X size={14} /></button>
            </div>
          )}

          {activeTab === 'point' && (
            <div className="wb-form">
              <div className="wb-field">
                <label>Coordinates</label>
                <div className="wb-coord-display">
                  {selectedPoint.lat.toFixed(4)}°N, {selectedPoint.lon.toFixed(4)}°E
                </div>
              </div>
              
              <div className="wb-field-row">
                <div className="wb-field">
                  <label>Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min="2023-01-01" max="2023-01-07" />
                </div>
                <div className="wb-field">
                  <label>End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min="2023-01-01" max="2023-01-07" />
                </div>
              </div>

              <div className="wb-preview-chart">
                <label>Preview: Temperature at 0m</label>
                <div className="wb-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mockTimeSeriesData}>
                      <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                      <Line type="monotone" dataKey="temp" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'region' && (
            <div className="wb-form">
              <div className="wb-field">
                <label>Bounding Box (Min Lon, Min Lat, Max Lon, Max Lat)</label>
                <div className="wb-coord-display">
                  {selectedBbox ? 
                    `${selectedBbox[0].toFixed(2)}, ${selectedBbox[1].toFixed(2)}, ${selectedBbox[2].toFixed(2)}, ${selectedBbox[3].toFixed(2)}` 
                    : 'Draw a rectangle on the map'}
                </div>
              </div>

              <div className="wb-field">
                <label>Variables</label>
                <div className="wb-checkbox-group">
                  <label><input type="checkbox" checked={variables.includes('temp')} onChange={() => {}} /> Temperature</label>
                  <label><input type="checkbox" checked={variables.includes('mld')} onChange={() => {}} /> Mixed Layer Depth</label>
                  <label><input type="checkbox" checked={variables.includes('uhc')} onChange={() => {}} /> Upper Heat Content</label>
                </div>
              </div>

              <div className="wb-field">
                <label>Export Format</label>
                <select value={format} onChange={e => setFormat(e.target.value)}>
                  <option value="nc">NetCDF (.nc)</option>
                  <option value="csv">Flattened CSV (.csv)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'batch' && (
            <div className="wb-form">
              <div className="wb-field">
                <label>Upload Trajectory CSV</label>
                <div className="wb-dropzone">
                  <FileText size={24} color="var(--text-muted)" />
                  <p>Drag and drop a CSV file containing date, lat, lon columns.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="wb-footer">
          {estimate && (
            <div className="wb-estimate">
              <span className="wb-est-value">{estimate.cells.toLocaleString()} cells</span> × <span className="wb-est-value">{(estimate.sizeBytes / 1024 / 1024).toFixed(2)} MB</span> → <span className={estimate.seconds > 5 ? 'wb-est-warn' : 'wb-est-safe'}>~{estimate.seconds.toFixed(1)}s</span>
            </div>
          )}
          <button 
            className="wb-export-btn" 
            disabled={!selectionValid || isExporting}
            onClick={handleExport}
          >
            {isExporting ? <><Loader2 className="wb-spin" size={16} /> Processing...</> : <><Download size={16} /> Extract Data</>}
          </button>
        </div>
      </div>
    </div>
  );
}
