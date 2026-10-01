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
  /** 0.75–1.3 — NEVER below 0.75 so water stays legible */
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

// ────────────────────────────────────────────────
// 20 BIOME THEMES
// visibility is clamped to [0.75, 1.3]
// ────────────────────────────────────────────────
export const BIOME_THEMES: Record<Biome, {
  surfaceColor: string;
  deepColor: string;
  visibility: number;
  particleStyle: DiveConfig["particleStyle"];
  creatureBias: DiveConfig["creatureBias"];
}> = {
  // 1. Sunlit Surface — default shallow
  sunlit: {
    surfaceColor: "#2dd4bf", deepColor: "#0ea5e9", visibility: 1.3,
    particleStyle: "bubbles",
    creatureBias: { schoolFish: 0.9, predators: 0.4, gelatinous: 0.3, deepFish: 0, benthic: 0.1, megafauna: 0.5 },
  },
  // 2. Coral Reef Zone
  reef: {
    surfaceColor: "#22d3ee", deepColor: "#0284c7", visibility: 1.2,
    particleStyle: "bubbles",
    creatureBias: { schoolFish: 1.0, predators: 0.6, gelatinous: 0.4, deepFish: 0, benthic: 0.9, megafauna: 0.7 },
  },
  // 3. Seagrass Meadows
  seagrass: {
    surfaceColor: "#2dd4bf", deepColor: "#0c4a6e", visibility: 1.1,
    particleStyle: "bubbles",
    creatureBias: { schoolFish: 0.8, predators: 0.3, gelatinous: 0.2, deepFish: 0, benthic: 1.0, megafauna: 0.4 },
  },
  // 4. Open Ocean — clearest baseline
  openOcean: {
    surfaceColor: "#0ea5e9", deepColor: "#075985", visibility: 1.3,
    particleStyle: "snow",
    creatureBias: { schoolFish: 0.7, predators: 0.5, gelatinous: 0.3, deepFish: 0.1, benthic: 0, megafauna: 0.6 },
  },
  // 5. Monsoon Bloom — green particulate haze (moderate, not muddy)
  monsoonBloom: {
    surfaceColor: "#4ade80", deepColor: "#134e4a", visibility: 0.85,
    particleStyle: "plankton",
    creatureBias: { schoolFish: 1.0, predators: 0.7, gelatinous: 0.5, deepFish: 0, benthic: 0.2, megafauna: 0.8 },
  },
  // 6. Arabian Sea Upwelling — nutrient particulate drift
  arabian: {
    surfaceColor: "#38bdf8", deepColor: "#0c4a6e", visibility: 0.9,
    particleStyle: "plankton",
    creatureBias: { schoolFish: 0.8, predators: 0.6, gelatinous: 0.4, deepFish: 0.2, benthic: 0.1, megafauna: 0.5 },
  },
  // 7. Bay of Bengal Surface — slight green tint, freshwater lens
  bengal: {
    surfaceColor: "#2dd4bf", deepColor: "#075985", visibility: 0.95,
    particleStyle: "plankton",
    creatureBias: { schoolFish: 0.7, predators: 0.4, gelatinous: 0.5, deepFish: 0.1, benthic: 0.2, megafauna: 0.3 },
  },
  // 8. Thermocline Transition — visible color-band seam
  thermocline: {
    surfaceColor: "#0ea5e9", deepColor: "#1e3a8a", visibility: 1.0,
    particleStyle: "snow",
    creatureBias: { schoolFish: 0.5, predators: 0.4, gelatinous: 0.6, deepFish: 0.3, benthic: 0, megafauna: 0.3 },
  },
  // 9. Oxygen Minimum Zone — hazy, sparse creatures
  omz: {
    surfaceColor: "#1e293b", deepColor: "#0f172a", visibility: 0.8,
    particleStyle: "snow",
    creatureBias: { schoolFish: 0.1, predators: 0.1, gelatinous: 0.5, deepFish: 0.3, benthic: 0, megafauna: 0.1 },
  },
  // 10. Mesopelagic Twilight — dim but clear
  mesopelagic: {
    surfaceColor: "#0c4a6e", deepColor: "#020617", visibility: 1.0,
    particleStyle: "snow",
    creatureBias: { schoolFish: 0.2, predators: 0.3, gelatinous: 0.8, deepFish: 0.6, benthic: 0, megafauna: 0.2 },
  },
  // 11. Deep Pelagic — clear and dark
  deepPelagic: {
    surfaceColor: "#0f172a", deepColor: "#020617", visibility: 1.0,
    particleStyle: "snow",
    creatureBias: { schoolFish: 0.1, predators: 0.2, gelatinous: 0.7, deepFish: 0.9, benthic: 0, megafauna: 0.1 },
  },
  // 12. Abyssal Plain — sparse bioluminescence
  abyssal: {
    surfaceColor: "#020617", deepColor: "#000000", visibility: 1.0,
    particleStyle: "bioluminescent",
    creatureBias: { schoolFish: 0, predators: 0.1, gelatinous: 0.4, deepFish: 0.8, benthic: 0.3, megafauna: 0.05 },
  },
  // 13. Deep Trench — near-black
  trench: {
    surfaceColor: "#0a0a0f", deepColor: "#000000", visibility: 1.0,
    particleStyle: "snow",
    creatureBias: { schoolFish: 0, predators: 0, gelatinous: 0.2, deepFish: 0.5, benthic: 0.5, megafauna: 0 },
  },
  // 14. Hydrothermal Vent — amber local glow, smoke plumes
  vent: {
    surfaceColor: "#0a0a0f", deepColor: "#1c0a00", visibility: 1.0,
    particleStyle: "vent-smoke",
    creatureBias: { schoolFish: 0, predators: 0, gelatinous: 0.1, deepFish: 0.3, benthic: 0.9, megafauna: 0 },
  },
  // 15. Cold Seep — methane bubble columns
  seep: {
    surfaceColor: "#040d0a", deepColor: "#001a0e", visibility: 1.0,
    particleStyle: "methane",
    creatureBias: { schoolFish: 0, predators: 0, gelatinous: 0.2, deepFish: 0.2, benthic: 1.0, megafauna: 0 },
  },
  // 16. Cyclone Influence — grey-green, turbulent
  cyclone: {
    surfaceColor: "#5b6b6b", deepColor: "#1e293b", visibility: 0.8,
    particleStyle: "snow",
    creatureBias: { schoolFish: 0.3, predators: 0.2, gelatinous: 0.3, deepFish: 0.1, benthic: 0, megafauna: 0.1 },
  },
  // 17. Eddies & Currents — swirling flow-line particles
  eddy: {
    surfaceColor: "#0ea5e9", deepColor: "#0c4a6e", visibility: 1.0,
    particleStyle: "plankton",
    creatureBias: { schoolFish: 0.9, predators: 0.6, gelatinous: 0.5, deepFish: 0.2, benthic: 0, megafauna: 0.4 },
  },
  // 18. Marine Heatwave — warm amber tint, still clear
  heatwave: {
    surfaceColor: "#f97316", deepColor: "#0c4a6e", visibility: 1.1,
    particleStyle: "bubbles",
    creatureBias: { schoolFish: 0.4, predators: 0.3, gelatinous: 0.6, deepFish: 0.1, benthic: 0.2, megafauna: 0.2 },
  },
  // 19. Night Ocean — moonlit dim
  night: {
    surfaceColor: "#0c4a6e", deepColor: "#020617", visibility: 1.0,
    particleStyle: "bioluminescent",
    creatureBias: { schoolFish: 0.5, predators: 0.4, gelatinous: 0.7, deepFish: 0.4, benthic: 0.2, megafauna: 0.3 },
  },
  // 20. Plankton Bloom (Night) — glowing bioluminescent particles dominate
  nightBloom: {
    surfaceColor: "#052e16", deepColor: "#020617", visibility: 0.9,
    particleStyle: "bioluminescent",
    creatureBias: { schoolFish: 0.3, predators: 0.2, gelatinous: 0.9, deepFish: 0.3, benthic: 0.1, megafauna: 0.2 },
  },
};

// ────────────────────────────────────────────────
// Geography helpers
// ────────────────────────────────────────────────
const inBox = (lat: number, lon: number, [a, b, c, d]: number[]) =>
  lat >= a && lat <= b && lon >= c && lon <= d;

export function selectBiomeTheme(o: {
  lat: number; lon: number; date: string;
  profile?: { depths: number[]; temp_pred: number[] };
  seafloorDepth?: number;
  sstAnomaly?: number;  // positive = warmer than normal
  chlorophyll?: number; // mg/m³ proxy
  currentSpeed?: number; // m/s
  cyclone?: boolean;
}): Biome {
  const month = new Date(o.date).getMonth() + 1;
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour >= 19;
  const isMonsoon = month >= 6 && month <= 9;
  const floor = o.seafloorDepth ?? 1000;

  // --- Event / override themes (highest priority) ---
  if (o.cyclone) return "cyclone";
  if (o.sstAnomaly && o.sstAnomaly > 1.5) return "heatwave";
  if (isNight && o.chlorophyll && o.chlorophyll > 3.0) return "nightBloom";
  if (isNight) return "night";
  if (o.currentSpeed && o.currentSpeed > 0.5) return "eddy";

  // --- Special floor features ---
  // Lakshadweep/Maldives/Andaman atolls → reef
  if (inBox(o.lat, o.lon, [8, 13, 71, 74.5]) || inBox(o.lat, o.lon, [-1, 7.5, 72.5, 74]) ||
      inBox(o.lat, o.lon, [9, 14, 92, 94.5])) return "reef";

  // Chagos–Laccadive ridge seamounts → can have vents
  if (inBox(o.lat, o.lon, [-5, 8, 68, 75]) && floor > 800) return "vent";

  // --- Water mass / season themes ---
  if (isMonsoon && (o.chlorophyll ?? 0) > 2.0) return "monsoonBloom";
  if (isMonsoon) return "monsoonBloom"; // monsoon season still shifts color
  if (inBox(o.lat, o.lon, [5, 30, 45, 78]) && isMonsoon) return "arabian"; // Arabian upwelling

  // --- Shallow shelf / seagrass ---
  if (floor < 50) return "seagrass";
  if (floor < 200) return "openOcean";

  // --- Regional water mass ---
  if (o.lon < 78) return "arabian";
  if (o.lon > 80) return "bengal";

  return "openOcean";
}

// ────────────────────────────────────────────────
// Main buildDiveConfig
// ────────────────────────────────────────────────
export function buildDiveConfig(o: {
  lat: number; lon: number; date: string;
  profile?: { depths: number[]; temp_pred: number[] };
  seafloorDepth?: number;
  sstAnomaly?: number;
  chlorophyll?: number;
  currentSpeed?: number;
  cyclone?: boolean;
}): DiveConfig {
  const seed = hashString(`${o.lat.toFixed(1)}|${o.lon.toFixed(1)}|${o.date}`);
  const rand = mulberry32(seed);
  const floor = o.seafloorDepth ?? 1000;

  // Thermocline from real profile
  let thermo = 80;
  if (o.profile?.depths && o.profile?.temp_pred) {
    let best = 0;
    for (let i = 1; i < o.profile.depths.length; i++) {
      const g = (o.profile.temp_pred[i - 1] - o.profile.temp_pred[i]) /
                (o.profile.depths[i] - o.profile.depths[i - 1]);
      if (g > best) { best = g; thermo = o.profile.depths[i]; }
    }
  }

  const month = new Date(o.date).getMonth() + 1;
  const biome = selectBiomeTheme(o);
  const theme = BIOME_THEMES[biome];

  // Visibility HARD clamp — can never go below 0.75 or above 1.3
  const visibility = Math.min(1.3, Math.max(0.75, theme.visibility));

  // OMZ only for Arabian Sea / OMZ / mesopelagic biomes
  let omzTop: number | null = null;
  if (biome === "arabian" || biome === "omz") {
    omzTop = 150 + Math.round(rand() * 60);
  }

  const events = Array.from({ length: 6 }, () => ({
    atDepth: Math.round(rand() * Math.min(floor, 1000)),
    type: ["whaleShark", "squidSchool", "bloom", "whaleFall", "vent", "argoFloat"][Math.floor(rand() * 6)],
  }));

  return {
    seed, rand, biome, seafloorDepth: floor, thermoclineDepth: thermo,
    omzTop,
    surfaceColor: theme.surfaceColor,
    deepColor: theme.deepColor,
    visibility,
    isNight: new Date().getHours() < 6 || new Date().getHours() >= 19,
    monsoon: month >= 6 && month <= 9,
    particleStyle: theme.particleStyle,
    creatureBias: theme.creatureBias,
    events,
  };
}
