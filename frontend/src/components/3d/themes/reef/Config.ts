import { depthToY } from '../../core/depthScale';

export const REEF_CONFIG = {
  id: 'reef',
  name: 'Coral Reef Sanctuary',
  layer: 'seafloor' as const,
  depthRange: [5, 45] as [number, number],
  seafloorY: depthToY(35),
  lighting: {
    sunColor: '#ecfeff',
    sunIntensity: 2.0,
    ambientColor: '#06b6d4',
    ambientIntensity: 1.4,
    fogColor: '#0284c7',
    fogDensity: 0.013,
  },
  particles: {
    profile: 'bubbles' as const,
    count: 1400,
    color: '#bae6fd',
    size: 5.5,
  },
  corals: {
    branchingCount: 30,
    tableCount: 20,
    spongeCount: 15,
  },
  creatureBias: {
    schoolFish: 1.0,
    predators: 0.5,
    gelatinous: 0.3,
    deepFish: 0.0,
    benthic: 0.95,
    megafauna: 0.7,
    empty: 0.0,
  },
};
