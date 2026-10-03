import React from 'react';
import { DepthBand, OceanStation } from '../types';
import { Thermometer, Droplets, Gauge, Sun, Compass, AlertCircle } from 'lucide-react';

interface HudGlassPanelProps {
  currentBand: DepthBand;
  station: OceanStation;
  onExploreNextDepth: () => void;
  onAscendPrevDepth: () => void;
  canDescend: boolean;
  canAscend: boolean;
}

export const HudGlassPanel: React.FC<HudGlassPanelProps> = ({
  currentBand,
  station,
  onExploreNextDepth,
  onAscendPrevDepth,
  canDescend,
  canAscend,
}) => {
  return (
    <div className="glass-panel p-5 sm:p-6 rounded-xl border border-cyan-500/20 max-w-lg w-full text-slate-100 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Subtle telemetry decorative corner marks */}
      <div className="absolute top-2 left-2 w-2.5 h-2.5 border-t border-l border-cyan-400/40 pointer-events-none" />
      <div className="absolute top-2 right-2 w-2.5 h-2.5 border-t border-r border-cyan-400/40 pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-2.5 h-2.5 border-b border-l border-cyan-400/40 pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b border-r border-cyan-400/40 pointer-events-none" />

      {/* Header telemetry ribbon */}
      <div className="flex items-center justify-between gap-4 border-b border-cyan-900/40 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-300">
            {station.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>{station.coords.displayCoords}</span>
        </div>
      </div>

      {/* Primary Telemetry Readout Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Depth Readout */}
        <div className="bg-[#030914]/70 border border-cyan-900/50 rounded-lg p-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Hydrostatic Depth</span>
            <span className="text-cyan-400 font-semibold">{currentBand.zone}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-mono font-bold text-white tabular-nums">
              {currentBand.depth}
            </span>
            <span className="text-sm font-mono text-cyan-400">METERS</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            Pressure: <span className="text-slate-200 tabular-nums">{currentBand.pressureAtm} atm</span>
          </div>
        </div>

        {/* Temperature Readout */}
        <div className="bg-[#030914]/70 border border-cyan-900/50 rounded-lg p-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-rose-400" />
              <span>In-Situ Temp</span>
            </span>
            <span className="text-[10px] text-teal-400 font-mono">RECONSTRUCTED</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-mono font-bold text-cyan-200 tabular-nums">
              {currentBand.tempC.toFixed(1)}
            </span>
            <span className="text-sm font-mono text-cyan-400">°C</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            Delta from SST: <span className="text-cyan-300 tabular-nums">-{(station.sst - currentBand.tempC).toFixed(1)}°C</span>
          </div>
        </div>
      </div>

      {/* Layer Scientific Classification */}
      <div className="mb-4">
        <div className="text-xs font-mono text-teal-400 uppercase tracking-wider mb-1">
          Oceanographic Stratum
        </div>
        <h3 className="font-display text-lg sm:text-xl font-bold text-white tracking-wide">
          {currentBand.layerName}
        </h3>
        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
          {currentBand.scientificNote}
        </p>
      </div>

      {/* Secondary Sensor Metrics: Salinity, Oxygen, Light */}
      <div className="grid grid-cols-3 gap-2 py-3 border-y border-cyan-900/40 text-xs font-mono mb-4">
        <div className="flex flex-col">
          <span className="text-slate-400 text-[10px] flex items-center gap-1">
            <Droplets className="w-3 h-3 text-sky-400" />
            <span>SALINITY</span>
          </span>
          <span className="text-sm font-semibold text-slate-200 tabular-nums mt-0.5">
            {currentBand.salinityPsu} <span className="text-[10px] text-slate-400 font-normal">PSU</span>
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-slate-400 text-[10px] flex items-center gap-1">
            <Gauge className="w-3 h-3 text-teal-400" />
            <span>DISSOLVED O₂</span>
          </span>
          <span className="text-sm font-semibold text-slate-200 tabular-nums mt-0.5">
            {currentBand.oxygenMgL} <span className="text-[10px] text-slate-400 font-normal">mg/L</span>
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-slate-400 text-[10px] flex items-center gap-1">
            <Sun className="w-3 h-3 text-amber-400" />
            <span>LIGHT FLUX</span>
          </span>
          <span className="text-sm font-semibold text-slate-200 tabular-nums mt-0.5">
            {currentBand.lightPercent}% <span className="text-[10px] text-slate-400 font-normal">surface</span>
          </span>
        </div>
      </div>

      {/* Quick Dive Navigation Controls */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onAscendPrevDepth}
          disabled={!canAscend}
          className={`px-4 py-2 text-xs font-mono rounded transition-colors cursor-pointer ${
            canAscend
              ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700'
              : 'opacity-40 cursor-not-allowed bg-slate-900 text-slate-600 border border-slate-800'
          }`}
        >
          ▲ Ascend Layer
        </button>

        <span className="text-[11px] font-mono text-slate-400">
          Scroll or click to dive
        </span>

        <button
          onClick={onExploreNextDepth}
          disabled={!canDescend}
          className={`px-4 py-2 text-xs font-mono rounded font-semibold transition-all cursor-pointer ${
            canDescend
              ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md shadow-teal-500/20'
              : 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-600'
          }`}
        >
          Descend Layer ▼
        </button>
      </div>
    </div>
  );
};
