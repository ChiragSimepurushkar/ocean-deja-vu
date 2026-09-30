import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Compass,
  Lightbulb,
  MousePointer,
  Volume2,
  VolumeX,
  Box,
  Layers,
  Thermometer,
  Droplets,
  Gauge,
  Sun,
  Anchor,
  Wind,
} from 'lucide-react';
import { Ocean3DScene } from '../components/3d/Ocean3DScene';
import { ParallaxUnderwaterScene } from '../components/ParallaxUnderwaterScene';
import { startAmbientOceanDrone, stopAmbientOceanDrone, updateUnderwaterDepthAcoustics } from '../utils/audio';
import './DeepDive.css';

/* ═══ Ocean Zone Definitions ═══════════════════════════════════ */
const OCEAN_ZONES = [
  {
    id: 'epipelagic',
    name: 'Epipelagic Zone',
    layerName: 'Sunlit Surface Layer',
    depthRange: [0, 60],
    note: 'Photosynthetically active; wind-driven mixed layer with homogeneous warm temperatures.',
    icon: '☀️',
  },
  {
    id: 'upper-thermo',
    name: 'Upper Thermocline',
    layerName: 'Rapid Thermal Gradient',
    depthRange: [60, 200],
    note: 'Steepest temperature gradient; sharp pycnocline barrier inhibiting vertical mixing.',
    icon: '🌡️',
  },
  {
    id: 'mesopelagic',
    name: 'Mesopelagic Zone',
    layerName: 'Twilight Boundary',
    depthRange: [200, 500],
    note: 'Residual blue photons only; oxygen minimum zone; diel vertical migration corridor.',
    icon: '🌊',
  },
  {
    id: 'bathypelagic',
    name: 'Bathypelagic Zone',
    layerName: 'Midnight Realm',
    depthRange: [500, 800],
    note: 'Complete solar darkness; bioluminescence dominant; cold stable water mass.',
    icon: '🔦',
  },
  {
    id: 'abyssal',
    name: 'Abyssal Floor',
    layerName: 'Hadal Transition',
    depthRange: [800, 1000],
    note: 'Extreme hydrostatic pressure, near-freezing temperatures, and chemosynthetic vent ecosystems.',
    icon: '🌋',
  },
];

const DEPTH_STOPS = [
  { label: '0m', depth: 0 },
  { label: '50m', depth: 50 },
  { label: '150m', depth: 150 },
  { label: '300m', depth: 300 },
  { label: '600m', depth: 600 },
  { label: '1000m', depth: 1000 },
];

function getCurrentZone(depth) {
  for (let i = OCEAN_ZONES.length - 1; i >= 0; i--) {
    if (depth >= OCEAN_ZONES[i].depthRange[0]) return OCEAN_ZONES[i];
  }
  return OCEAN_ZONES[0];
}

/* ═══ Component ════════════════════════════════════════════════ */
export default function DeepDivePage({ date = '2023-06-01', lat = 15.0, lon = 85.0 }) {
  const navigate = useNavigate();
  const [currentDepth, setCurrentDepth] = useState(0);
  const [flashlightOn, setFlashlightOn] = useState(true);
  const [renderMode, setRenderMode] = useState('3d');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const containerRef = useRef(null);
  const sliderRef = useRef(null);
  const isDragging = useRef(false);

  // ── Audio ──
  useEffect(() => {
    if (soundEnabled) startAmbientOceanDrone(true, currentDepth);
    else stopAmbientOceanDrone();
    return () => stopAmbientOceanDrone();
  }, [soundEnabled]);

  useEffect(() => {
    if (soundEnabled) updateUnderwaterDepthAcoustics(currentDepth);
  }, [currentDepth, soundEnabled]);

  // ── Mouse wheel scroll ──
  const handleWheel = useCallback((e) => {
    const delta = e.deltaY > 0 ? 10 : -10;
    setCurrentDepth((prev) => Math.max(0, Math.min(1000, prev + delta)));
  }, []);

  // ── Vertical slider drag ──
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
    const handleMouseMove = (e) => {
      if (isDragging.current) handleSliderInteraction(e.clientY);
    };
    const handleMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleSliderInteraction]);

  // ── Compute telemetry ──
  const zone = getCurrentZone(currentDepth);
  const sst = 29.2 - Math.abs(lat - 12) * 0.25;
  const tempC = Math.max(2.1, sst - Math.pow(currentDepth / 1000, 0.42) * (sst - 2.1));
  const pressureAtm = (1.0 + currentDepth / 10.0).toFixed(1);
  const salinityPsu = (33.8 + Math.min(1.8, (currentDepth / 400) * 1.4)).toFixed(2);
  const dissolvedO2 = currentDepth < 100 ? '4.8' : currentDepth < 400 ? '1.6' : '3.4';
  const irradiance = Math.max(0, Math.exp(-currentDepth / 32) * 100).toFixed(1);
  const soundSpeed = (1449.2 + 4.6 * tempC - 0.055 * tempC * tempC + 0.017 * currentDepth * 0.1).toFixed(0);

  const thumbPercent = (currentDepth / 1000) * 100;

  // No-op discover for decorative creatures
  const noopDiscover = () => {};

  return (
    <div ref={containerRef} onWheel={handleWheel} className="deep-dive-container">
      {/* ── 3D / 2D Canvas ── */}
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
          />
        )}
      </div>

      {/* ── Top Navigation Bar ── */}
      <div className="dd-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button onClick={() => navigate('/')} className="dd-btn" title="Back to Dashboard">
            <ArrowLeft size={15} />
            <span>Dashboard</span>
          </button>
          <div className="dd-badge">
            <Compass size={13} color="#38bdf8" />
            <span>{lat.toFixed(2)}°N, {lon.toFixed(2)}°E</span>
          </div>
          <div className="dd-badge">
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>DATE</span>
            <span>{date}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            onClick={() => setRenderMode(renderMode === '3d' ? '2d' : '3d')}
            className={`dd-btn ${renderMode === '3d' ? 'dd-btn-active' : ''}`}
          >
            {renderMode === '3d' ? <Box size={14} /> : <Layers size={14} />}
            <span>{renderMode === '3d' ? '3D Spatial' : '2D View'}</span>
          </button>
          <button
            onClick={() => setFlashlightOn(!flashlightOn)}
            className={`dd-btn ${flashlightOn ? 'dd-btn-active' : ''}`}
          >
            <Lightbulb size={14} color={flashlightOn ? '#fde047' : '#64748b'} />
            <span>{flashlightOn ? 'ON' : 'OFF'}</span>
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`dd-btn ${soundEnabled ? 'dd-btn-active' : ''}`}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
      </div>

      {/* ── Instruction ── */}
      <div className="dd-instruction-badge">
        <MousePointer size={13} />
        <span>Scroll to dive · Drag depth bar on right</span>
      </div>

      {/* ── Center Watermark: big depth + zone ── */}
      <div className="dd-layer-card" key={zone.id}>
        <div className="dd-layer-depth">{currentDepth}m</div>
        <div className="dd-layer-zone-name">{zone.name}</div>
      </div>

      {/* ── LEFT: Telemetry Panel ── */}
      <div className="dd-telemetry-panel dd-glass">
        <div className="dd-panel-header">
          <div className="dd-panel-title">Hydrostatic Telemetry</div>
          <div className="dd-status-dot">LIVE</div>
        </div>

        {/* Primary metrics */}
        <div className="dd-metrics-grid">
          <div className="dd-metric">
            <div className="dd-metric-label">
              <Thermometer size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
              Temperature
            </div>
            <div className="dd-metric-value">
              {tempC.toFixed(1)}<span className="unit">°C</span>
            </div>
          </div>
          <div className="dd-metric">
            <div className="dd-metric-label">
              <Gauge size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
              Pressure
            </div>
            <div className="dd-metric-value">
              {pressureAtm}<span className="unit">atm</span>
            </div>
          </div>
          <div className="dd-metric">
            <div className="dd-metric-label">
              <Droplets size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
              Salinity
            </div>
            <div className="dd-metric-value">
              {salinityPsu}<span className="unit">psu</span>
            </div>
          </div>
          <div className="dd-metric">
            <div className="dd-metric-label">
              <Wind size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
              Dissolved O₂
            </div>
            <div className="dd-metric-value">
              {dissolvedO2}<span className="unit">mL/L</span>
            </div>
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="dd-secondary-metrics">
          <div className="dd-secondary-metric">
            <div className="dd-secondary-metric-label">
              <Sun size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
              Light
            </div>
            <div className="dd-secondary-metric-value">{irradiance}%</div>
          </div>
          <div className="dd-secondary-metric">
            <div className="dd-secondary-metric-label">
              <Anchor size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
              Sound Vel.
            </div>
            <div className="dd-secondary-metric-value">{soundSpeed} m/s</div>
          </div>
          <div className="dd-secondary-metric">
            <div className="dd-secondary-metric-label">Δ SST</div>
            <div className="dd-secondary-metric-value">-{(sst - tempC).toFixed(1)}°</div>
          </div>
        </div>

        {/* Stratum info */}
        <div className="dd-stratum-block">
          <div className="dd-stratum-zone">{zone.icon} {zone.id}</div>
          <div className="dd-stratum-name">{zone.layerName}</div>
          <div className="dd-stratum-note">{zone.note}</div>
        </div>
      </div>

      {/* ── RIGHT: Vertical Depth Rail ── */}
      <div className="dd-depth-rail dd-glass" style={{ padding: '0.75rem 0.5rem', width: '72px' }}>
        <div className="dd-depth-label-top">0 m</div>

        <div
          ref={sliderRef}
          className="dd-depth-slider"
          onMouseDown={handleSliderMouseDown}
          style={{ flex: 1, width: '100%', position: 'relative', cursor: 'pointer' }}
        >
          {/* Gradient track */}
          <div className="dd-depth-slider-track" />

          {/* Zone tick marks */}
          {OCEAN_ZONES.map((z) => {
            const pct = (z.depthRange[0] / 1000) * 100;
            return (
              <div
                key={z.id}
                style={{
                  position: 'absolute',
                  right: '22px',
                  top: `${pct}%`,
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  pointerEvents: 'none',
                }}
              >
                <span style={{ fontSize: '0.5rem', color: 'rgba(148,163,184,0.5)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {z.depthRange[0]}
                </span>
                <span style={{ width: '8px', height: '1px', background: 'rgba(56,189,248,0.25)', display: 'block' }} />
              </div>
            );
          })}

          {/* Draggable thumb */}
          <div
            className="dd-depth-slider-thumb"
            style={{ top: `${thumbPercent}%` }}
          >
            <div className="dd-depth-readout">
              {currentDepth}m
            </div>
          </div>
        </div>

        <div className="dd-depth-label-bottom">1000 m</div>
      </div>

      {/* ── Bottom Center: Quick Jump Buttons ── */}
      <div className="dd-bottom-controls">
        {DEPTH_STOPS.map((stop) => (
          <button
            key={stop.depth}
            onClick={() => setCurrentDepth(stop.depth)}
            className={`dd-layer-pill ${Math.abs(currentDepth - stop.depth) < 35 ? 'active' : ''}`}
          >
            {stop.label}
          </button>
        ))}
      </div>
    </div>
  );
}
