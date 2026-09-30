import React, { useState, useEffect, useRef } from 'react';
import { MarineSpecies } from '../types';
import { MARINE_SPECIES_CATALOG } from '../data/oceanData';
import {
  LOTTIE_PELAGIC_TUNA,
  LOTTIE_REEF_DAMSELFISH,
  LOTTIE_MANTA_RAY,
  LOTTIE_JELLYFISH,
  LOTTIE_ANGLERFISH,
  LOTTIE_GLASS_SQUID,
  LOTTIE_SWAYING_KELP,
  LOTTIE_CORAL_FAN,
  LOTTIE_ABYSSAL_CRINOID,
} from '../data/lottieAnimations';
import { LottieCreature } from './LottieCreature';
import { LottiePlant } from './LottiePlant';
import { LightShafts } from './LightShafts';
import { MarineSnowParticles } from './MarineSnowParticles';

interface ParallaxUnderwaterSceneProps {
  currentDepth: number; // 0 to 1000m
  onDiscoverSpecies: (species: MarineSpecies) => void;
  discoveredSpeciesIds: string[];
  flashlightOn?: boolean;
}

interface CreatureActor {
  id: string;
  name: string;
  lottieData: Record<string, unknown>;
  layer: 'background' | 'midground' | 'foreground';
  baseSize: number;
  scale: number; // 0.6x to 1.4x
  speed: number;
  direction: 1 | -1;
  minDepth: number;
  maxDepth: number;
  initialX: number;
  yPercent: number; // 15% to 85% of screen height
  oscFreq: number;
  oscAmp: number;
  oscPhase: number;
  glowColor?: string;
  speciesRef: MarineSpecies;
}

export const ParallaxUnderwaterScene: React.FC<ParallaxUnderwaterSceneProps> = ({
  currentDepth,
  onDiscoverSpecies,
  discoveredSpeciesIds,
  flashlightOn = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [actors, setActors] = useState<CreatureActor[]>([]);
  const [actorPositions, setActorPositions] = useState<{ [id: string]: { x: number; y: number } }>({});
  const animFrameRef = useRef<number | null>(null);

  // Initialize creature actors with varied sizes (0.6x - 1.4x), speeds, layers, and paths
  useEffect(() => {
    const speciesMap = new Map<string, MarineSpecies>();
    MARINE_SPECIES_CATALOG.forEach((s) => speciesMap.set(s.id, s));

    const initialActors: CreatureActor[] = [
      // === 0m - 60m Surface / Photic Zone ===
      // Tuna 1 (Foreground, large, fast)
      {
        id: 'tuna-fg',
        name: 'Yellowfin Tuna',
        lottieData: LOTTIE_PELAGIC_TUNA,
        layer: 'foreground',
        baseSize: 140,
        scale: 1.35, // 1.35x
        speed: 1.6,
        direction: 1,
        minDepth: 0,
        maxDepth: 90,
        initialX: 50,
        yPercent: 30,
        oscFreq: 0.04,
        oscAmp: 18,
        oscPhase: 0,
        speciesRef: speciesMap.get('yellowfin-tuna') || MARINE_SPECIES_CATALOG[1],
      },
      // Flyingfish (Midground, swift)
      {
        id: 'flying-fish-mg',
        name: 'Indian Ocean Flyingfish',
        lottieData: LOTTIE_PELAGIC_TUNA,
        layer: 'midground',
        baseSize: 100,
        scale: 0.95, // 0.95x
        speed: 1.4,
        direction: 1,
        minDepth: 0,
        maxDepth: 45,
        initialX: 350,
        yPercent: 20,
        oscFreq: 0.06,
        oscAmp: 14,
        oscPhase: 1.2,
        speciesRef: speciesMap.get('flying-fish') || MARINE_SPECIES_CATALOG[0],
      },
      // Reef Fish / Turtle Companion (Background, small, relaxed)
      {
        id: 'reef-bg-1',
        name: 'Coral Damselfish',
        lottieData: LOTTIE_REEF_DAMSELFISH,
        layer: 'background',
        baseSize: 90,
        scale: 0.68, // 0.68x
        speed: 0.7,
        direction: -1,
        minDepth: 0,
        maxDepth: 65,
        initialX: 700,
        yPercent: 55,
        oscFreq: 0.03,
        oscAmp: 12,
        oscPhase: 2.5,
        speciesRef: speciesMap.get('hawksbill-turtle') || MARINE_SPECIES_CATALOG[3],
      },
      // Damselfish schooler (Midground)
      {
        id: 'reef-mg-1',
        name: 'Reef Damselfish',
        lottieData: LOTTIE_REEF_DAMSELFISH,
        layer: 'midground',
        baseSize: 100,
        scale: 1.05, // 1.05x
        speed: 0.9,
        direction: -1,
        minDepth: 5,
        maxDepth: 75,
        initialX: 520,
        yPercent: 40,
        oscFreq: 0.05,
        oscAmp: 16,
        oscPhase: 0.8,
        speciesRef: speciesMap.get('yellowfin-tuna') || MARINE_SPECIES_CATALOG[1],
      },

      // === 50m - 150m Upper Thermocline Zone ===
      // Manta Ray (Midground, majestic glide)
      {
        id: 'manta-mg',
        name: 'Oceanic Manta Ray',
        lottieData: LOTTIE_MANTA_RAY,
        layer: 'midground',
        baseSize: 180,
        scale: 1.15, // 1.15x
        speed: 0.85,
        direction: 1,
        minDepth: 25,
        maxDepth: 140,
        initialX: 180,
        yPercent: 45,
        oscFreq: 0.025,
        oscAmp: 22,
        oscPhase: 1.9,
        glowColor: '#2dd4bf',
        speciesRef: speciesMap.get('reef-manta') || MARINE_SPECIES_CATALOG[2],
      },
      // Distant Manta (Background, small & blurred)
      {
        id: 'manta-bg',
        name: 'Oceanic Manta Ray (Distant)',
        lottieData: LOTTIE_MANTA_RAY,
        layer: 'background',
        baseSize: 150,
        scale: 0.62, // 0.62x
        speed: 0.55,
        direction: 1,
        minDepth: 35,
        maxDepth: 130,
        initialX: 620,
        yPercent: 28,
        oscFreq: 0.02,
        oscAmp: 12,
        oscPhase: 3.1,
        glowColor: '#2dd4bf',
        speciesRef: speciesMap.get('reef-manta') || MARINE_SPECIES_CATALOG[2],
      },

      // === 100m - 300m Lower Thermocline & Mesopelagic ===
      // Rainbow Comb Jelly (Foreground, pulsating close to lens)
      {
        id: 'jelly-fg',
        name: 'Rainbow Ctenophore',
        lottieData: LOTTIE_JELLYFISH,
        layer: 'foreground',
        baseSize: 120,
        scale: 1.25, // 1.25x
        speed: 0.45,
        direction: 1,
        minDepth: 75,
        maxDepth: 260,
        initialX: 250,
        yPercent: 50,
        oscFreq: 0.03,
        oscAmp: 18,
        oscPhase: 0.5,
        glowColor: '#34d399',
        speciesRef: speciesMap.get('comb-jelly') || MARINE_SPECIES_CATALOG[4],
      },
      // Distant Comb Jelly (Background)
      {
        id: 'jelly-bg',
        name: 'Rainbow Ctenophore',
        lottieData: LOTTIE_JELLYFISH,
        layer: 'background',
        baseSize: 95,
        scale: 0.72, // 0.72x
        speed: 0.35,
        direction: -1,
        minDepth: 90,
        maxDepth: 290,
        initialX: 680,
        yPercent: 35,
        oscFreq: 0.025,
        oscAmp: 15,
        oscPhase: 2.2,
        glowColor: '#34d399',
        speciesRef: speciesMap.get('comb-jelly') || MARINE_SPECIES_CATALOG[4],
      },

      // === 250m - 650m Twilight Mesopelagic Zone ===
      // Cockatoo Glass Squid (Midground, darting)
      {
        id: 'squid-mg',
        name: 'Cockatoo Glass Squid',
        lottieData: LOTTIE_GLASS_SQUID,
        layer: 'midground',
        baseSize: 130,
        scale: 1.0, // 1.0x
        speed: 0.75,
        direction: -1,
        minDepth: 230,
        maxDepth: 620,
        initialX: 420,
        yPercent: 42,
        oscFreq: 0.045,
        oscAmp: 20,
        oscPhase: 1.1,
        glowColor: '#60a5fa',
        speciesRef: speciesMap.get('glass-squid') || MARINE_SPECIES_CATALOG[7],
      },
      // Deep Siphonophore / String Jelly (Foreground, eerie drift)
      {
        id: 'siphonophore-fg',
        name: 'Giant String Siphonophore',
        lottieData: LOTTIE_JELLYFISH,
        layer: 'foreground',
        baseSize: 140,
        scale: 1.3, // 1.3x
        speed: 0.3,
        direction: 1,
        minDepth: 200,
        maxDepth: 680,
        initialX: 80,
        yPercent: 60,
        oscFreq: 0.02,
        oscAmp: 24,
        oscPhase: 3.5,
        glowColor: '#67e8f9',
        speciesRef: speciesMap.get('deep-siphonophore') || MARINE_SPECIES_CATALOG[6],
      },

      // === 600m - 1000m Midnight Bathypelagic Abyss ===
      // Deep-Sea Humpback Anglerfish (Midground, glowing lure)
      {
        id: 'angler-mg',
        name: 'Deep-Sea Humpback Anglerfish',
        lottieData: LOTTIE_ANGLERFISH,
        layer: 'midground',
        baseSize: 150,
        scale: 1.1, // 1.1x
        speed: 0.5,
        direction: 1,
        minDepth: 620,
        maxDepth: 1000,
        initialX: 200,
        yPercent: 48,
        oscFreq: 0.03,
        oscAmp: 16,
        oscPhase: 0.3,
        glowColor: '#22d3ee',
        speciesRef: speciesMap.get('anglerfish') || MARINE_SPECIES_CATALOG[8],
      },
      // Sloane's Viperfish (Foreground, predatory glide)
      {
        id: 'viperfish-fg',
        name: 'Sloane\'s Viperfish',
        lottieData: LOTTIE_ANGLERFISH,
        layer: 'foreground',
        baseSize: 130,
        scale: 1.25, // 1.25x
        speed: 0.9,
        direction: -1,
        minDepth: 520,
        maxDepth: 1000,
        initialX: 650,
        yPercent: 58,
        oscFreq: 0.04,
        oscAmp: 22,
        oscPhase: 2.0,
        glowColor: '#38bdf8',
        speciesRef: speciesMap.get('viperfish') || MARINE_SPECIES_CATALOG[9],
      },
      // Deep Squid (Background in abyss)
      {
        id: 'abyss-squid-bg',
        name: 'Bioluminescent Glass Squid',
        lottieData: LOTTIE_GLASS_SQUID,
        layer: 'background',
        baseSize: 110,
        scale: 0.75, // 0.75x
        speed: 0.45,
        direction: 1,
        minDepth: 650,
        maxDepth: 1000,
        initialX: 480,
        yPercent: 32,
        oscFreq: 0.03,
        oscAmp: 14,
        oscPhase: 1.8,
        glowColor: '#93c5fd',
        speciesRef: speciesMap.get('glass-squid') || MARINE_SPECIES_CATALOG[7],
      }
    ];

    setActors(initialActors);

    const initialPositions: { [id: string]: { x: number; y: number } } = {};
    initialActors.forEach((a) => {
      initialPositions[a.id] = { x: a.initialX, y: 0 };
    });
    setActorPositions(initialPositions);
  }, []);

  // Real-time animation loop for desynchronized horizontal swim and sine wave undulation
  useEffect(() => {
    let startTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsedSec = (currentTime - startTime) / 1000;
      const width = containerRef.current?.clientWidth || window.innerWidth;
      const height = containerRef.current?.clientHeight || window.innerHeight;

      setActorPositions((prev) => {
        const next: { [id: string]: { x: number; y: number } } = {};

        actors.forEach((actor) => {
          const currentPos = prev[actor.id] || { x: actor.initialX, y: 0 };

          // Layer speed multiplier: Foreground faster (1.25x), Midground (1.0x), Background slower (0.75x)
          const layerSpeedMult =
            actor.layer === 'foreground' ? 1.25 : actor.layer === 'background' ? 0.75 : 1.0;

          let newX = currentPos.x + actor.speed * actor.direction * layerSpeedMult * 1.5;

          // Wrap horizontally around viewport edges with generous padding
          const boundaryPadding = 220;
          if (actor.direction === 1 && newX > width + boundaryPadding) {
            newX = -boundaryPadding;
          } else if (actor.direction === -1 && newX < -boundaryPadding) {
            newX = width + boundaryPadding;
          }

          // Sinusoidal vertical undulation
          const undulationY =
            Math.sin(elapsedSec * actor.oscFreq * 6 + actor.oscPhase) * actor.oscAmp;

          // Base vertical position from yPercent
          const baseY = (actor.yPercent / 100) * height;

          next[actor.id] = {
            x: newX,
            y: baseY + undulationY,
          };
        });

        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [actors]);

  // Compute Parallax Layer Vertical Offsets based on current depth
  // Background scrolls slower (0.55x), Midground standard (1.0x), Foreground faster (1.35x)
  const bgParallaxOffset = -currentDepth * 0.45;
  const mgParallaxOffset = -currentDepth * 0.85;
  const fgParallaxOffset = -currentDepth * 1.25;

  // Background ocean water gradient that smoothly darkens with depth
  const getOceanBackgroundStyle = () => {
    if (currentDepth <= 60) {
      // 0-60m: Bright turquoise sunlit surface
      return 'linear-gradient(to bottom, #14b8a6 0%, #06b6d4 50%, #0284c7 100%)';
    } else if (currentDepth <= 150) {
      // 60-150m: Azure upper thermocline
      return 'linear-gradient(to bottom, #06b6d4 0%, #0284c7 55%, #1d4ed8 100%)';
    } else if (currentDepth <= 300) {
      // 150-300m: Cobalt lower thermocline
      return 'linear-gradient(to bottom, #0284c7 0%, #1d4ed8 50%, #1e3a8a 100%)';
    } else if (currentDepth <= 600) {
      // 300-600m: Twilight mesopelagic indigo
      return 'linear-gradient(to bottom, #1d4ed8 0%, #1e1b4b 55%, #0f172a 100%)';
    } else {
      // 600-1000m: Midnight bathypelagic abyss
      return 'linear-gradient(to bottom, #1e1b4b 0%, #0f172a 45%, #020408 100%)';
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden select-none transition-colors duration-700"
      style={{ background: getOceanBackgroundStyle() }}
    >
      {/* 1. Subtle Animated Light-Shaft Overlay near surface (Fades out by 100m) */}
      <LightShafts currentDepth={currentDepth} />

      {/* 2. Varied-Size Marine Snow & Bubbles Particle Canvas (Increases density below 300m) */}
      <MarineSnowParticles currentDepth={currentDepth} />

      {/* ========================================================= */}
      {/* PARALLAX LAYER 1: BACKGROUND (Slowest scroll, slightly blurred, scale 0.6x-0.8x) */}
      {/* ========================================================= */}
      <div
        className="absolute inset-0 pointer-events-none transition-transform duration-200 ease-out z-[10]"
        style={{
          transform: `translateY(${bgParallaxOffset % 60}px)`,
          filter: 'blur(1.5px) brightness(0.85)',
          opacity: 0.75,
        }}
      >
        {/* Distant Swaying Kelp & Corals at specific depth bands */}
        {currentDepth < 130 && (
          <div className="absolute bottom-0 left-[8%] flex items-end gap-12">
            <LottiePlant
              animationData={LOTTIE_SWAYING_KELP}
              name="Distant Kelp"
              width={100}
              height={220}
              scale={0.7}
            />
            <LottiePlant
              animationData={LOTTIE_CORAL_FAN}
              name="Distant Coral"
              width={140}
              height={140}
              scale={0.65}
            />
          </div>
        )}

        {currentDepth > 450 && (
          <div className="absolute bottom-0 right-[15%]">
            <LottiePlant
              animationData={LOTTIE_ABYSSAL_CRINOID}
              name="Distant Vent Bush"
              width={140}
              height={170}
              scale={0.75}
            />
          </div>
        )}

        {/* Background Fish / Creatures */}
        {actors
          .filter((a) => a.layer === 'background')
          .map((actor) => {
            const depthDelta = Math.abs(currentDepth - (actor.minDepth + actor.maxDepth) / 2);
            const depthSpan = (actor.maxDepth - actor.minDepth) / 2 + 75;
            if (depthDelta > depthSpan) return null;

            const visibility = Math.max(0, 1 - depthDelta / depthSpan);
            const pos = actorPositions[actor.id] || { x: actor.initialX, y: 150 };
            const itemWidth = Math.max(60, Math.round(actor.baseSize * actor.scale));
            const itemHeight = Math.max(45, Math.round(actor.baseSize * 0.75 * actor.scale));

            return (
              <div
                key={actor.id}
                className="absolute pointer-events-auto transition-opacity duration-300"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${itemWidth}px`,
                  height: `${itemHeight}px`,
                  minWidth: `${itemWidth}px`,
                  minHeight: `${itemHeight}px`,
                  opacity: visibility,
                }}
              >
                <LottieCreature
                  animationData={actor.lottieData}
                  name={actor.name}
                  size={actor.baseSize}
                  scale={actor.scale}
                  direction={actor.direction}
                  speciesRef={actor.speciesRef}
                  onDiscover={onDiscoverSpecies}
                  isDiscovered={discoveredSpeciesIds.includes(actor.speciesRef.id)}
                  glowColor={actor.glowColor}
                  isDeepSea={currentDepth > 300}
                />
              </div>
            );
          })}
      </div>

      {/* ========================================================= */}
      {/* PARALLAX LAYER 2: MIDGROUND (Standard scroll speed, sharp focus, scale 0.85x-1.15x) */}
      {/* ========================================================= */}
      <div
        className="absolute inset-0 pointer-events-none transition-transform duration-200 ease-out z-[20]"
        style={{
          transform: `translateY(${mgParallaxOffset % 80}px)`,
        }}
      >
        {/* Midground Swaying Kelp / Coral Fronds */}
        {currentDepth < 110 && (
          <div className="absolute bottom-0 right-[12%] flex items-end gap-16">
            <LottiePlant
              animationData={LOTTIE_SWAYING_KELP}
              name="Giant Kelp"
              width={120}
              height={260}
              scale={1.05}
            />
            <LottiePlant
              animationData={LOTTIE_CORAL_FAN}
              name="Reef Coral"
              width={160}
              height={160}
              scale={0.95}
            />
          </div>
        )}

        {currentDepth > 400 && (
          <div className="absolute bottom-0 left-[18%]">
            <LottiePlant
              animationData={LOTTIE_ABYSSAL_CRINOID}
              name="Bioluminescent Crinoid"
              width={160}
              height={200}
              scale={1.0}
            />
          </div>
        )}

        {/* Midground Fish / Creatures */}
        {actors
          .filter((a) => a.layer === 'midground')
          .map((actor) => {
            const depthDelta = Math.abs(currentDepth - (actor.minDepth + actor.maxDepth) / 2);
            const depthSpan = (actor.maxDepth - actor.minDepth) / 2 + 70;
            if (depthDelta > depthSpan) return null;

            const visibility = Math.max(0, 1 - depthDelta / depthSpan);
            const pos = actorPositions[actor.id] || { x: actor.initialX, y: 200 };
            const itemWidth = Math.max(60, Math.round(actor.baseSize * actor.scale));
            const itemHeight = Math.max(45, Math.round(actor.baseSize * 0.75 * actor.scale));

            return (
              <div
                key={actor.id}
                className="absolute pointer-events-auto transition-opacity duration-300"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${itemWidth}px`,
                  height: `${itemHeight}px`,
                  minWidth: `${itemWidth}px`,
                  minHeight: `${itemHeight}px`,
                  opacity: visibility,
                }}
              >
                <LottieCreature
                  animationData={actor.lottieData}
                  name={actor.name}
                  size={actor.baseSize}
                  scale={actor.scale}
                  direction={actor.direction}
                  speciesRef={actor.speciesRef}
                  onDiscover={onDiscoverSpecies}
                  isDiscovered={discoveredSpeciesIds.includes(actor.speciesRef.id)}
                  glowColor={actor.glowColor}
                  isDeepSea={currentDepth > 300}
                />
              </div>
            );
          })}
      </div>

      {/* ========================================================= */}
      {/* PARALLAX LAYER 3: FOREGROUND (Faster scroll speed, large scale 1.15x-1.4x, high presence) */}
      {/* ========================================================= */}
      <div
        className="absolute inset-0 pointer-events-none transition-transform duration-200 ease-out z-[30]"
        style={{
          transform: `translateY(${fgParallaxOffset % 100}px)`,
        }}
      >
        {/* Foreground Swaying Kelp Stalks framing the viewport edges */}
        {currentDepth < 90 && (
          <div className="absolute bottom-0 left-[-20px] pointer-events-none">
            <LottiePlant
              animationData={LOTTIE_SWAYING_KELP}
              name="Foreground Kelp"
              width={140}
              height={300}
              scale={1.3}
              style={{ filter: 'drop-shadow(0 0 10px rgba(13, 148, 136, 0.4))' }}
            />
          </div>
        )}

        {/* Foreground Fish / Creatures */}
        {actors
          .filter((a) => a.layer === 'foreground')
          .map((actor) => {
            const depthDelta = Math.abs(currentDepth - (actor.minDepth + actor.maxDepth) / 2);
            const depthSpan = (actor.maxDepth - actor.minDepth) / 2 + 65;
            if (depthDelta > depthSpan) return null;

            const visibility = Math.max(0, 1 - depthDelta / depthSpan);
            const pos = actorPositions[actor.id] || { x: actor.initialX, y: 250 };
            const itemWidth = Math.max(60, Math.round(actor.baseSize * actor.scale));
            const itemHeight = Math.max(45, Math.round(actor.baseSize * 0.75 * actor.scale));

            return (
              <div
                key={actor.id}
                className="absolute pointer-events-auto transition-opacity duration-300"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${itemWidth}px`,
                  height: `${itemHeight}px`,
                  minWidth: `${itemWidth}px`,
                  minHeight: `${itemHeight}px`,
                  opacity: visibility,
                }}
              >
                <LottieCreature
                  animationData={actor.lottieData}
                  name={actor.name}
                  size={actor.baseSize}
                  scale={actor.scale}
                  direction={actor.direction}
                  speciesRef={actor.speciesRef}
                  onDiscover={onDiscoverSpecies}
                  isDiscovered={discoveredSpeciesIds.includes(actor.speciesRef.id)}
                  glowColor={actor.glowColor}
                  isDeepSea={currentDepth > 300}
                />
              </div>
            );
          })}
      </div>

      {/* 2D Flashlight Overlay for Deep Zones */}
      <div 
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',
          zIndex: 40,
          transition: 'all 0.5s ease',
          opacity: currentDepth > 200 ? Math.min(1, (currentDepth - 200) / 200) : 0,
          background: flashlightOn 
            ? 'radial-gradient(circle at 50% 50%, rgba(200,240,255,0.1) 0%, transparent 20%, rgba(2,6,23,0.85) 50%, rgba(2,6,23,0.98) 100%)' 
            : 'rgba(2,6,23,0.98)',
        }}
      />
    </div>
  );
};
