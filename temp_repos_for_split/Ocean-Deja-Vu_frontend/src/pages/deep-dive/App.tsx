import React, { useState, useEffect, useCallback } from 'react';
import { OceanStation, MarineSpecies, LeaderboardEntry, Badge } from './types';
import { OCEAN_STATIONS, INITIAL_LEADERBOARD, BADGES_CATALOG, STANDARD_DEPTH_STOPS } from './data/oceanData';
import { TopNav } from './components/TopNav';
import { OceanMap } from './components/OceanMap';
import { SplashTransition } from './components/SplashTransition';
import { DiveExperience } from './components/DiveExperience';
import { StratifiedLayersView } from './components/StratifiedLayersView';
import { LeaderboardModal } from './components/LeaderboardModal';
import { SpeciesCatalogModal } from './components/SpeciesCatalogModal';
import { ConceptPromptModal } from './components/ConceptPromptModal';
import {
  startAmbientOceanDrone,
  stopAmbientOceanDrone,
  playSonarPing,
  playBadgeChime,
} from './utils/audio';

const STORAGE_KEY = 'ocean_deja_vu_player_progress_v1';

export default function App() {
  const [currentView, setCurrentView] = useState<'map' | 'dive' | 'layers'>('map');
  const [selectedStation, setSelectedStation] = useState<OceanStation>(OCEAN_STATIONS[0]);
  const [currentDepth, setCurrentDepth] = useState<number>(0);
  const [splashState, setSplashState] = useState<{ active: boolean; x: number; y: number } | null>(null);

  // Player progress & gamification state
  const [callsign, setCallsign] = useState<string>('Explorer-One');
  const [score, setScore] = useState<number>(0);
  const [maxDepthReached, setMaxDepthReached] = useState<number>(0);
  const [unlockedDepths, setUnlockedDepths] = useState<number[]>([]);
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<string[]>([]);
  const [discoveredSpeciesIds, setDiscoveredSpeciesIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Modals
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showSpeciesCatalog, setShowSpeciesCatalog] = useState<boolean>(false);
  const [showConceptPrompts, setShowConceptPrompts] = useState<boolean>(false);

  // Toast notification for badge unlocks
  const [activeBadgeToast, setActiveBadgeToast] = useState<Badge | null>(null);

  // 1. Load progress from storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.callsign) setCallsign(parsed.callsign);
        if (typeof parsed.score === 'number') setScore(parsed.score);
        if (typeof parsed.maxDepthReached === 'number') setMaxDepthReached(parsed.maxDepthReached);
        if (Array.isArray(parsed.unlockedDepths)) setUnlockedDepths(parsed.unlockedDepths);
        if (Array.isArray(parsed.unlockedBadgeIds)) setUnlockedBadgeIds(parsed.unlockedBadgeIds);
        if (Array.isArray(parsed.discoveredSpeciesIds)) setDiscoveredSpeciesIds(parsed.discoveredSpeciesIds);
        if (typeof parsed.soundEnabled === 'boolean') setSoundEnabled(parsed.soundEnabled);
      }
    } catch {
      // Storage fallback
    }
  }, []);

  // 2. Persist progress
  useEffect(() => {
    try {
      const data = {
        callsign,
        score,
        maxDepthReached,
        unlockedDepths,
        unlockedBadgeIds,
        discoveredSpeciesIds,
        soundEnabled,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage fallback
    }
  }, [callsign, score, maxDepthReached, unlockedDepths, unlockedBadgeIds, discoveredSpeciesIds, soundEnabled]);

  // 3. Audio ambient drone control based on view
  useEffect(() => {
    if (currentView === 'dive' && soundEnabled) {
      startAmbientOceanDrone(true, currentDepth);
    } else {
      stopAmbientOceanDrone();
    }
  }, [currentView, soundEnabled, currentDepth]);

  // 4. Milestone and Badge Unlock Checker
  const checkMilestones = useCallback(
    (newDepth: number) => {
      // Update max depth
      if (newDepth > maxDepthReached) {
        setMaxDepthReached(newDepth);
      }

      // Check depth stops unlocked
      const reachedStops = STANDARD_DEPTH_STOPS.filter((stop) => newDepth >= stop);
      let newScore = score;
      let depthAdded = false;

      setUnlockedDepths((prev) => {
        const updated = [...prev];
        reachedStops.forEach((stop) => {
          if (!updated.includes(stop)) {
            updated.push(stop);
            newScore += 100;
            depthAdded = true;
          }
        });
        return updated;
      });

      if (depthAdded) {
        setScore(newScore);
        playSonarPing(soundEnabled);
      }

      // Check Badges
      BADGES_CATALOG.forEach((badge) => {
        if (!unlockedBadgeIds.includes(badge.id)) {
          let shouldUnlock = false;

          if (badge.depthTrigger !== undefined && newDepth >= badge.depthTrigger) {
            shouldUnlock = true;
          }

          if (shouldUnlock) {
            setUnlockedBadgeIds((prev) => [...prev, badge.id]);
            setScore((s) => s + 150);
            playBadgeChime(soundEnabled);
            setActiveBadgeToast(badge);
            setTimeout(() => {
              setActiveBadgeToast(null);
            }, 4500);
          }
        }
      });
    },
    [maxDepthReached, score, soundEnabled, unlockedBadgeIds]
  );

  // Handle Depth Changes
  const handleDepthChange = (depth: number) => {
    setCurrentDepth(depth);
    checkMilestones(depth);
  };

  // Handle clicking a station on the map
  const handleSelectStationAndDive = (station: OceanStation, clickX: number, clickY: number) => {
    setSelectedStation(station);
    // Start splash transition
    setSplashState({
      active: true,
      x: clickX,
      y: clickY,
    });
  };

  // Splash completed handler
  const handleSplashComplete = () => {
    setSplashState(null);
    setCurrentDepth(0);
    setCurrentView('dive');
    checkMilestones(0);
  };

  // Handle discovering marine species
  const handleDiscoverSpecies = (species: MarineSpecies) => {
    if (!discoveredSpeciesIds.includes(species.id)) {
      setDiscoveredSpeciesIds((prev) => {
        const next = [...prev, species.id];
        // Check collector badge
        if (next.length >= 5 && !unlockedBadgeIds.includes('badge-collector')) {
          setUnlockedBadgeIds((b) => [...b, 'badge-collector']);
          const colBadge = BADGES_CATALOG.find((b) => b.id === 'badge-collector');
          if (colBadge) {
            setActiveBadgeToast(colBadge);
            playBadgeChime(soundEnabled);
            setTimeout(() => setActiveBadgeToast(null), 4500);
          }
        }
        return next;
      });
      setScore((s) => s + species.points);
      playBadgeChime(soundEnabled);
    }
  };

  // Compile Leaderboard with current user
  const leaderboardEntries: LeaderboardEntry[] = [
    {
      id: 'current-user',
      callsign,
      maxDepth: maxDepthReached,
      score,
      badgesCount: unlockedBadgeIds.length,
      speciesDiscovered: discoveredSpeciesIds.length,
      favoriteStation: selectedStation.name,
      date: 'Active Now',
      isCurrentUser: true,
    },
    ...INITIAL_LEADERBOARD,
  ];

  return (
    <div className="min-h-screen bg-[#040914] text-slate-100 flex flex-col relative selection:bg-cyan-500 selection:text-slate-950 font-sans">
      {/* Top Bar (adhering strictly to Top Bar Contract) */}
      <TopNav
        currentView={currentView}
        onSelectView={setCurrentView}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onOpenLeaderboard={() => setShowLeaderboard(true)}
        onOpenSpecies={() => setShowSpeciesCatalog(true)}
        onOpenConceptPrompts={() => setShowConceptPrompts(true)}
        score={score}
        maxDepthReached={maxDepthReached}
        badgesCount={unlockedBadgeIds.length}
      />

      {/* Main View Area */}
      <main className="flex-1 relative flex flex-col">
        {currentView === 'map' && (
          <OceanMap
            selectedStation={selectedStation}
            onSelectStationAndDive={handleSelectStationAndDive}
          />
        )}

        {currentView === 'dive' && (
          <DiveExperience
            station={selectedStation}
            currentDepth={currentDepth}
            onDepthChange={handleDepthChange}
            onBackToMap={() => setCurrentView('map')}
            onDiscoverSpecies={handleDiscoverSpecies}
            discoveredSpeciesIds={discoveredSpeciesIds}
            soundEnabled={soundEnabled}
            score={score}
          />
        )}

        {currentView === 'layers' && (
          <StratifiedLayersView
            station={selectedStation}
            currentDepth={currentDepth}
            onSelectDepth={(d) => setCurrentDepth(d)}
            onSwitchToDiveMode={() => setCurrentView('dive')}
          />
        )}
      </main>

      {/* Splash Transition Overlay */}
      {splashState?.active && (
        <SplashTransition
          clickX={splashState.x}
          clickY={splashState.y}
          soundEnabled={soundEnabled}
          stationName={selectedStation.name}
          onComplete={handleSplashComplete}
        />
      )}

      {/* Badge Unlocked Notification Banner */}
      {activeBadgeToast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 glass-panel-glow px-6 py-3.5 rounded-xl border border-amber-400/80 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="text-3xl">{activeBadgeToast.icon}</span>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
              Milestone Badge Awarded! +150 PTS
            </div>
            <div className="font-display font-bold text-white text-sm">
              {activeBadgeToast.name}
            </div>
            <div className="text-xs text-slate-300">
              {activeBadgeToast.description}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        entries={leaderboardEntries}
        unlockedBadgeIds={unlockedBadgeIds}
        userCallsign={callsign}
        onUpdateCallsign={setCallsign}
        userScore={score}
        maxDepthReached={maxDepthReached}
      />

      <SpeciesCatalogModal
        isOpen={showSpeciesCatalog}
        onClose={() => setShowSpeciesCatalog(false)}
        discoveredSpeciesIds={discoveredSpeciesIds}
      />

      <ConceptPromptModal
        isOpen={showConceptPrompts}
        onClose={() => setShowConceptPrompts(false)}
      />
    </div>
  );
}
