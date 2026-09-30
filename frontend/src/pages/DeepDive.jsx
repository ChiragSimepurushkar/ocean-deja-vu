import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Compass, Lightbulb, Volume2, VolumeX,
  Box, Layers, Thermometer, Droplets, Gauge, Sun, Anchor, Wind,
} from 'lucide-react';
import { Ocean3DScene } from '../components/3d/Ocean3DScene';
import { ParallaxUnderwaterScene } from '../components/ParallaxUnderwaterScene';
import { startAmbientOceanDrone, stopAmbientOceanDrone, updateUnderwaterDepthAcoustics } from '../utils/audio';
import { useOceanDataset } from '../hooks/useOceanDataset';
import './DeepDive.css';

const OCEAN_ZONES = [
  {
    id: 'epipelagic',
    name: 'Epipelagic Zone',
    layerName: 'Sunlit Surface Layer',
    color: '#22d3ee',
    depthRange: [0, 60],
    note: 'Photosynthetically active; wind-driven mixed layer with homogeneous warm temperatures.',
    icon: '☀️',
  },
  {
    id: 'upper-thermo',
    name: 'Upper Thermocline',
    layerName: 'Rapid Thermal Gradient',
    color: '#38bdf8',
    depthRange: [60, 200],
    note: 'Steepest temperature gradient; sharp pycnocline barrier inhibiting vertical mixing.',
    icon: '🌡️',
  },
  {
    id: 'mesopelagic',
    name: 'Mesopelagic Zone',
    layerName: 'Twilight Boundary',
    color: '#0ea5e9',
    depthRange: [200, 500],
    note: 'Residual blue photons only; oxygen minimum zone; diel vertical migration corridor.',
    icon: '🌊',
  },
  {
    id: 'bathypelagic',
    name: 'Bathypelagic Zone',
    layerName: 'Midnight Realm',
    color: '#0284c7',
    depthRange: [500, 800],
    note: 'Complete solar darkness; bioluminescence dominant; cold stable water mass.',
    icon: '🔦',
  },
  {
    id: 'abyssal',
    name: 'Abyssal Floor',
    layerName: 'Hadal Transition',
    color: '#075985',
    depthRange: [800, 1000],
    note: 'Extreme hydrostatic pressure, near-freezing temperatures, chemosynthetic vent ecosystems.',
    icon: '🌋',
  },
];

const DEPTH_STOPS = [
  { label: '0m',    depth: 0    },
  { label: '50m',   depth: 50   },
  { label: '150m',  depth: 150  },
  { label: '300m',  depth: 300  },
  { label: '600m',  depth: 600  },
  { label: '1000m', depth: 1000 },
];

function getCurrentZone(depth) {
  for (let i = OCEAN_ZONES.length - 1; i >= 0; i--) {
    if (depth >= OCEAN_ZONES[i].depthRange[0]) return OCEAN_ZONES[i];
  }
  return OCEAN_ZONES[0];
}

export default function DeepDivePage({ date = '2023-06-01', lat = 15.0, lon = 85.0 }) {
  const navigate = useNavigate();
  const [currentDepth, setCurrentDepth] = useState(0);
  const [flashlightOn, setFlashlightOn] = useState(true);
  const [renderMode, setRenderMode] = useState('3d');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const containerRef = useRef(null);
  const sliderRef = useRef(null);
  const isDragging = useRef(false);

  // Audio
  useEffect(() => {
    if (soundEnabled) startAmbientOceanDrone(true, currentDepth);
    else stopAmbientOceanDrone();
    return () => stopAmbientOceanDrone();
  }, [soundEnabled]);

  useEffect(() => {
    if (soundEnabled) updateUnderwaterDepthAcoustics(currentDepth);
  }, [currentDepth, soundEnabled]);

  // Scroll to dive
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 15 : -15;
    setCurrentDepth((prev) => Math.max(0, Math.min(1000, prev + delta)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Vertical slider drag
  const handleSliderInteraction = useCallback((clientY) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setCurrentDepth(Math.round(ratio * 1000));
  }, []);

  const handleSliderMouseDown = useCallback((e) => {
    isDragging.current = true;
    handleSliderInteraction(e.clientY);
  }, [handleSliderInteraction]);

  useEffect(() => {
    const onMove = (e) => { if (isDragging.current) handleSliderInteraction(e.clientY); };
    const onUp   = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [handleSliderInteraction]);

  // Fetch real dataset
  const { data: oceanData, loading } = useOceanDataset(date);

  // Telemetry calculations
  const zone = getCurrentZone(currentDepth);
  
  let sst = 29.2;
  let tempC = Math.max(2.1, sst - Math.pow(currentDepth / 1000, 0.42) * (sst - 2.1));
  let salinityPsu = (33.8 + Math.min(1.8, (currentDepth / 400) * 1.4));
  let curMps = 0;
  
  if (oceanData && oceanData.reconstructed) {
    const latIdx = Math.max(0, Math.min(99, Math.round((lat - 5) / 0.25)));
    const lonIdx = Math.max(0, Math.min(239, Math.round((lon - 45) / 0.25)));
    const depths = oceanData.depths || [0,5,10,20,30,50,75,100,125,150,200,300,500,700,1000];
    
    // Find closest depth index
    let closestDIdx = 0;
    let minDDiff = 9999;
    depths.forEach((d, i) => {
       if (Math.abs(d - currentDepth) < minDDiff) {
          minDDiff = Math.abs(d - currentDepth);
          closestDIdx = i;
       }
    });
    
    const tData = oceanData.reconstructed.temperature[closestDIdx];
    const sData = oceanData.reconstructed.salinity[closestDIdx];
    const cData = oceanData.reconstructed.currents[closestDIdx];
    
    if (oceanData.surface && oceanData.surface.sst && oceanData.surface.sst[latIdx]) {
       sst = oceanData.surface.sst[latIdx][lonIdx] || sst;
    }
    
    if (tData && tData[latIdx]) tempC = tData[latIdx][lonIdx] || tempC;
    if (sData && sData[latIdx]) salinityPsu = sData[latIdx][lonIdx] || salinityPsu;
    if (cData && cData[latIdx]) curMps = cData[latIdx][lonIdx] || curMps;
  }

  const pressureAtm = (1.0 + currentDepth / 10.0).toFixed(1);
  const dissolvedO2 = currentDepth < 100 ? '4.8' : currentDepth < 400 ? '1.6' : '3.4';
  const irradiance = Math.max(0, Math.exp(-currentDepth / 32) * 100).toFixed(1);
  const soundSpeed = (1449.2 + 4.6 * tempC - 0.055 * tempC * tempC + 0.017 * currentDepth * 0.1).toFixed(0);

  const thumbPercent = (currentDepth / 1000) * 100;
  const noopDiscover = () => {};

  return (
    <div ref={containerRef} className="deep-dive-container">

      {/* ── 3D / 2D Canvas (fills entire background) ── */}
      <div className="dive-canvas-wrap">
        {renderMode === '3d' ? (
          <Ocean3DScene
            currentDepth={currentDepth}
            onDiscoverSpecies={noopDiscover}
            discoveredSpeciesIds={[]}
            flashlightOn={flashlightOn}
          />
        ) : (
          <ParallaxUnderwaterScene
            currentDepth={currentDepth}
            onDiscoverSpecies={noopDiscover}
            discoveredSpeciesIds={[]}
            flashlightOn={flashlightOn}
          />
        )}
      </div>

      {/* ── Top Navigation Bar ── */}
      <div className="dd-top-bar">
        {/* Left: back + coords + date */}
        <div className="dd-top-left">
          <button onClick={() => navigate('/')} className="dd-btn" title="Back to Dashboard">
            <ArrowLeft size={15} />
            <span>Dashboard</span>
          </button>
          <div className="dd-badge">
            <Compass size={12} color="#38bdf8" />
            <span>{lat.toFixed(2)}°N · {lon.toFixed(2)}°E</span>
          </div>
          <div className="dd-badge">
            <span className="dd-badge-key">DATE</span>
            <span>{date}</span>
          </div>
        </div>

        {/* Right: mode toggles */}
        <div className="dd-top-right">
          <button
            onClick={() => setRenderMode(renderMode === '3d' ? '2d' : '3d')}
            className={`dd-btn tour-2d-toggle ${renderMode === '3d' ? 'dd-btn-active' : ''}`}
          >
            {renderMode === '3d' ? <Box size={14} /> : <Layers size={14} />}
            <span>{renderMode === '3d' ? '3D Spatial' : '2D View'}</span>
          </button>
          <button
            onClick={() => setFlashlightOn(!flashlightOn)}
            className={`dd-btn ${flashlightOn ? 'dd-btn-active' : ''}`}
            title="Toggle Submersible Headlight"
          >
            <Lightbulb size={14} color={flashlightOn ? '#fde047' : '#64748b'} />
            <span>{flashlightOn ? 'ON' : 'OFF'}</span>
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`dd-btn ${soundEnabled ? 'dd-btn-active' : ''}`}
            title="Toggle Ambient Sound"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
      </div>

      {/* ── Subtle instruction strip ── */}
      <div className="dd-hint">
        <span>↕ Scroll to dive &nbsp;·&nbsp; Drag depth bar →</span>
      </div>

      {/* ── Center Watermark: depth + zone name ── */}
      <div className="dd-watermark" key={zone.id}>
        <div className="dd-watermark-depth">{currentDepth}m</div>
        <div className="dd-watermark-zone">{zone.name.toUpperCase()}</div>
      </div>

      {/* ════════ LEFT: Telemetry Panel ════════ */}
      <div className="dd-telemetry-panel dd-glass">

        {/* Header */}
        <div className="dd-panel-header">
          <span className="dd-panel-title">Hydrostatic Telemetry</span>
          <span className="dd-live-dot">LIVE</span>
        </div>

        {/* 4 Primary metrics — 2×2 grid */}
        <div className="dd-metrics-grid">
          <div className="dd-metric">
            <div className="dd-metric-label">
              <Thermometer size={10} className="dd-metric-icon" /> Temperature
            </div>
            <div className="dd-metric-value">
              {tempC.toFixed(1)}<span className="dd-unit">°C</span>
            </div>
          </div>
          <div className="dd-metric">
            <div className="dd-metric-label">
              <Gauge size={10} className="dd-metric-icon" /> Pressure
            </div>
            <div className="dd-metric-value">
              {pressureAtm}<span className="dd-unit">atm</span>
            </div>
          </div>
          <div className="dd-metric">
            <div className="dd-metric-label">
              <Droplets size={10} className="dd-metric-icon" /> Salinity
            </div>
            <div className="dd-metric-value">
              {salinityPsu.toFixed ? salinityPsu.toFixed(2) : Number(salinityPsu).toFixed(2)}<span className="dd-unit">psu</span>
            </div>
          </div>
          <div className="dd-metric">
            <div className="dd-metric-label">
              <Wind size={10} className="dd-metric-icon" /> Dissolved O₂
            </div>
            <div className="dd-metric-value">
              {dissolvedO2}<span className="dd-unit">mL/L</span>
            </div>
          </div>
        </div>

        {/* 3 Secondary metrics */}
        <div className="dd-secondary-row">
          <div className="dd-secondary-metric">
            <div className="dd-secondary-label">
              <Sun size={9} className="dd-metric-icon" /> Irradiance
            </div>
            <div className="dd-secondary-value">{irradiance}%</div>
          </div>
          <div className="dd-secondary-metric">
            <div className="dd-secondary-label">
              <Anchor size={9} className="dd-metric-icon" /> Sound Vel.
            </div>
            <div className="dd-secondary-value">{soundSpeed} m/s</div>
          </div>
          <div className="dd-secondary-metric">
            <div className="dd-secondary-label">Δ SST</div>
            <div className="dd-secondary-value">−{(sst - tempC).toFixed(1)}°</div>
          </div>
        </div>

        {/* Divider */}
        <div className="dd-divider" />

        {/* Stratum descriptor */}
        <div className="dd-stratum">
          <div className="dd-stratum-tag" style={{ color: zone.color }}>
            {zone.icon}&nbsp;&nbsp;{zone.id.toUpperCase()}
          </div>
          <div className="dd-stratum-name">{zone.layerName}</div>
          <div className="dd-stratum-note">{zone.note}</div>
        </div>
      </div>

      {/* ════════ RIGHT: Vertical Depth Rail ════════ */}
      <div className="dd-depth-rail dd-glass">
        <div className="dd-rail-label-top">0 m</div>

        <div
          ref={sliderRef}
          className="dd-rail-track-wrap"
          onMouseDown={handleSliderMouseDown}
        >
          {/* Gradient track bar */}
          <div className="dd-rail-track" />

          {/* Zone boundary ticks */}
          {OCEAN_ZONES.map((z) => {
            const pct = (z.depthRange[0] / 1000) * 100;
            return (
              <div
                key={z.id}
                className="dd-rail-tick"
                style={{ top: `${pct}%` }}
              >
                <span className="dd-rail-tick-label">{z.depthRange[0]}</span>
                <span className="dd-rail-tick-line" />
              </div>
            );
          })}

          {/* Draggable thumb */}
          <div className="dd-rail-thumb" style={{ top: `${thumbPercent}%` }}>
            <div className="dd-rail-readout">{currentDepth}m</div>
          </div>
        </div>

        <div className="dd-rail-label-bottom">1000 m</div>
      </div>

      {/* ════════ Bottom Center: Quick-Jump Depth Pills ════════ */}
      <div className="dd-depth-pills">
        {DEPTH_STOPS.map((s) => (
          <button
            key={s.depth}
            onClick={() => setCurrentDepth(s.depth)}
            className={`dd-pill ${Math.abs(currentDepth - s.depth) < 35 ? 'dd-pill-active' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>

    </div>
  );
}
