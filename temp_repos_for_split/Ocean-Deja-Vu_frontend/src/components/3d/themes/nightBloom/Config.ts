import { depthToY } from '../../core/depthScale';

export const NIGHT_BLOOM_CONFIG = {
  id: 'nightBloom',
  name: 'Bioluminescent Galaxy Bloom',
  layer: 'event' as const,
  depthRange: [0, 120] as [number, number],
  yRange: [depthToY(0), depthToY(120)] as [number, number],
  lighting: {
    ambientColor: '#052e16',
    ambientIntensity: 0.1,
    fogColor: '#020617',
    fogDensity: 0.016,
  },
  particles: {
    profile: 'biolum' as const,
    count: 3500, // Dense galaxy of dinoflagellate fireflies
    color: '#38bdf8',
    size: 5.5,
  },
  creatureBias: {
    schoolFish: 0.3,
    predators: 0.2,
    gelatinous: 1.0,
    deepFish: 0.3,
    benthic: 0.1,
    megafauna: 0.2,
    empty: 0.05,
  },
};
