import { depthToY } from '../../core/depthScale';

export const TRENCH_CONFIG = {
  id: 'trench',
  name: 'Hadal Trench Abyss',
  layer: 'seafloor' as const,
  depthRange: [900, 1500] as [number, number],
  floorY: depthToY(1000) - 40,
  wallHeight: 120,
  lighting: {
    ambientColor: '#000000',
    ambientIntensity: 0.03,
    fogColor: '#000000',
    fogDensity: 0.032,
  },
  particles: {
    profile: 'sediment' as const,
    count: 1200,
    color: '#64748b',
    size: 4.0,
  },
  creatureBias: {
    schoolFish: 0.0,
    predators: 0.0,
    gelatinous: 0.2,
    deepFish: 0.5,
    benthic: 0.8,
    megafauna: 0.0,
    empty: 0.4,
  },
};
