import { depthToY } from '../../core/depthScale';

export const OPEN_OCEAN_CONFIG = {
  id: 'openOcean',
  name: 'Open Ocean Pelagic',
  layer: 'depth-zone' as const,
  depthRange: [10, 80] as [number, number],
  yRange: [depthToY(10), depthToY(80)] as [number, number],
  lighting: {
    sunColor: '#e0f2fe',
    sunIntensity: 1.6,
    ambientColor: '#0284c7',
    ambientIntensity: 1.1,
    fogColor: '#0369a1',
    fogDensity: 0.013,
  },
  particles: {
    profile: 'snow' as const,
    count: 1600,
    color: '#bae6fd',
    size: 4.2,
  },
  creatureBias: {
    schoolFish: 0.8,
    predators: 0.6,
    gelatinous: 0.3,
    deepFish: 0.1,
    benthic: 0.0,
    megafauna: 0.8,
    empty: 0.1,
  },
};
