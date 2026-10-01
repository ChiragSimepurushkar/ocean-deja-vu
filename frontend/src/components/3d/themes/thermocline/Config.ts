import { depthToY } from '../../core/depthScale';

export const THERMOCLINE_CONFIG = {
  id: 'thermocline',
  name: 'Thermocline Seam',
  layer: 'depth-zone' as const,
  depthRange: [60, 200] as [number, number],
  seamDepth: 120,
  seamY: depthToY(120),
  yRange: [depthToY(60), depthToY(200)] as [number, number],
  lighting: {
    sunColor: '#bae6fd',
    sunIntensity: 0.35,
    ambientColor: '#1e3a8a',
    ambientIntensity: 0.75,
    fogColor: '#172554',
    fogDensity: 0.016,
  },
  particles: {
    profile: 'snow' as const,
    count: 2000,
    color: '#93c5fd',
    size: 4.8,
  },
  creatureBias: {
    schoolFish: 0.5,
    predators: 0.5,
    gelatinous: 0.7,
    deepFish: 0.3,
    benthic: 0.0,
    megafauna: 0.4,
    empty: 0.1,
  },
};
