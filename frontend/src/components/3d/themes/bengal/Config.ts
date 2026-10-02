import { depthToY } from '../../core/depthScale';

export const BENGAL_PLUME_CONFIG = {
  id: 'bengal',
  name: 'Bay of Bengal River Plume',
  layer: 'water-mass' as const,
  depthRange: [0, 70] as [number, number],
  yRange: [depthToY(0), depthToY(70)] as [number, number],
  haloclineDepth: 22, // meters
  haloclineY: depthToY(22),
  lighting: {
    sunColor: '#fef08a',
    sunIntensity: 1.4,
    ambientColor: '#2dd4bf',
    ambientIntensity: 1.1,
    fogColor: '#115e59',
    fogDensity: 0.02,
  },
  particles: {
    profile: 'sediment' as const,
    count: 2400,
    color: '#a8a29e',
    size: 4.6,
  },
  creatureBias: {
    schoolFish: 0.8,
    predators: 0.4,
    gelatinous: 0.5,
    deepFish: 0.1,
    benthic: 0.3,
    megafauna: 0.5,
    empty: 0.05,
  },
};
