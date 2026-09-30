import { hashString, mulberry32 } from "./rng";

export type Biome = "atoll" | "arabian" | "bengal" | "shelf" | "seamount" | "abyssal";

export interface DiveConfig {
  seed: number;
  rand: () => number;
  biome: Biome;
  seafloorDepth: number;        // metres
  thermoclineDepth: number;     // metres
  omzTop: number | null;        // oxygen minimum zone start, metres
  surfaceColor: string;
  deepColor: string;
  visibility: number;           // 0..1
  isNight: boolean;
  monsoon: boolean;
  events: { atDepth: number; type: string }[];
}

const inBox = (lat: number, lon: number, [a, b, c, d]: number[]) =>
  lat >= a && lat <= b && lon >= c && lon <= d;

function pickBiome(lat: number, lon: number, floor: number): Biome {
  if (inBox(lat, lon, [8, 13, 71, 74.5]) || inBox(lat, lon, [-1, 7.5, 72.5, 74]) ||
      inBox(lat, lon, [9, 14, 92, 94.5])) return "atoll";
  if (floor < 200) return "shelf";
  if (inBox(lat, lon, [-5, 8, 68, 75])) return "seamount";
  if (lon < 78) return "arabian";
  return "bengal";
}

export function buildDiveConfig(o: {
  lat: number; lon: number; date: string;
  profile?: { depths: number[]; temp_pred: number[] };
  seafloorDepth?: number;
}): DiveConfig {
  const seed = hashString(`${o.lat.toFixed(1)}|${o.lon.toFixed(1)}|${o.date}`);
  const rand = mulberry32(seed);
  const floor = o.seafloorDepth ?? 1000;
  const biome = pickBiome(o.lat, o.lon, floor);

  let thermo = 80;
  if (o.profile && o.profile.depths && o.profile.temp_pred) {
    let best = 0;
    for (let i = 1; i < o.profile.depths.length; i++) {
      const g = (o.profile.temp_pred[i - 1] - o.profile.temp_pred[i]) /
                (o.profile.depths[i] - o.profile.depths[i - 1]);
      if (g > best) { best = g; thermo = o.profile.depths[i]; }
    }
  }

  const palettes: Record<Biome, [string, string, number]> = {
    atoll:    ["#12b5b0", "#04384a", 0.95],
    arabian:  ["#0b7a6b", "#03151a", 0.55],
    bengal:   ["#5a8f6a", "#06141c", 0.45],
    shelf:    ["#3f8f8a", "#07222b", 0.6],
    seamount: ["#0a8ba8", "#020c1a", 0.8],
    abyssal:  ["#088395", "#010206", 0.75],
  };
  const [surfaceColor, deepColor, visibility] = palettes[biome];

  const month = new Date(o.date).getMonth() + 1;
  const events = Array.from({ length: 6 }, () => ({
    atDepth: Math.round(rand() * Math.min(floor, 1000)),
    type: ["whaleShark", "squidSchool", "bloom", "whaleFall", "vent", "argoFloat"][Math.floor(rand() * 6)],
  }));

  return {
    seed, rand, biome, seafloorDepth: floor, thermoclineDepth: thermo,
    omzTop: biome === "arabian" ? 150 + Math.round(rand() * 60) : null,
    surfaceColor, deepColor, visibility,
    isNight: new Date().getHours() < 6 || new Date().getHours() >= 19,
    monsoon: month >= 6 && month <= 9,
    events,
  };
}
