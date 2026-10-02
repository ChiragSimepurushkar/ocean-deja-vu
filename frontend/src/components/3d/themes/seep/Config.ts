import { depthToY } from '../../core/depthScale';

export const SEEP_CONFIG = {
  id: 'seep',
  name: 'Cold Methane Seep',
  layer: 'seafloor' as const,
  depthRange: [700, 1100] as [number, number],
  floorY: depthToY(950),
  lighting: {
    ambientColor: '#001a0e',
    ambientIntensity: 0.15,
    fogColor: '#040d0a',
    fogDensity: 0.018,
  },
  particles: {
    profile: 'methane' as const,
    count: 1600,
    color: '#ccfbf1',
    size: 5.5,
  },
  creatureBias: {
    schoolFish: 0.0,
    predators: 0.0,
    gelatinous: 0.2,
    deepFish: 0.2,
    benthic: 1.0,
    megafauna: 0.0,
    empty: 0.1,
  },
};
