import { hashString, mulberry32 } from "./rng";

export type Biome =
  | "sunlit" | "reef" | "seagrass" | "openOcean"
  | "monsoonBloom" | "arabian" | "bengal"
  | "thermocline" | "omz" | "mesopelagic"
  | "deepPelagic" | "abyssal" | "trench"
  | "vent" | "seep" | "cyclone" | "eddy"
  | "heatwave" | "night" | "nightBloom";

export interface DiveConfig {
  seed: number;
  rand: () => number;
  biome: Biome;
  seafloorDepth: number;
  thermoclineDepth: number;
  omzTop: number | null;
  surfaceColor: string;
  deepColor: string;
  /** 0.75–1.3 — clamped */
  visibility: number;
  isNight: boolean;
  monsoon: boolean;
  particleStyle: "snow" | "bubbles" | "bioluminescent" | "vent-smoke" | "methane" | "plankton";
  creatureBias: {
    schoolFish: number;
    predators: number;
    gelatinous: number;
    deepFish: number;
    benthic: number;
    megafauna: number;
  };
  events: { atDepth: number; type: string }[];
}

// ─── 20 biome theme data ─────────────────────────────────────────────────────
export const BIOME_THEMES: Record<Biome, {
  surfaceColor: string;
  deepColor: string;
  visibility: number;
  particleStyle: DiveConfig["particleStyle"];
  creatureBias: DiveConfig["creatureBias"];
}> = {
  sunlit:       { surfaceColor:'#2dd4bf', deepColor:'#0ea5e9', visibility:1.3, particleStyle:'bubbles',       creatureBias:{ schoolFish:0.9, predators:0.4, gelatinous:0.3, deepFish:0.0, benthic:0.1, megafauna:0.5 }},
  reef:         { surfaceColor:'#22d3ee', deepColor:'#0284c7', visibility:1.2, particleStyle:'bubbles',       creatureBias:{ schoolFish:1.0, predators:0.6, gelatinous:0.4, deepFish:0.0, benthic:0.9, megafauna:0.7 }},
  seagrass:     { surfaceColor:'#2dd4bf', deepColor:'#0c4a6e', visibility:1.1, particleStyle:'bubbles',       creatureBias:{ schoolFish:0.8, predators:0.3, gelatinous:0.2, deepFish:0.0, benthic:1.0, megafauna:0.4 }},
  openOcean:    { surfaceColor:'#0ea5e9', deepColor:'#075985', visibility:1.3, particleStyle:'snow',          creatureBias:{ schoolFish:0.7, predators:0.5, gelatinous:0.3, deepFish:0.1, benthic:0.0, megafauna:0.6 }},
  monsoonBloom: { surfaceColor:'#4ade80', deepColor:'#134e4a', visibility:0.85,particleStyle:'plankton',      creatureBias:{ schoolFish:1.0, predators:0.7, gelatinous:0.5, deepFish:0.0, benthic:0.2, megafauna:0.8 }},
  arabian:      { surfaceColor:'#38bdf8', deepColor:'#0c4a6e', visibility:0.9, particleStyle:'plankton',      creatureBias:{ schoolFish:0.8, predators:0.6, gelatinous:0.4, deepFish:0.2, benthic:0.1, megafauna:0.5 }},
  bengal:       { surfaceColor:'#2dd4bf', deepColor:'#075985', visibility:0.95,particleStyle:'plankton',      creatureBias:{ schoolFish:0.7, predators:0.4, gelatinous:0.5, deepFish:0.1, benthic:0.2, megafauna:0.3 }},
  thermocline:  { surfaceColor:'#0ea5e9', deepColor:'#1e3a8a', visibility:1.0, particleStyle:'snow',          creatureBias:{ schoolFish:0.5, predators:0.4, gelatinous:0.6, deepFish:0.3, benthic:0.0, megafauna:0.3 }},
  omz:          { surfaceColor:'#1e293b', deepColor:'#0f172a', visibility:0.8, particleStyle:'snow',          creatureBias:{ schoolFish:0.1, predators:0.1, gelatinous:0.5, deepFish:0.3, benthic:0.0, megafauna:0.1 }},
  mesopelagic:  { surfaceColor:'#0c4a6e', deepColor:'#020617', visibility:1.0, particleStyle:'snow',          creatureBias:{ schoolFish:0.2, predators:0.3, gelatinous:0.8, deepFish:0.6, benthic:0.0, megafauna:0.2 }},
  deepPelagic:  { surfaceColor:'#0f172a', deepColor:'#020617', visibility:1.0, particleStyle:'snow',          creatureBias:{ schoolFish:0.1, predators:0.2, gelatinous:0.7, deepFish:0.9, benthic:0.0, megafauna:0.1 }},
  abyssal:      { surfaceColor:'#020617', deepColor:'#000000', visibility:1.0, particleStyle:'bioluminescent',creatureBias:{ schoolFish:0.0, predators:0.1, gelatinous:0.4, deepFish:0.8, benthic:0.3, megafauna:0.05}},
  trench:       { surfaceColor:'#0a0a0f', deepColor:'#000000', visibility:1.0, particleStyle:'snow',          creatureBias:{ schoolFish:0.0, predators:0.0, gelatinous:0.2, deepFish:0.5, benthic:0.5, megafauna:0.0 }},
  vent:         { surfaceColor:'#0a0a0f', deepColor:'#1c0a00', visibility:1.0, particleStyle:'vent-smoke',    creatureBias:{ schoolFish:0.0, predators:0.0, gelatinous:0.1, deepFish:0.3, benthic:0.9, megafauna:0.0 }},
  seep:         { surfaceColor:'#040d0a', deepColor:'#001a0e', visibility:1.0, particleStyle:'methane',       creatureBias:{ schoolFish:0.0, predators:0.0, gelatinous:0.2, deepFish:0.2, benthic:1.0, megafauna:0.0 }},
  cyclone:      { surfaceColor:'#5b6b6b', deepColor:'#1e293b', visibility:0.8, particleStyle:'snow',          creatureBias:{ schoolFish:0.3, predators:0.2, gelatinous:0.3, deepFish:0.1, benthic:0.0, megafauna:0.1 }},
  eddy:         { surfaceColor:'#0ea5e9', deepColor:'#0c4a6e', visibility:1.0, particleStyle:'plankton',      creatureBias:{ schoolFish:0.9, predators:0.6, gelatinous:0.5, deepFish:0.2, benthic:0.0, megafauna:0.4 }},
  heatwave:     { surfaceColor:'#f97316', deepColor:'#0c4a6e', visibility:1.1, particleStyle:'bubbles',       creatureBias:{ schoolFish:0.4, predators:0.3, gelatinous:0.6, deepFish:0.1, benthic:0.2, megafauna:0.2 }},
  night:        { surfaceColor:'#0c4a6e', deepColor:'#020617', visibility:1.0, particleStyle:'bioluminescent',creatureBias:{ schoolFish:0.5, predators:0.4, gelatinous:0.7, deepFish:0.4, benthic:0.2, megafauna:0.3 }},
  nightBloom:   { surfaceColor:'#052e16', deepColor:'#020617', visibility:0.9, particleStyle:'bioluminescent',creatureBias:{ schoolFish:0.3, predators:0.2, gelatinous:0.9, deepFish:0.3, benthic:0.1, megafauna:0.2 }},
};

// ─── Geography helpers ───────────────────────────────────────────────────────
const inBox = (lat: number, lon: number, latMin: number, latMax: number, lonMin: number, lonMax: number) =>
  lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax;

// ─── 20-theme selector ───────────────────────────────────────────────────────
export function selectBiomeTheme(o: {
  lat: number; lon: number; date: string;
  seafloorDepth?: number;
  sstAnomaly?: number;
  chlorophyll?: number;
  currentSpeed?: number;
  cyclone?: boolean;
  isNight: boolean;
}): Biome {
  const month = new Date(o.date).getMonth() + 1; // 1-12
  const isMonsoon = month >= 6 && month <= 9;
  const floor = o.seafloorDepth ?? 1000;
  const lat = o.lat, lon = o.lon;

  // ── Priority 1: Overriding event flags ──────────────────────────────────
  if (o.cyclone) return 'cyclone';
  if (o.sstAnomaly && o.sstAnomaly > 1.5) return 'heatwave';
  if (o.isNight && (o.chlorophyll ?? 0) > 3.0) return 'nightBloom';
  if (o.isNight) return 'night';
  if ((o.currentSpeed ?? 0) > 0.5) return 'eddy';

  // ── Priority 2: Shallow depth special zones ──────────────────────────────
  // Very shallow: seagrass / reef
  if (floor < 30) return 'seagrass';
  if (floor < 100) return 'reef';

  // ── Priority 3: Known atolls, reef arcs, ridges ──────────────────────────
  // Lakshadweep Islands (India)
  if (inBox(lat, lon, 8, 13.5, 71.5, 74.5)) return 'reef';
  // Maldive Archipelago
  if (inBox(lat, lon, -1, 7.5, 72, 74.5)) return 'reef';
  // Andaman/Nicobar
  if (inBox(lat, lon, 6, 14, 92, 94.5)) return 'reef';
  // Gulf of Mannar (shallow seagrass)
  if (inBox(lat, lon, 8, 10.5, 78, 80.5)) return 'seagrass';
  // Gulf of Khambhat / shelf near Gujarat
  if (inBox(lat, lon, 20, 24, 69, 73) && floor < 80) return 'seagrass';

  // ── Priority 4: Very deep floor (abyss/trench/vent) ─────────────────────
  if (floor > 4000) return 'trench';
  if (floor > 3000) return 'abyssal';
  if (floor > 2000) {
    // Carlsberg Ridge / Chagos-Laccadive Ridge → vents
    if (inBox(lat, lon, -5, 12, 62, 78)) return 'vent';
    return 'abyssal';
  }
  if (floor > 1500) return 'deepPelagic';

  // ── Priority 5: Regional water mass + season ─────────────────────────────

  // Arabian Sea (west of ~78°E and north of equator)
  if (lon < 78 && lat > 0) {
    if (isMonsoon) {
      // Southwest Monsoon: strong upwelling off Oman/Somalia coast
      if (lat < 20 && lon < 70) return 'arabian';   // upwelling zone
      return 'monsoonBloom';                         // rest of AS in monsoon
    }
    // Pre-monsoon (March-May): heat builds up → can get heatwave at high SST
    if ((month >= 4 && month <= 5) && lat < 25) return 'heatwave';
    return 'arabian'; // default Arabian Sea
  }

  // Bay of Bengal (east of ~80°E)
  if (lon > 80 && lat > 5) {
    if (isMonsoon) {
      // June-Sept monsoon discharge from Ganges/Brahmaputra → heavy bloom
      if (lat > 15 && lon > 85) return 'monsoonBloom';
      return 'bengal';
    }
    // Cyclone season May and Nov in BoB
    if ((month === 5 || month === 11) && lat > 10) return 'cyclone';
    return 'bengal';
  }

  // Equatorial Indian Ocean (5°S–5°N, between AS and BoB)
  if (lat < 5 && lat > -5) {
    if (isMonsoon) return 'eddy'; // equatorial counter-current
    return 'openOcean';
  }

  // ── Priority 6: Intermediate depth thresholds ────────────────────────────
  if (floor > 600) return 'mesopelagic';
  if (floor > 300) return 'thermocline';

  // ── Fallback ─────────────────────────────────────────────────────────────
  return 'openOcean';
}

// ─── Main buildDiveConfig ────────────────────────────────────────────────────
export function buildDiveConfig(o: {
  lat: number; lon: number; date: string;
  profile?: { depths: number[]; temp_pred: number[] } | null;
  seafloorDepth?: number;
  sstAnomaly?: number;
  chlorophyll?: number;
  currentSpeed?: number;
  cyclone?: boolean;
}): DiveConfig {
  const seed = hashString(`${o.lat.toFixed(1)}|${o.lon.toFixed(1)}|${o.date}`);
  const rand = mulberry32(seed);
  const floor = o.seafloorDepth ?? estimateSeafloor(o.lat, o.lon);

  // Thermocline from real profile
  let thermo = 80;
  if (o.profile?.depths && o.profile?.temp_pred) {
    let best = 0;
    for (let i = 1; i < o.profile.depths.length; i++) {
      const dz = o.profile.depths[i] - o.profile.depths[i - 1];
      if (dz <= 0) continue;
      const g = (o.profile.temp_pred[i - 1] - o.profile.temp_pred[i]) / dz;
      if (g > best) { best = g; thermo = o.profile.depths[i]; }
    }
  }

  const month = new Date(o.date).getMonth() + 1;
  const hour  = new Date().getHours();
  const isNight = hour < 6 || hour >= 19;

  const biome = selectBiomeTheme({ ...o, seafloorDepth: floor, isNight });
  const theme = BIOME_THEMES[biome];
  const visibility = Math.min(1.3, Math.max(0.75, theme.visibility));

  // OMZ: Arabian Sea + mesopelagic depths
  let omzTop: number | null = null;
  if (biome === 'arabian' || biome === 'omz' || biome === 'mesopelagic') {
    omzTop = 150 + Math.round(rand() * 60);
  }

  const eventTypes = ['whaleShark', 'squidSchool', 'bloom', 'whaleFall', 'vent', 'argoFloat'];
  const events = Array.from({ length: 6 }, () => ({
    atDepth: Math.round(rand() * Math.min(floor, 1000)),
    type: eventTypes[Math.floor(rand() * eventTypes.length)],
  }));

  return {
    seed, rand, biome, seafloorDepth: floor, thermoclineDepth: thermo,
    omzTop,
    surfaceColor: theme.surfaceColor,
    deepColor: theme.deepColor,
    visibility,
    isNight,
    monsoon: month >= 6 && month <= 9,
    particleStyle: theme.particleStyle,
    creatureBias: theme.creatureBias,
    events,
  };
}

/**
 * Rough seafloor depth estimator from lat/lon.
 * Better than the flat 1000m default — gives shallow shelves, deep basins.
 */
function estimateSeafloor(lat: number, lon: number): number {
  // Shallow continental shelf: within 200km of coast
  const nearCoast = (
    // Indian west coast / Arabian Sea shelf
    (lat > 8 && lat < 24 && lon > 72 && lon < 77) ||
    // Indian east coast / Bay of Bengal shelf
    (lat > 8 && lat < 22 && lon > 79 && lon < 84) ||
    // Gulf of Oman / Persian Gulf
    (lat > 22 && lat < 27 && lon > 56 && lon < 70) ||
    // Sri Lanka shelf
    (lat > 5.5 && lat < 10 && lon > 79 && lon < 82)
  );
  if (nearCoast) return 80 + Math.abs(lat * lon % 120);

  // Laccadive / Chagos Ridge — seamounts
  if (inBox(lat, lon, -5, 12, 62, 78)) return 1500 + Math.abs(lat * 100 % 1500);

  // Bay of Bengal deep basin
  if (lon > 82 && lon < 92 && lat > 8 && lat < 20) return 2000 + Math.abs(lat * lon % 1000);

  // Arabian Sea deep basin
  if (lon > 58 && lon < 72 && lat > 10 && lat < 22) return 2500 + Math.abs(lat * lon % 1500);

  // Default: open Indian Ocean deep
  return 3000 + Math.abs(lat * lon % 2000);
}
