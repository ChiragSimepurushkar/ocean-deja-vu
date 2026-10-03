import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Compass, Lightbulb, Volume2, VolumeX,
  Box, Layers, Thermometer, Droplets, Gauge, Sun, Anchor, Wind,
} from 'lucide-react';
import { Ocean3DScene } from '../components/3d/Ocean3DScene';
import { ParallaxUnderwaterScene } from '../components/ParallaxUnderwaterScene';
import { getProfile } from '../api';
import { buildDiveConfig } from '../utils/buildDiveConfig';
import { useOceanSessionStore } from '../store/oceanSessionStore';
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

export default function DeepDivePage() {
  const { currentDate: date, currentLat: lat, currentLon: lon, currentDepth, setDepth: setCurrentDepth, soundEnabled, toggleSound } = useOceanSessionStore();
  
  const navigate = useNavigate();
  const [flashlightOn, setFlashlightOn] = useState(true);
  const [renderMode, setRenderMode] = useState('3d');
  const containerRef = useRef(null);
  const sliderRef = useRef(null);
  const isDragging = useRef(false);

  // Scroll to dive
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 15 : -15;
    setCurrentDepth(Math.max(0, Math.min(1000, currentDepth + delta)));
  }, [currentDepth, setCurrentDepth]);

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

  // Fetch real dataset profile
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    getProfile(date, lat, lon).then(setProfile).catch(console.error);
  }, [date, lat, lon]);

  // Telemetry calculations
  const zone = getCurrentZone(currentDepth);
  
  let sst = 29.2;
  let tempC = Math.max(2.1, sst - Math.pow(currentDepth / 1000, 0.42) * (sst - 2.1));
  let salinityPsu = (33.8 + Math.min(1.8, (currentDepth / 400) * 1.4));
  let curMps = 0;
  
  if (profile) {
    const depths = profile.depths;
    
    // Find closest depth index
    let closestDIdx = 0;
    let minDDiff = 9999;
    depths.forEach((d, i) => {
       if (Math.abs(d - currentDepth) < minDDiff) {
          minDDiff = Math.abs(d - currentDepth);
          closestDIdx = i;
       }
    });
    
    tempC = profile.temp_pred[closestDIdx] || tempC;
    sst = profile.temp_pred[0] || sst;
  }

  const pressureAtm = (1.0 + currentDepth / 10.0).toFixed(1);
  const dissolvedO2 = currentDepth < 100 ? '4.8' : currentDepth < 400 ? '1.6' : '3.4';
  const irradiance = Math.max(0, Math.exp(-currentDepth / 32) * 100).toFixed(1);
  const soundSpeed = (1449.2 + 4.6 * tempC - 0.055 * tempC * tempC + 0.017 * currentDepth * 0.1).toFixed(0);

  // Memoize config — only rebuild when lat/lon/date/profile change
  const config = React.useMemo(
    () => buildDiveConfig({ lat, lon, date, profile: profile || undefined }),
    [lat, lon, date, profile]
  );

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
            config={config}
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
          <button
            onClick={() => navigate(`/cinematic?lat=${lat}&lon=${lon}&date=${date}`)}
            className="dd-btn"
            style={{ marginLeft: '10px', background: '#F59E0B', color: 'white', border: 'none', fontWeight: 600 }}
          >
            Launch Cinematic View
          </button>
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
            onClick={toggleSound}
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

      {/* ════════ LEFT: Telemetry Panel (Redesigned) ════════ */}
      <div className="dd-telemetry-panel dd-glass dd-chamfered">
        {/* L-bracket corner decorations */}
        <div className="dd-bracket dd-bracket-tl" />
        <div className="dd-bracket dd-bracket-bl" />
        <div className="dd-bracket dd-bracket-br" />

        {/* Sonar sweep animation */}
        <div className="dd-sonar-sweep" />

        {/* Header */}
        <div className="dd-panel-header">
          <span className="dd-panel-title">Hydrostatic Telemetry</span>
          <span className="dd-live-dot">LIVE</span>
        </div>

        {/* ── HERO: Temperature Arc Gauge ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
          <div style={{ position: 'relative', width: '110px', height: '65px', flexShrink: 0 }}>
            <svg viewBox="0 0 120 70" width="110" height="65">
              {/* Background arc */}
              <path
                d="M 10 60 A 50 50 0 0 1 110 60"
                fill="none"
                stroke="rgba(56,189,248,0.12)"
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* Filled arc — maps 0–35°C to arc sweep */}
              <path
                d="M 10 60 A 50 50 0 0 1 110 60"
                fill="none"
                stroke="url(#tempGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(Math.min(35, Math.max(0, tempC)) / 35) * 157} 157`}
              />
              {/* Needle tick */}
              {(() => {
                const angle = -180 + (Math.min(35, Math.max(0, tempC)) / 35) * 180;
                const rad = (angle * Math.PI) / 180;
                const cx = 60, cy = 60, r = 50;
                const nx = cx + r * Math.cos(rad);
                const ny = cy + r * Math.sin(rad);
                return <circle cx={nx} cy={ny} r="4" fill="#38bdf8" filter="url(#glow)" />;
              })()}
              <defs>
                <linearGradient id="tempGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Labels */}
              <text x="12" y="68" fill="#334155" fontSize="7" fontFamily="'JetBrains Mono', monospace">0°</text>
              <text x="96" y="68" fill="#334155" fontSize="7" fontFamily="'JetBrains Mono', monospace">35°</text>
            </svg>
          </div>
          <div>
            <div className="dd-metric-label" style={{ marginBottom: '2px' }}>
              <Thermometer size={10} className="dd-metric-icon" /> Temperature
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#bae6fd', lineHeight: 1 }}>
              {tempC.toFixed(1)}<span className="dd-unit" style={{ fontSize: '0.7rem' }}>°C</span>
            </div>
          </div>
        </div>

        {/* ── Pressure (second-largest) ── */}
        <div className="dd-metric" style={{ marginBottom: '0.6rem', padding: '0.5rem 0.75rem' }}>
          <div className="dd-metric-label">
            <Gauge size={10} className="dd-metric-icon" /> Pressure
          </div>
          <div className="dd-metric-value" style={{ fontSize: '1.3rem' }}>
            {pressureAtm}<span className="dd-unit">atm</span>
          </div>
        </div>

        {/* ── Compact secondary chip row ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.7rem' }}>
          {[
            { icon: <Droplets size={9} />, label: 'SAL', value: `${(salinityPsu.toFixed ? salinityPsu.toFixed(1) : Number(salinityPsu).toFixed(1))}`, unit: 'psu', color: '#60a5fa' },
            { icon: <Wind size={9} />, label: 'O₂', value: dissolvedO2, unit: 'mL/L', color: '#2dd4bf' },
            { icon: <Sun size={9} />, label: 'IRR', value: `${irradiance}`, unit: '%', color: '#fbbf24' },
            { icon: <Anchor size={9} />, label: 'SND', value: soundSpeed, unit: 'm/s', color: '#94a3b8' },
            { icon: null, label: 'ΔSST', value: `−${(sst - tempC).toFixed(1)}`, unit: '°', color: '#f87171' },
          ].map((chip, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.25rem 0.5rem', borderRadius: '6px',
              background: 'rgba(2,8,22,0.7)', border: '1px solid rgba(56,189,248,0.08)',
              fontSize: '0.62rem', fontFamily: "'JetBrains Mono', monospace",
            }}>
              {chip.icon && <span style={{ opacity: 0.6, color: chip.color }}>{chip.icon}</span>}
              <span style={{ color: '#475569', fontWeight: 600 }}>{chip.label}</span>
              <span style={{ color: chip.color, fontWeight: 700 }}>{chip.value}</span>
              <span style={{ color: '#334155', fontSize: '0.55rem' }}>{chip.unit}</span>
            </div>
          ))}
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
