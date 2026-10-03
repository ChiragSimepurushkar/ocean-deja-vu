import { depthToY } from '../../core/depthScale';

export const MONSOON_BLOOM_CONFIG = {
  id: 'monsoonBloom',
  name: 'Monsoon Plankton Bloom',
  layer: 'water-mass' as const,
  depthRange: [0, 80] as [number, number],
  yRange: [depthToY(0), depthToY(80)] as [number, number],
  lighting: {
    sunColor: '#dcfce7',
    sunIntensity: 1.5,
    ambientColor: '#4ade80',
    ambientIntensity: 1.3,
    fogColor: '#14532d',
    fogDensity: 0.022, // Dense phytoplankton turbidity
  },
  particles: {
    profile: 'plankton' as const,
    count: 3200,
    color: '#86efac',
    size: 4.5,
  },
  creatureBias: {
    schoolFish: 1.0,
    predators: 0.7,
    gelatinous: 0.5,
    deepFish: 0.0,
    benthic: 0.2,
    megafauna: 0.9,
    empty: 0.0,
  },
};
