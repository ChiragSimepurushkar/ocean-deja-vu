import { depthToY } from '../../core/depthScale';

export const SEAGRASS_CONFIG = {
  id: 'seagrass',
  name: 'Seagrass Meadow',
  layer: 'seafloor' as const,
  depthRange: [5, 30] as [number, number],
  seafloorY: depthToY(25),
  lighting: {
    sunColor: '#f0fdf4',
    sunIntensity: 1.8,
    ambientColor: '#2dd4bf',
    ambientIntensity: 1.2,
    fogColor: '#0d9488',
    fogDensity: 0.015,
  },
  blades: {
    count: 350,
    heightMin: 1.5,
    heightMax: 3.2,
  },
  particles: {
    profile: 'sediment' as const,
    count: 1000,
    color: '#a7f3d0',
    size: 4.8,
  },
  creatureBias: {
    schoolFish: 0.7,
    predators: 0.2,
    gelatinous: 0.2,
    deepFish: 0.0,
    benthic: 1.0,
    megafauna: 0.4,
    empty: 0.05,
  },
};
