import React from 'react';
import { OceanStation, DepthBand } from '../types';
import { Thermometer, Layers, Waves, ArrowRight } from 'lucide-react';

interface StratifiedLayersViewProps {
  station: OceanStation;
  currentDepth: number;
  onSelectDepth: (depth: number) => void;
  onSwitchToDiveMode: () => void;
}

export const StratifiedLayersView: React.FC<StratifiedLayersViewProps> = ({
  station,
  currentDepth,
  onSelectDepth,
  onSwitchToDiveMode,
}) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100">
      {/* Header and overview */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-cyan-900/40 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-teal-400 uppercase tracking-widest mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>2D Oceanographic Strata & Temperature Profile Transect</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            {station.name} — Vertical Column Section
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Reconstructed from satellite SST (OSTIA) and sea surface height (DUACS) validated against in-situ ARGO profiles.
          </p>
        </div>

        <button
          onClick={onSwitchToDiveMode}
          className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded transition-colors cursor-pointer self-start md:self-auto"
        >
          <Waves className="w-4 h-4" />
          <span>Switch to Immersive Fluid Dive</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive 2D Stratified Layers Stack */}
        <div className="lg:col-span-2 space-y-3">
          {station.depthProfiles.map((band: DepthBand) => {
            const isSelected = Math.abs(currentDepth - band.depth) < 25;

            return (
              <div
                key={band.depth}
                onClick={() => onSelectDepth(band.depth)}
                className={`relative rounded-lg p-4 transition-all duration-200 cursor-pointer border ${
                  isSelected
                    ? 'border-teal-400 bg-teal-950/40 shadow-lg shadow-teal-950/60 ring-2 ring-teal-400/30'
                    : 'border-cyan-900/30 bg-[#061021]/70 hover:border-cyan-700/60 hover:bg-[#08152c]'
                }`}
                style={{
                  borderLeftWidth: '6px',
                  borderLeftColor: band.waterColorTop,
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums min-w-[70px]">
                      {band.depth}m
                    </span>
                    <div>
                      <div className="text-xs font-mono text-cyan-400 font-semibold">
                        {band.layerName}
                      </div>
                      <div className="text-xs text-slate-400">
                        Zone: {band.zone} · Pressure: {band.pressureAtm} atm
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-rose-300">
                      <Thermometer className="w-3.5 h-3.5" />
                      <span className="text-base font-semibold tabular-nums">{band.tempC}°C</span>
                    </div>

                    <div className="text-slate-400">
                      Sal: <span className="text-slate-200 tabular-nums">{band.salinityPsu}</span>
                    </div>

                    <div className="text-slate-400">
                      O₂: <span className="text-slate-200 tabular-nums">{band.oxygenMgL}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDepth(band.depth);
                        onSwitchToDiveMode();
                      }}
                      className="px-2.5 py-1 text-[11px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800 rounded hover:bg-cyan-900"
                    >
                      Dive Here
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 mt-2 border-t border-cyan-950/80 pt-2">
                  {band.scientificNote}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right Col: Continuous Vertical Thermal Decay Curve & Scientific Legend */}
        <div className="space-y-4">
          <div className="glass-panel p-4 rounded-xl border border-cyan-900/40">
            <h3 className="font-display font-bold text-sm text-cyan-300 mb-3 flex items-center justify-between">
              <span>Subsurface Temperature Profile T(z)</span>
              <span className="text-xs font-mono text-slate-400">0 – 1000m</span>
            </h3>

            {/* SVG Temperature Curve */}
            <div className="relative w-full aspect-[4/5] bg-[#020712] rounded border border-cyan-950 p-2">
              <svg className="w-full h-full" viewBox="0 0 200 300">
                {/* Horizontal Depth grid lines */}
                {[0, 50, 100, 200, 300, 500, 1000].map((d, i) => {
                  const y = (i / 6) * 260 + 20;
                  return (
                    <g key={d}>
                      <line x1="30" y1={y} x2="190" y2={y} stroke="#0f1f38" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="5" y={y + 3} fill="#64748b" fontSize="8" fontFamily="monospace">
                        {d}m
                      </text>
                    </g>
                  );
                })}

                {/* Temperature axes (5°C to 30°C) */}
                <line x1="40" y1="20" x2="40" y2="280" stroke="#1e293b" strokeWidth="1" />
                <line x1="40" y1="280" x2="190" y2="280" stroke="#1e293b" strokeWidth="1" />
                <text x="40" y="295" fill="#64748b" fontSize="8" fontFamily="monospace">5°C</text>
                <text x="110" y="295" fill="#64748b" fontSize="8" fontFamily="monospace">18°C</text>
                <text x="175" y="295" fill="#64748b" fontSize="8" fontFamily="monospace">30°C</text>

                {/* Plotted Temperature Profile curve */}
                {(() => {
                  const points = station.depthProfiles.map((p, idx) => {
                    const y = (idx / (station.depthProfiles.length - 1)) * 260 + 20;
                    // Map 5°C to 40px and 30°C to 185px
                    const x = 40 + ((p.tempC - 5) / 25) * 145;
                    return `${x},${y}`;
                  });
                  return (
                    <polyline
                      fill="none"
                      stroke="#2dd4bf"
                      strokeWidth="2.5"
                      points={points.join(' ')}
                    />
                  );
                })()}

                {/* Data points */}
                {station.depthProfiles.map((p, idx) => {
                  const y = (idx / (station.depthProfiles.length - 1)) * 260 + 20;
                  const x = 40 + ((p.tempC - 5) / 25) * 145;
                  const isCurrent = Math.abs(currentDepth - p.depth) < 25;
                  return (
                    <circle
                      key={p.depth}
                      cx={x}
                      cy={y}
                      r={isCurrent ? 5 : 3.5}
                      fill={isCurrent ? '#f43f5e' : '#38bdf8'}
                      stroke="#020712"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>
            </div>

            <div className="mt-3 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Surface Mixed Layer:</span>
                <span className="font-mono text-cyan-300 font-semibold">{station.mixedLayerDepthM}m</span>
              </div>
              <div className="flex items-center justify-between">
                <span>D20 Thermocline:</span>
                <span className="font-mono text-teal-300 font-semibold">{station.thermoclineDepthM}m</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Validation:</span>
                <span className="font-mono text-emerald-400">ARGO Float Collocated</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-cyan-900/40 text-xs">
            <h4 className="font-display font-semibold text-white mb-1.5">
              Oceanographic Explanation
            </h4>
            <p className="text-slate-300 leading-relaxed">
              In the North Indian Ocean, the thermocline separates the warm, sunlit mixed layer from the cold abyssal water. The steep slope between 50m and 200m prevents nutrient upwelling except during seasonal monsoon wind bursts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
