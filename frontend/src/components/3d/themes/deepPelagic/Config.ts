import { depthToY } from '../../core/depthScale';

export const DEEP_PELAGIC_CONFIG = {
  id: 'deepPelagic',
  name: 'Deep Pelagic Midnight',
  layer: 'depth-zone' as const,
  depthRange: [500, 800] as [number, number],
  yRange: [depthToY(500), depthToY(800)] as [number, number],
  lighting: {
    ambientColor: '#020617',
    ambientIntensity: 0.12,
    fogColor: '#000000',
    fogDensity: 0.022,
  },
  particles: {
    profile: 'biolum' as const,
    count: 1500,
    color: '#0284c7',
    size: 4.2,
  },
  creatureBias: {
    schoolFish: 0.1,
    predators: 0.3,
    gelatinous: 0.7,
    deepFish: 0.9,
    benthic: 0.0,
    megafauna: 0.2,
    empty: 0.2,
  },
};
