import { depthToY } from '../../core/depthScale';

export const ABYSSAL_CONFIG = {
  id: 'abyssal',
  name: 'Abyssal Plain',
  layer: 'depth-zone' as const,
  depthRange: [800, 1000] as [number, number],
  seafloorY: depthToY(980),
  yRange: [depthToY(800), depthToY(1000)] as [number, number],
  lighting: {
    ambientColor: '#000000',
    ambientIntensity: 0.05,
    fogColor: '#000000',
    fogDensity: 0.024,
  },
  nodules: {
    count: 65,
  },
  particles: {
    profile: 'snow' as const,
    count: 1400,
    color: '#38bdf8',
    size: 4.5,
  },
  creatureBias: {
    schoolFish: 0.0,
    predators: 0.1,
    gelatinous: 0.4,
    deepFish: 0.85,
    benthic: 0.45,
    megafauna: 0.05,
    empty: 0.3,
  },
};
