import { depthToY } from '../../core/depthScale';

export const OMZ_CONFIG = {
  id: 'omz',
  name: 'Oxygen Minimum Zone (OMZ)',
  layer: 'depth-zone' as const,
  depthRange: [200, 500] as [number, number],
  yRange: [depthToY(200), depthToY(500)] as [number, number],
  lighting: {
    ambientColor: '#0f172a',
    ambientIntensity: 0.35,
    fogColor: '#020617',
    fogDensity: 0.02,
  },
  particles: {
    profile: 'snow' as const,
    count: 800, // Sparse marine snow in hypoxic stagnation
    color: '#64748b',
    size: 3.5,
  },
  creatureBias: {
    schoolFish: 0.05, // Almost no active swimmers
    predators: 0.05,
    gelatinous: 0.6,
    deepFish: 0.2,
    benthic: 0.0,
    megafauna: 0.05,
    empty: 0.75, // Intentional vast emptiness
  },
};
