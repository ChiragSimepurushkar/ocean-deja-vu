export interface DepthBand {
  depth: number; // in meters (0, 50, 100, 200, 300, 500, 1000)
  tempC: number;
  salinityPsu: number;
  oxygenMgL: number;
  lightPercent: number;
  pressureAtm: number;
  layerName: string;
  zone: 'Epipelagic' | 'Mesopelagic' | 'Bathypelagic';
  scientificNote: string;
  waterColorTop: string;
  waterColorBottom: string;
  speciesAtDepth: MarineSpecies[];
}

export interface MarineSpecies {
  id: string;
  name: string;
  scientificName: string;
  depthRange: string;
  minDepth: number;
  maxDepth: number;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Legendary';
  description: string;
  points: number;
  color: string;
  glowColor?: string;
  type: 'fish' | 'ray' | 'turtle' | 'jellyfish' | 'squid' | 'angler' | 'siphonophore';
}

export interface OceanStation {
  id: string;
  name: string;
  region: 'Arabian Sea' | 'Bay of Bengal' | 'Lakshadweep Basin' | 'Andaman Sea' | 'Equatorial Channel';
  coords: {
    lat: number;
    lon: number;
    displayCoords: string;
  };
  mapPosition: {
    x: number; // percentage 0-100 on map canvas
    y: number; // percentage 0-100 on map canvas
  };
  sst: number; // Sea Surface Temp °C
  surfaceSalinity: number; // PSU
  slaMeters: number; // Sea Level Anomaly
  windSpeedKnots: number;
  mixedLayerDepthM: number;
  thermoclineDepthM: number;
  description: string;
  historicalAnomaly: string;
  depthProfiles: DepthBand[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  depthTrigger?: number;
  speciesTrigger?: number;
  icon: string;
  unlockedAt?: string;
}

export interface LeaderboardEntry {
  id: string;
  callsign: string;
  maxDepth: number;
  score: number;
  badgesCount: number;
  speciesDiscovered: number;
  favoriteStation: string;
  date: string;
  isCurrentUser?: boolean;
}

export interface UserProgress {
  callsign: string;
  score: number;
  maxDepthReached: number;
  unlockedDepths: number[];
  unlockedBadges: string[];
  discoveredSpecies: string[];
  currentStationId: string;
  soundEnabled: boolean;
}
