import React from 'react';
import { Volume2, VolumeX, Sparkles, Trophy, Compass, Layers, Fish } from 'lucide-react';

interface TopNavProps {
  currentView: 'map' | 'dive' | 'layers';
  onSelectView: (view: 'map' | 'dive' | 'layers') => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenLeaderboard: () => void;
  onOpenSpecies: () => void;
  onOpenConceptPrompts: () => void;
  score: number;
  maxDepthReached: number;
  badgesCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentView,
  onSelectView,
  soundEnabled,
  onToggleSound,
  onOpenLeaderboard,
  onOpenSpecies,
  onOpenConceptPrompts,
  score,
  maxDepthReached,
  badgesCount,
}) => {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-[#050b14]/85 backdrop-blur-md border-b border-cyan-900/30">
      {/* Zone 1: Brand Wordmark (Single text element in display face) */}
      <button
        onClick={() => onSelectView('map')}
        className="font-display text-lg sm:text-xl font-bold tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer text-left uppercase"
      >
        Ocean Deja Vu
      </button>

      {/* Zone 2: 4-6 Clean Text Navigation Links */}
      <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
        <button
          onClick={() => onSelectView('map')}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
            currentView === 'map'
              ? 'text-cyan-400 font-semibold underline underline-offset-8 decoration-cyan-400 decoration-2'
              : 'hover:text-cyan-200'
          }`}
        >
          <Compass className="w-4 h-4 text-cyan-500" />
          <span>Ocean Map</span>
        </button>

        <button
          onClick={() => onSelectView('dive')}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
            currentView === 'dive'
              ? 'text-cyan-400 font-semibold underline underline-offset-8 decoration-cyan-400 decoration-2'
              : 'hover:text-cyan-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Dive View</span>
        </button>

        <button
          onClick={() => onSelectView('layers')}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
            currentView === 'layers'
              ? 'text-cyan-400 font-semibold underline underline-offset-8 decoration-cyan-400 decoration-2'
              : 'hover:text-cyan-200'
          }`}
        >
          <Layers className="w-4 h-4 text-teal-400" />
          <span>2D Layers</span>
        </button>

        <button
          onClick={onOpenSpecies}
          className="flex items-center gap-1.5 hover:text-cyan-200 transition-colors cursor-pointer"
        >
          <Fish className="w-4 h-4 text-sky-400" />
          <span>Marine Catalog</span>
        </button>

        <button
          onClick={onOpenLeaderboard}
          className="flex items-center gap-1.5 hover:text-cyan-200 transition-colors cursor-pointer"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Leaderboard</span>
        </button>
      </nav>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Telemetry quick summary without pill boxes - clean typographic presentation */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-slate-400 border-r border-slate-800 pr-4">
          <div>
            <span className="text-slate-500 mr-1.5">MAX</span>
            <span className="text-cyan-300 font-semibold tabular-nums">{maxDepthReached}m</span>
          </div>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <div>
            <span className="text-slate-500 mr-1.5">SCORE</span>
            <span className="text-teal-300 font-semibold tabular-nums">{score}</span>
          </div>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <div>
            <span className="text-slate-500 mr-1.5">BADGES</span>
            <span className="text-amber-300 font-semibold tabular-nums">{badgesCount}</span>
          </div>
        </div>

        {/* Advance Image Concept Prompt Trigger */}
        <button
          onClick={onOpenConceptPrompts}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-200 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/50 rounded transition-colors cursor-pointer whitespace-nowrap"
          title="View & Copy Advance Concept Generation Prompts"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Concept Prompts</span>
        </button>

        {/* Audio Mute/Unmute */}
        <button
          onClick={onToggleSound}
          className={`p-2 rounded border transition-colors cursor-pointer ${
            soundEnabled
              ? 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60 hover:bg-cyan-900/50'
              : 'text-slate-500 bg-slate-900/40 border-slate-800 hover:text-slate-300'
          }`}
          title={soundEnabled ? 'Mute Sonar & Ocean Audio' : 'Enable Ocean Audio'}
          aria-label={soundEnabled ? 'Mute audio' : 'Enable audio'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Mobile menu link shortcuts */}
        <div className="flex md:hidden items-center gap-1">
          <button
            onClick={() => onSelectView(currentView === 'map' ? 'dive' : 'map')}
            className="p-2 text-cyan-400 bg-cyan-950/40 border border-cyan-800/60 rounded"
            title="Toggle View"
          >
            {currentView === 'map' ? <Compass className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
          </button>
          <button
            onClick={onOpenLeaderboard}
            className="p-2 text-amber-400 bg-amber-950/30 border border-amber-800/50 rounded"
            title="Leaderboard"
          >
            <Trophy className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
