import React, { useRef, createContext, useContext } from 'react';
import * as THREE from 'three';
import { DiveConfig, DiveProfile } from '../../../utils/buildDiveConfig';
import { depthToY } from './depthScale';

export interface EnvState {
  fogColor: THREE.Color;
  fogDensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  sunIntensity: number;
  shaftAlpha: number;
  absorption: { r: number; g: number; b: number };
  particleDensity: {
    snow: number;
    bubbles: number;
    plankton: number;
    sediment: number;
    mineral: number;
    vent: number;
    methane: number;
    biolum: number;
  };
  creatureWeights: {
    schoolFish: number;
    predators: number;
    gelatinous: number;
    deepFish: number;
    benthic: number;
    megafauna: number;
    empty: number;
  };
  floor: {
    present: boolean;
    type: 'sand' | 'reef' | 'seagrass' | 'rock' | 'trench' | 'vent' | 'seep';
    roughness: number;
    depth: number;
    y: number;
  };
  flow: {
    upwelling: number;
    eddyStrength: number;
    shear: number;
    cycloneShake: number;
  };
  tint: {
    heat: number;
    bleach: number;
  };
  thermoclineDistortion: number;
}

// Module-level scratch color objects to eliminate per-frame allocations
const SCRATCH_COLOR_A = new THREE.Color();
const SCRATCH_COLOR_B = new THREE.Color();
const SCRATCH_COLOR_C = new THREE.Color();
const SCRATCH_COLOR_D = new THREE.Color();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function createInitialEnvState(): EnvState {
  return {
    fogColor: new THREE.Color('#0a4870'),
    fogDensity: 0.014,
    ambientColor: new THREE.Color('#38bdf8'),
    ambientIntensity: 1.2,
    sunIntensity: 2.0,
    shaftAlpha: 0.85,
    absorption: { r: 1.0, g: 0.9, b: 0.4 },
    particleDensity: {
      snow: 0.4,
      bubbles: 0.8,
      plankton: 0.2,
      sediment: 0.1,
      mineral: 0.0,
      vent: 0.0,
      methane: 0.0,
      biolum: 0.0,
    },
    creatureWeights: {
      schoolFish: 0.8,
      predators: 0.4,
      gelatinous: 0.3,
      deepFish: 0.0,
      benthic: 0.2,
      megafauna: 0.5,
      empty: 0.05,
    },
    floor: {
      present: false,
      type: 'sand',
      roughness: 0.4,
      depth: 1000,
      y: depthToY(1000),
    },
    flow: {
      upwelling: 0.0,
      eddyStrength: 0.0,
      shear: 0.0,
      cycloneShake: 0.0,
    },
    tint: {
      heat: 0.0,
      bleach: 0.0,
    },
    thermoclineDistortion: 0.0,
  };
}

/**
 * 4-LAYER ENVIRONMENT COMPOSITION
 * Layer A: Depth zones (Continuous blending with depth keyframes)
 * Layer B: Water mass / region (plankton bloom, upwelling, river plume)
 * Layer C: Seafloor features (reef, seagrass, trench, vent, seep)
 * Layer D: Events (cyclone, eddy, heatwave, night, biolum bloom)
 */
export function updateEnvState(
  state: EnvState,
  currentDepth: number,
  config: DiveConfig,
  time: number
): void {
  const depthM = Math.max(0, currentDepth);
  const profile: DiveProfile = config.profile || {
    archetype: 'offshore',
    waterMass: 'clear',
    events: { heatwave: 0, cyclone: 0, eddy: 0, night: config.isNight, biolumBloom: false },
    zoneOverrides: {
      thermoclineDepth: config.thermoclineDepth || 120,
      omzTop: config.omzTop,
      omzBottom: config.omzTop ? config.omzTop + 300 : null,
      seafloorDepth: config.seafloorDepth || 1000,
    },
    primaryBiome: config.biome,
  };

  const thermoDepth = profile.zoneOverrides.thermoclineDepth || 120;
  const omzTop = profile.zoneOverrides.omzTop;
  const seafloorDepth = profile.zoneOverrides.seafloorDepth;
  const visibility = Math.max(0.75, Math.min(1.3, config.visibility || 1.0));

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER A: CONTINUOUS DEPTH KEYFRAMES BLENDING (0 -> 6000m)
  // ─────────────────────────────────────────────────────────────────────────────
  if (depthM <= 10) {
    // 0–10m: Sunlit Epipelagic Surface (Warm & Vibrant)
    const t = depthM / 10;
    SCRATCH_COLOR_A.set('#2dd4bf'); // Turquoise
    SCRATCH_COLOR_B.set('#0ea5e9'); // Sky blue
    state.fogColor.copy(SCRATCH_COLOR_A).lerp(SCRATCH_COLOR_B, t);
    state.ambientColor.set('#38bdf8');
    state.ambientIntensity = 1.4 - t * 0.2;
    state.sunIntensity = 2.2 - t * 0.4;
    state.shaftAlpha = 0.85 * (1 - t * 0.15);
    state.absorption = { r: 1.0 - t * 0.2, g: 1.0, b: 0.95 };
    state.particleDensity.bubbles = 0.9 - t * 0.2;
    state.particleDensity.snow = 0.2 + t * 0.2;
    state.particleDensity.plankton = 0.3;
    state.particleDensity.biolum = 0.0;
  } else if (depthM <= 60) {
    // 10–60m: Open Ocean Mixed Layer (Clear Blue)
    const t = smoothstep(10, 60, depthM);
    SCRATCH_COLOR_A.set('#0ea5e9');
    SCRATCH_COLOR_B.set('#0369a1');
    state.fogColor.copy(SCRATCH_COLOR_A).lerp(SCRATCH_COLOR_B, t);
    state.ambientColor.set('#0284c7');
    state.ambientIntensity = 1.2 - t * 0.35;
    state.sunIntensity = 1.8 * (1 - t * 0.7);
    state.shaftAlpha = 0.72 * (1 - t);
    state.absorption = { r: 0.8 * (1 - t), g: 0.95 - t * 0.2, b: 1.0 };
    state.particleDensity.bubbles = 0.7 * (1 - t);
    state.particleDensity.snow = 0.4 + t * 0.3;
    state.particleDensity.plankton = 0.4 * (1 - t * 0.5);
    state.particleDensity.biolum = 0.0;
  } else if (depthM <= 200) {
    // 60–200m: Thermocline Seam & Twilight Transition
    const t = smoothstep(60, 200, depthM);
    SCRATCH_COLOR_A.set('#0369a1');
    SCRATCH_COLOR_B.set('#1e3a8a');
    state.fogColor.copy(SCRATCH_COLOR_A).lerp(SCRATCH_COLOR_B, t);
    state.ambientColor.set('#1e40af');
    state.ambientIntensity = 0.85 - t * 0.45;
    state.sunIntensity = 0.54 * (1 - t);
    state.shaftAlpha = 0.0;
    state.absorption = { r: 0.0, g: 0.75 - t * 0.45, b: 1.0 };
    state.particleDensity.bubbles = 0.0;
    state.particleDensity.snow = 0.7 + t * 0.2;
    state.particleDensity.plankton = 0.2 * (1 - t);
    state.particleDensity.biolum = t * 0.3;
  } else if (depthM <= 500) {
    // 200–500m: Mesopelagic Twilight / OMZ
    const t = smoothstep(200, 500, depthM);
    SCRATCH_COLOR_A.set('#1e3a8a');
    SCRATCH_COLOR_B.set('#020617');
    state.fogColor.copy(SCRATCH_COLOR_A).lerp(SCRATCH_COLOR_B, t);
    state.ambientColor.set('#0f172a');
    state.ambientIntensity = 0.4 - t * 0.22;
    state.sunIntensity = 0.0;
    state.shaftAlpha = 0.0;
    state.absorption = { r: 0.0, g: 0.3 * (1 - t), b: 0.7 - t * 0.3 };
    state.particleDensity.snow = 0.8;
    state.particleDensity.biolum = 0.3 + t * 0.4;
  } else if (depthM <= 1000) {
    // 500–1000m: Bathypelagic Midnight
    const t = smoothstep(500, 1000, depthM);
    SCRATCH_COLOR_A.set('#020617');
    SCRATCH_COLOR_B.set('#000000');
    state.fogColor.copy(SCRATCH_COLOR_A).lerp(SCRATCH_COLOR_B, t);
    state.ambientColor.set('#020617');
    state.ambientIntensity = 0.18 - t * 0.12;
    state.sunIntensity = 0.0;
    state.shaftAlpha = 0.0;
    state.absorption = { r: 0.0, g: 0.0, b: 0.4 * (1 - t) };
    state.particleDensity.snow = 0.6;
    state.particleDensity.biolum = 0.6 + t * 0.2;
  } else {
    // >1000m: Abyssal Plain & Hadal Trench (1000–6000m)
    state.fogColor.set('#000000');
    state.ambientColor.set('#000000');
    state.ambientIntensity = 0.04;
    state.sunIntensity = 0.0;
    state.shaftAlpha = 0.0;
    state.absorption = { r: 0.0, g: 0.0, b: 0.0 };
    state.particleDensity.snow = 0.4;
    state.particleDensity.biolum = 0.5;
  }

  // Base Fog Density formula: baseDensity(depth) * clamp(1 / visibility, 0.77, 1.4)
  const baseDensity = depthM <= 10 ? 0.010 : depthM <= 60 ? 0.012 : depthM <= 200 ? 0.015 : depthM <= 500 ? 0.018 : 0.022;
  const visFactor = THREE.MathUtils.clamp(1.0 / visibility, 0.77, 1.4);
  state.fogDensity = baseDensity * visFactor;

  // Thermocline Refractive Seam Band (±15m band around thermoDepth)
  const distToThermo = Math.abs(depthM - thermoDepth);
  if (distToThermo < 20) {
    const seamFactor = 1.0 - (distToThermo / 20);
    state.thermoclineDistortion = seamFactor;
    // Peak optical haze at seam
    state.fogDensity += seamFactor * 0.006;
    SCRATCH_COLOR_D.set('#1e40af');
    state.fogColor.lerp(SCRATCH_COLOR_D, seamFactor * 0.4);
  } else {
    state.thermoclineDistortion = 0.0;
  }

  // Oxygen Minimum Zone (OMZ) Stagnation Override
  if (omzTop && depthM >= omzTop && depthM <= (profile.zoneOverrides.omzBottom || omzTop + 300)) {
    const omzDist = Math.min(depthM - omzTop, (profile.zoneOverrides.omzBottom || omzTop + 300) - depthM);
    const omzStrength = smoothstep(0, 50, omzDist);
    SCRATCH_COLOR_C.set('#020617');
    state.fogColor.lerp(SCRATCH_COLOR_C, omzStrength * 0.6);
    state.ambientIntensity *= (1.0 - omzStrength * 0.7);
    state.creatureWeights.empty = 0.75 * omzStrength;
    state.creatureWeights.schoolFish *= (1.0 - omzStrength * 0.85);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER B: WATER MASS & REGIONAL OCEANOGRAPHY MODIFIERS
  // ─────────────────────────────────────────────────────────────────────────────
  if (profile.waterMass === 'bloom' && depthM <= 120) {
    // High chlorophyll plankton bloom: dense green-shifted turbidity
    const bloomFade = 1.0 - (depthM / 120);
    SCRATCH_COLOR_C.set('#14532d');
    state.fogColor.lerp(SCRATCH_COLOR_C, bloomFade * 0.6);
    state.fogDensity *= (1.0 + bloomFade * 0.45);
    state.particleDensity.plankton = 1.0 * bloomFade;
    state.creatureWeights.schoolFish = Math.max(state.creatureWeights.schoolFish, 0.95);
    state.creatureWeights.megafauna = Math.max(state.creatureWeights.megafauna, 0.9);
  } else if (profile.waterMass === 'upwelling' && depthM <= 220) {
    // Arabian / Somali coastal upwelling: strong vertical advection
    const upwellFade = 1.0 - (depthM / 220);
    state.flow.upwelling = 0.85 * upwellFade;
    state.particleDensity.plankton += 0.4 * upwellFade;
    state.creatureWeights.schoolFish = Math.max(state.creatureWeights.schoolFish, 0.9);
  } else if (profile.waterMass === 'plume' && depthM <= 80) {
    // Bay of Bengal freshwater river plume: suspended terrestrial silt veil
    const plumeFade = 1.0 - (depthM / 80);
    SCRATCH_COLOR_C.set('#115e59');
    state.fogColor.lerp(SCRATCH_COLOR_C, plumeFade * 0.5);
    state.particleDensity.sediment = 0.7 * plumeFade;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER C: SEAFLOOR FEATURES & BENTHIC ECOSYSTEMS
  // ─────────────────────────────────────────────────────────────────────────────
  // Only exists when depth is within range of the seafloor
  const distToFloor = seafloorDepth - depthM;
  state.floor.depth = seafloorDepth;
  state.floor.y = depthToY(seafloorDepth);

  if (profile.archetype === 'shelf') {
    // Shelf dive (seafloor at 25–60m)
    state.floor.present = true;
    state.floor.type = config.biome === 'seagrass' ? 'seagrass' : 'reef';
    state.floor.roughness = config.biome === 'seagrass' ? 0.35 : 0.8;
    state.creatureWeights.benthic = 0.95;
    if (distToFloor < 15) {
      state.particleDensity.sediment = Math.max(state.particleDensity.sediment, 0.4);
    }
  } else if (profile.archetype === 'vent') {
    // Hydrothermal vent field at seafloor
    state.floor.present = distToFloor < 80;
    state.floor.type = 'vent';
    state.floor.roughness = 0.95;
    if (distToFloor < 50) {
      state.particleDensity.vent = 1.0;
      state.particleDensity.mineral = 0.8;
      state.creatureWeights.benthic = 1.0;
    }
  } else if (profile.archetype === 'seep') {
    // Cold methane seep mounds at seafloor
    state.floor.present = distToFloor < 80;
    state.floor.type = 'seep';
    state.floor.roughness = 0.7;
    if (distToFloor < 50) {
      state.particleDensity.methane = 1.0;
      state.creatureWeights.benthic = 1.0;
    }
  } else if (profile.archetype === 'trench') {
    // Hadal deep trench canyon walls
    state.floor.present = distToFloor < 120;
    state.floor.type = 'trench';
    state.floor.roughness = 0.95;
    state.fogDensity *= 1.25;
  } else {
    // Offshore deep plain
    state.floor.present = distToFloor < 60;
    state.floor.type = 'sand';
    state.floor.roughness = 0.4;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER D: DYNAMIC EVENT OVERLAYS (TIME-RAMPED)
  // ─────────────────────────────────────────────────────────────────────────────
  const ev = profile.events;

  if (ev.cyclone > 0.05 && depthM <= 150) {
    const stormFade = (1.0 - (depthM / 150)) * ev.cyclone;
    SCRATCH_COLOR_C.set('#475569');
    state.fogColor.lerp(SCRATCH_COLOR_C, stormFade * 0.55);
    state.fogDensity *= (1.0 + stormFade * 0.4);
    state.flow.shear = 2.4 * stormFade;
    state.flow.cycloneShake = Math.sin(time * 14) * 0.35 * stormFade;
    state.particleDensity.bubbles = Math.max(state.particleDensity.bubbles, 1.0 * stormFade);
  }

  if (ev.eddy > 0.05 && depthM <= 250) {
    const eddyFade = (1.0 - (depthM / 250)) * ev.eddy;
    state.flow.eddyStrength = 1.6 * eddyFade;
  }

  if (ev.heatwave > 0.05 && depthM <= 80) {
    const heatFade = (1.0 - (depthM / 80)) * ev.heatwave;
    SCRATCH_COLOR_C.set('#7c2d12'); // Amber fever tone
    state.fogColor.lerp(SCRATCH_COLOR_C, heatFade * 0.35);
    state.tint.heat = heatFade;
    // Bleaching timeline: healthy -> pale -> white -> dead with algae
    const bleachCycle = (time * 0.06) % 1.0;
    state.tint.bleach = THREE.MathUtils.clamp(bleachCycle * 1.4, 0.0, 1.0) * heatFade;
  }

  if (ev.night) {
    state.sunIntensity = 0.0;
    state.ambientIntensity = 0.12;
    state.shaftAlpha = 0.0;
    SCRATCH_COLOR_C.set('#020617');
    state.fogColor.lerp(SCRATCH_COLOR_C, 0.7);
    state.particleDensity.biolum = Math.max(state.particleDensity.biolum, ev.biolumBloom ? 1.0 : 0.45);
  }
}

export const EnvStateContext = createContext<React.MutableRefObject<EnvState> | null>(null);

export function useEnvironmentState() {
  const ctx = useContext(EnvStateContext);
  if (!ctx) {
    throw new Error('useEnvironmentState must be used within an EnvStateContext.Provider');
  }
  return ctx;
}
