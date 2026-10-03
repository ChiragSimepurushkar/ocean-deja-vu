import React, { useState, useEffect, useCallback, useRef } from 'react';
import { OceanStation, DepthBand, MarineSpecies } from '../types';
import { STANDARD_DEPTH_STOPS } from '../data/oceanData';
import { Ocean3DScene } from './3d/Ocean3DScene';
import { ParallaxUnderwaterScene } from './ParallaxUnderwaterScene';
import { HudGlassPanel } from './HudGlassPanel';
import { Play, Pause, ArrowLeft, Sparkles, CheckCircle2, Box, Layers } from 'lucide-react';
import { updateUnderwaterDepthAcoustics } from '../utils/audio';

interface DiveExperienceProps {
  station: OceanStation;
  currentDepth: number;
  onDepthChange: (depth: number) => void;
  onBackToMap: () => void;
  onDiscoverSpecies: (species: MarineSpecies) => void;
  discoveredSpeciesIds: string[];
  soundEnabled: boolean;
  score: number;
}

export const DiveExperience: React.FC<DiveExperienceProps> = ({
  station,
  currentDepth,
  onDepthChange,
  onBackToMap,
  onDiscoverSpecies,
  discoveredSpeciesIds,
  soundEnabled,
  score,
}) => {
  const [renderMode, setRenderMode] = useState<'3d' | '2d'>('3d');
  const [isAutoDiving, setIsAutoDiving] = useState(false);
  const [activeSpecimenToast, setActiveSpecimenToast] = useState<MarineSpecies | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Find the active depth band closest to currentDepth
  const currentBand: DepthBand = station.depthProfiles.reduce((prev, curr) => {
    return Math.abs(curr.depth - currentDepth) < Math.abs(prev.depth - currentDepth)
      ? curr
      : prev;
  }, station.depthProfiles[0]);

  // Handle acoustic filtering based on depth
  useEffect(() => {
    if (soundEnabled) {
      updateUnderwaterDepthAcoustics(currentDepth);
    }
  }, [currentDepth, soundEnabled]);

  // Auto-diving interval
  useEffect(() => {
    if (!isAutoDiving) return;

    const interval = setInterval(() => {
      onDepthChange(Math.min(1000, currentDepth + 5));
      if (currentDepth >= 1000) {
        setIsAutoDiving(false);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isAutoDiving, currentDepth, onDepthChange]);

  // Handle mouse wheel scrolling for fluid depth diving
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // Delta mapping
      const delta = e.deltaY > 0 ? 15 : -15;
      const nextDepth = Math.max(0, Math.min(1000, currentDepth + delta));
      if (nextDepth !== currentDepth) {
        onDepthChange(nextDepth);
      }
    },
    [currentDepth, onDepthChange]
  );

  const handleDescendLayer = () => {
    const nextStops = STANDARD_DEPTH_STOPS.filter((d) => d > currentDepth);
    if (nextStops.length > 0) {
      onDepthChange(nextStops[0]);
    }
  };

  const handleAscendLayer = () => {
    const prevStops = STANDARD_DEPTH_STOPS.filter((d) => d < currentDepth);
    if (prevStops.length > 0) {
      onDepthChange(prevStops[prevStops.length - 1]);
    }
  };

  const handleSpeciesDiscovered = (species: MarineSpecies) => {
    onDiscoverSpecies(species);
    setActiveSpecimenToast(species);
    setTimeout(() => {
      setActiveSpecimenToast(null);
    }, 4000);
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="relative w-full h-[calc(100vh-61px)] overflow-hidden select-none bg-slate-950"
    >
      {/* 1. Underlying Scene: 3D Spatial Scene or 2D Parallax Scene */}
      {renderMode === '3d' ? (
        <Ocean3DScene
          currentDepth={currentDepth}
          onDiscoverSpecies={handleSpeciesDiscovered}
          discoveredSpeciesIds={discoveredSpeciesIds}
        />
      ) : (
        <ParallaxUnderwaterScene
          currentDepth={currentDepth}
          onDiscoverSpecies={handleSpeciesDiscovered}
          discoveredSpeciesIds={discoveredSpeciesIds}
        />
      )}

      {/* 2. Top Controls & Station Info Bar */}
      <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-6 z-30 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onBackToMap}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium text-cyan-200 bg-[#051124]/85 hover:bg-[#071936] border border-cyan-800/60 rounded backdrop-blur-sm transition-colors cursor-pointer shadow-lg"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Surface Map</span>
          </button>

          {/* Mode Switcher: 3D Real Spatial vs 2D Parallax */}
          <div className="flex items-center p-0.5 bg-[#051124]/90 border border-cyan-800/70 rounded backdrop-blur-sm shadow-lg">
            <button
              onClick={() => setRenderMode('3d')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded transition-all cursor-pointer ${
                renderMode === '3d'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-cyan-300/80 hover:text-cyan-100 hover:bg-cyan-950/40'
              }`}
              title="Real WebGL 3D Spatial Dive Experience"
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Spatial</span>
            </button>
            <button
              onClick={() => setRenderMode('2d')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded transition-all cursor-pointer ${
                renderMode === '2d'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-cyan-300/80 hover:text-cyan-100 hover:bg-cyan-950/40'
              }`}
              title="2D Parallax Layers Fallback View"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D Fallback</span>
            </button>
          </div>
        </div>

        {/* Center Auto-dive controls */}
        <div className="pointer-events-auto flex items-center gap-2 bg-[#051124]/85 border border-cyan-800/60 backdrop-blur-sm rounded px-3 py-1.5 shadow-lg">
          <button
            onClick={() => setIsAutoDiving(!isAutoDiving)}
            className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 hover:text-cyan-100 transition-colors cursor-pointer"
          >
            {isAutoDiving ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>Pause Auto-Dive</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-teal-400" />
                <span>Auto-Dive</span>
              </>
            )}
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-xs font-mono text-slate-400">
            Speed: <span className="text-cyan-400">1.2 m/s</span>
          </span>
        </div>

        {/* Score & Exploration Progress indicator */}
        <div className="hidden sm:flex pointer-events-auto items-center gap-2 px-3 py-1.5 text-xs font-mono text-cyan-300 bg-[#051124]/85 border border-cyan-800/60 rounded backdrop-blur-sm shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span>SCORE: <strong className="text-white tabular-nums">{score}</strong></span>
        </div>
      </div>

      {/* 3. Floating HUD Glassmorphic Instrument Telemetry (Left / Center) */}
      <div className="absolute left-4 bottom-4 sm:left-8 sm:bottom-8 z-30 pointer-events-auto max-w-md w-[calc(100%-2rem)]">
        <HudGlassPanel
          currentBand={currentBand}
          station={station}
          onExploreNextDepth={handleDescendLayer}
          onAscendPrevDepth={handleAscendLayer}
          canDescend={currentDepth < 1000}
          canAscend={currentDepth > 0}
        />
      </div>

      {/* 4. Right Vertical Depth Scrubber & Depth Gauge */}
      <div className="absolute right-3 sm:right-6 top-20 bottom-12 z-30 flex flex-col items-center justify-between pointer-events-auto bg-[#040914]/75 backdrop-blur-md border border-cyan-900/50 rounded-full px-2 py-4 shadow-xl">
        <span className="text-[10px] font-mono text-cyan-400 font-semibold mb-1">0m</span>

        {/* Track Slider Bar */}
        <div className="relative flex-1 w-1.5 bg-slate-800 rounded-full my-2 flex items-center justify-center">
          {/* Depth progress fill */}
          <div
            className="absolute top-0 w-full bg-gradient-to-b from-teal-400 via-cyan-500 to-indigo-600 rounded-full"
            style={{ height: `${(currentDepth / 1000) * 100}%` }}
          />

          {/* Draggable/Clickable Thumb Indicator */}
          <div
            className="absolute -translate-y-1/2 w-5 h-5 rounded-full bg-cyan-300 border-2 border-slate-950 shadow-lg shadow-cyan-400/50 flex items-center justify-center"
            style={{ top: `${(currentDepth / 1000) * 100}%` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
          </div>

          {/* Quick Snap Stops along gauge */}
          {STANDARD_DEPTH_STOPS.map((d) => {
            const topPct = (d / 1000) * 100;
            return (
              <button
                key={d}
                onClick={() => onDepthChange(d)}
                style={{ top: `${topPct}%` }}
                className="absolute -right-7 -translate-y-1/2 hidden md:block text-[9px] font-mono text-slate-400 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
              >
                {d}m
              </button>
            );
          })}
        </div>

        <span className="text-[10px] font-mono text-cyan-400 font-semibold mt-1">1000m</span>
      </div>

      {/* 5. Marine Specimen Discovery Popover / Toast */}
      {activeSpecimenToast && (
        <div className="absolute top-18 right-16 sm:right-20 z-40 glass-panel-glow p-4 rounded-xl border border-teal-400/60 max-w-xs animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 text-xs font-mono text-teal-300 uppercase tracking-wider mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            <span>Specimen Cataloged! +{activeSpecimenToast.points} PTS</span>
          </div>
          <h4 className="font-display font-bold text-base text-white">
            {activeSpecimenToast.name}
          </h4>
          <div className="text-[11px] font-mono text-slate-400 italic mb-1.5">
            {activeSpecimenToast.scientificName} · {activeSpecimenToast.depthRange}
          </div>
          <p className="text-xs text-slate-300 leading-snug">
            {activeSpecimenToast.description}
          </p>
        </div>
      )}
    </div>
  );
};
