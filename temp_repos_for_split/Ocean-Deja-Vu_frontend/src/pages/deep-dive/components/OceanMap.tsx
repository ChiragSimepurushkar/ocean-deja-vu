import React, { useState } from 'react';
import { OCEAN_STATIONS } from '../data/oceanData';
import { OceanStation } from '../types';
import { Compass, Waves, Thermometer, Wind, Droplets, ArrowDownRight, Info } from 'lucide-react';

interface OceanMapProps {
  selectedStation: OceanStation;
  onSelectStationAndDive: (station: OceanStation, clickX: number, clickY: number) => void;
}

export const OceanMap: React.FC<OceanMapProps> = ({
  selectedStation,
  onSelectStationAndDive,
}) => {
  const [hoveredStation, setHoveredStation] = useState<OceanStation | null>(null);

  const handleStationClick = (e: React.MouseEvent, station: OceanStation) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = rect.left + rect.width / 2;
    const clickY = rect.top + rect.height / 2;
    onSelectStationAndDive(station, clickX, clickY);
  };

  const handleMapBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If user clicks anywhere on the ocean water, dive into the closest station
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX;
    const clickY = e.clientY;
    const relX = ((clickX - rect.left) / rect.width) * 100;
    const relY = ((clickY - rect.top) / rect.height) * 100;

    // Find nearest station
    let nearest = OCEAN_STATIONS[0];
    let minDist = Infinity;
    OCEAN_STATIONS.forEach((st) => {
      const dist = Math.hypot(st.mapPosition.x - relX, st.mapPosition.y - relY);
      if (dist < minDist) {
        minDist = dist;
        nearest = st;
      }
    });

    onSelectStationAndDive(nearest, clickX, clickY);
  };

  return (
    <div className="relative w-full min-h-[calc(100vh-61px)] flex flex-col justify-between bg-[#040914] overflow-hidden">
      {/* Background Cartography Grid Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(56, 189, 248, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(56, 189, 248, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Header Info Banner */}
      <div className="relative z-10 px-6 pt-6 pb-2 max-w-7xl mx-auto w-full flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest mb-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>North Indian Ocean Bathymetric Cartography (05°N – 25°N, 55°E – 95°E)</span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Select a Research Station to Dive
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Real-time subsurface reconstructions harmonizing OSTIA SST, SMAP salinity, and ARGO float profiles. Click any glowing node to splash into the ocean layers.
          </p>
        </div>

        {/* Quick Instructions badge */}
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded px-3 py-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Click any sensor point to trigger hydraulic splashdown</span>
        </div>
      </div>

      {/* Main Map Container */}
      <div className="relative flex-1 flex items-center justify-center p-3 sm:p-6 w-full max-w-7xl mx-auto">
        <div
          onClick={handleMapBackgroundClick}
          className="relative w-full aspect-[16/10] max-h-[72vh] rounded-xl border border-cyan-900/40 bg-gradient-to-b from-[#031326] via-[#020b18] to-[#01060f] shadow-2xl overflow-hidden cursor-crosshair group select-none"
        >
          {/* Bathymetry Depth Gradient Contours (SVG) */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1000 625"
            preserveAspectRatio="none"
          >
            <defs>
              <radialGradient id="arabianDeep" cx="28%" cy="42%" r="35%">
                <stop offset="0%" stopColor="#031b33" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#021124" stopOpacity="0.5" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="bengalDeep" cx="74%" cy="46%" r="38%">
                <stop offset="0%" stopColor="#03203c" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#021124" stopOpacity="0.5" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="equatorAbyss" cx="54%" cy="88%" r="45%">
                <stop offset="0%" stopColor="#010c1a" stopOpacity="0.95" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="currentFlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Depth pools */}
            <rect width="1000" height="625" fill="#020813" />
            <circle cx="280" cy="260" r="220" fill="url(#arabianDeep)" />
            <circle cx="740" cy="285" r="230" fill="url(#bengalDeep)" />
            <ellipse cx="540" cy="540" rx="420" ry="180" fill="url(#equatorAbyss)" />

            {/* Simulated Ocean Current Streamlines (Wyrtki Jets & Somali Currents) */}
            <path
              d="M 120 480 Q 300 450 500 500 T 900 520"
              fill="none"
              stroke="url(#currentFlow)"
              strokeWidth="3"
              strokeDasharray="8 6"
              className="animate-pulse"
            />
            <path
              d="M 160 520 Q 350 490 540 530 T 920 560"
              fill="none"
              stroke="url(#currentFlow)"
              strokeWidth="2"
              strokeDasharray="6 8"
            />
            <path
              d="M 220 220 C 260 300 320 380 380 430"
              fill="none"
              stroke="rgba(45, 212, 191, 0.15)"
              strokeWidth="2"
              strokeDasharray="4 6"
            />

            {/* Stylized Landmass Contours: Indian Subcontinent, Sri Lanka, Arabian Coast, Myanmar/Indochina */}
            {/* Indian Peninsula */}
            <path
              d="
                M 360 0
                L 440 90
                L 510 130
                L 570 170
                L 535 240
                L 515 310
                L 490 380
                L 470 415
                L 460 395
                L 435 340
                L 415 280
                L 380 230
                L 330 190
                L 300 130
                L 320 0
                Z
              "
              fill="#081426"
              stroke="#1e3a5f"
              strokeWidth="2"
            />
            {/* Sri Lanka */}
            <ellipse cx="505" cy="455" rx="16" ry="24" fill="#081426" stroke="#1e3a5f" strokeWidth="2" />
            {/* Arabian Peninsula / Horn of Africa Edge */}
            <path
              d="
                M 0 0
                L 140 0
                L 150 110
                L 110 170
                L 40 220
                L 0 250
                Z
              "
              fill="#081426"
              stroke="#1e3a5f"
              strokeWidth="2"
            />
            {/* Myanmar / Andaman Andaman Island Arc */}
            <path
              d="
                M 820 0
                L 850 100
                L 865 180
                L 890 260
                L 930 350
                L 960 480
                L 1000 520
                L 1000 0
                Z
              "
              fill="#081426"
              stroke="#1e3a5f"
              strokeWidth="2"
            />
            {/* Andaman & Nicobar Chain (islands) */}
            <circle cx="880" cy="340" r="4" fill="#14b8a6" />
            <circle cx="885" cy="370" r="3.5" fill="#14b8a6" />
            <circle cx="890" cy="405" r="4" fill="#14b8a6" />

            {/* Lakshadweep Atolls Chain */}
            <circle cx="395" cy="390" r="3.5" fill="#14b8a6" />
            <circle cx="400" cy="420" r="3" fill="#14b8a6" />
            <circle cx="405" cy="450" r="3.5" fill="#14b8a6" />

            {/* Maldives Ridge */}
            <circle cx="430" cy="510" r="3" fill="#14b8a6" />
            <circle cx="435" cy="540" r="3.5" fill="#14b8a6" />

            {/* Geographic Labels */}
            <text x="210" y="240" fill="#38bdf8" fontSize="15" fontFamily="monospace" opacity="0.45" letterSpacing="4">
              ARABIAN SEA
            </text>
            <text x="660" y="240" fill="#38bdf8" fontSize="15" fontFamily="monospace" opacity="0.45" letterSpacing="4">
              BAY OF BENGAL
            </text>
            <text x="440" y="580" fill="#38bdf8" fontSize="14" fontFamily="monospace" opacity="0.4" letterSpacing="4">
              EQUATORIAL JET ZONE
            </text>
            <text x="430" y="160" fill="#64748b" fontSize="13" fontFamily="sans-serif" opacity="0.5" letterSpacing="2">
              INDIA
            </text>
          </svg>

          {/* Coordinate Marks */}
          <div className="absolute top-2 left-3 text-[10px] font-mono text-slate-500">25°N, 55°E</div>
          <div className="absolute top-2 right-3 text-[10px] font-mono text-slate-500">25°N, 95°E</div>
          <div className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-500">02°N, 55°E</div>
          <div className="absolute bottom-2 right-3 text-[10px] font-mono text-slate-500">02°N, 95°E</div>

          {/* Sensor Nodes (Clickable Points with Glowing Radar Pulse) */}
          {OCEAN_STATIONS.map((station) => {
            const isHovered = hoveredStation?.id === station.id;
            const isSelected = selectedStation?.id === station.id;

            return (
              <div
                key={station.id}
                style={{
                  left: `${station.mapPosition.x}%`,
                  top: `${station.mapPosition.y}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group/node"
                onMouseEnter={() => setHoveredStation(station)}
                onMouseLeave={() => setHoveredStation(null)}
                onClick={(e) => handleStationClick(e, station)}
              >
                {/* Radar ripple animation */}
                <div className="absolute inset-0 -m-3 w-10 h-10 rounded-full border border-cyan-400/40 animate-radar-ring pointer-events-none" />
                <div className="absolute inset-0 -m-6 w-16 h-16 rounded-full border border-teal-500/20 animate-radar-ring [animation-delay:1.5s] pointer-events-none" />

                {/* Core Node Button */}
                <button
                  className={`relative flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-full transition-all duration-300 cursor-pointer shadow-lg ${
                    isSelected
                      ? 'bg-teal-400 text-slate-950 scale-125 ring-4 ring-teal-400/40 shadow-teal-500/50'
                      : isHovered
                      ? 'bg-cyan-300 text-slate-950 scale-125 ring-4 ring-cyan-400/50 shadow-cyan-400/60'
                      : 'bg-cyan-950/90 text-cyan-300 border-2 border-cyan-400 hover:scale-115'
                  }`}
                  aria-label={`Dive into ${station.name}`}
                >
                  <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin [animation-duration:12s]" />
                  <span className="sr-only">{station.name}</span>
                </button>

                {/* Node Label (Always visible or highlighted) */}
                <div
                  className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 rounded bg-[#030914]/90 border text-xs font-mono whitespace-nowrap transition-all duration-200 pointer-events-none ${
                    isHovered || isSelected
                      ? 'border-cyan-400 text-cyan-200 scale-105 shadow-md shadow-cyan-950/80 z-30'
                      : 'border-slate-800 text-slate-300 opacity-80'
                  }`}
                >
                  {station.name}
                </div>
              </div>
            );
          })}

          {/* Interactive Floating Hover Telemetry Card */}
          {hoveredStation && (
            <div
              className="absolute z-40 pointer-events-none glass-panel-glow p-4 rounded-lg text-slate-100 max-w-xs transition-opacity duration-200"
              style={{
                left: `${Math.min(78, Math.max(22, hoveredStation.mapPosition.x))}%`,
                top: `${hoveredStation.mapPosition.y > 60 ? hoveredStation.mapPosition.y - 28 : hoveredStation.mapPosition.y + 12}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-cyan-900/60 pb-2 mb-2.5">
                <span className="font-display font-semibold text-sm text-cyan-300">
                  {hoveredStation.name}
                </span>
                <span className="text-[11px] font-mono text-cyan-400/80">
                  {hoveredStation.coords.displayCoords}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-2.5">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                  <span>SST: <strong className="text-white tabular-nums">{hoveredStation.sst}°C</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Droplets className="w-3.5 h-3.5 text-sky-400" />
                  <span>Sal: <strong className="text-white tabular-nums">{hoveredStation.surfaceSalinity}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Wind className="w-3.5 h-3.5 text-teal-400" />
                  <span>Wind: <strong className="text-white tabular-nums">{hoveredStation.windSpeedKnots}kt</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <ArrowDownRight className="w-3.5 h-3.5 text-indigo-400" />
                  <span>MLD: <strong className="text-white tabular-nums">{hoveredStation.mixedLayerDepthM}m</strong></span>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-snug">
                {hoveredStation.historicalAnomaly}
              </p>

              <div className="mt-2.5 pt-2 border-t border-cyan-900/40 flex items-center justify-between text-[11px] text-cyan-400 font-mono">
                <span>Click to initiate dive</span>
                <span className="animate-pulse">0m → 1000m ▼</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Station Selector Bar at Bottom */}
      <div className="relative z-10 px-6 py-4 bg-[#030814]/90 border-t border-cyan-900/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span className="font-mono">5 ACTIVE RECONSTRUCTION STATIONS</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {OCEAN_STATIONS.map((station) => (
              <button
                key={station.id}
                onClick={(e) => handleStationClick(e, station)}
                className={`px-3 py-1.5 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                  selectedStation.id === station.id
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-400/50 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-cyan-200 hover:border-cyan-800/80'
                }`}
              >
                {station.region}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
