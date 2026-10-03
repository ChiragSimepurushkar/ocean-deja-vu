import { depthToY } from '../../core/depthScale';

export const NIGHT_CONFIG = {
  id: 'night',
  name: 'Pelagic Nocturne',
  layer: 'event' as const,
  depthRange: [0, 150] as [number, number],
  yRange: [depthToY(0), depthToY(150)] as [number, number],
  lighting: {
    moonColor: '#bae6fd',
    moonIntensity: 0.5,
    ambientColor: '#0c4a6e',
    ambientIntensity: 0.15,
    fogColor: '#020617',
    fogDensity: 0.018,
  },
  particles: {
    profile: 'biolum' as const,
    count: 2000,
    color: '#38bdf8',
    size: 4.5,
  },
  creatureBias: {
    schoolFish: 0.5,
    predators: 0.5, // Nocturnal prowlers
    gelatinous: 0.8,
    deepFish: 0.5,
    benthic: 0.2,
    megafauna: 0.3,
    empty: 0.1,
  },
};
