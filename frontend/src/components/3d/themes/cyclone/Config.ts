import { depthToY } from '../../core/depthScale';

export const CYCLONE_CONFIG = {
  id: 'cyclone',
  name: 'Tropical Cyclone Storm',
  layer: 'event' as const,
  depthRange: [0, 90] as [number, number],
  yRange: [depthToY(0), depthToY(90)] as [number, number],
  lighting: {
    sunColor: '#94a3b8',
    sunIntensity: 0.6,
    ambientColor: '#334155',
    ambientIntensity: 0.8,
    fogColor: '#475569',
    fogDensity: 0.024,
  },
  particles: {
    profile: 'bubbles' as const,
    count: 2600,
    color: '#cbd5e1',
    size: 5.5,
  },
  storm: {
    windShear: 2.8,
    shakeIntensity: 0.45,
    foamLayerY: 1.5,
  },
  creatureBias: {
    schoolFish: 0.25, // Scattered by storm turbulence
    predators: 0.2,
    gelatinous: 0.3,
    deepFish: 0.1,
    benthic: 0.0,
    megafauna: 0.1,
    empty: 0.3,
  },
};
