import { depthToY } from '../../core/depthScale';

export const MESOPELAGIC_CONFIG = {
  id: 'mesopelagic',
  name: 'Mesopelagic Twilight',
  layer: 'depth-zone' as const,
  depthRange: [250, 500] as [number, number],
  yRange: [depthToY(250), depthToY(500)] as [number, number],
  lighting: {
    ambientColor: '#0369a1',
    ambientIntensity: 0.25,
    fogColor: '#020617',
    fogDensity: 0.018,
  },
  particles: {
    profile: 'biolum' as const,
    count: 2200,
    color: '#38bdf8',
    size: 4.8,
  },
  creatureBias: {
    schoolFish: 0.3,
    predators: 0.3,
    gelatinous: 0.8,
    deepFish: 0.7,
    benthic: 0.0,
    megafauna: 0.2,
    empty: 0.1,
  },
};
