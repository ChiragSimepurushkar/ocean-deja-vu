import { depthToY } from '../../core/depthScale';

export const SUNLIT_CONFIG = {
  id: 'sunlit',
  name: 'Sunlit Epipelagic',
  layer: 'depth-zone' as const,
  depthRange: [0, 50] as [number, number],
  yRange: [depthToY(0), depthToY(50)] as [number, number],
  lighting: {
    sunColor: '#ffffff',
    sunIntensity: 2.2,
    ambientColor: '#38bdf8',
    ambientIntensity: 1.3,
    fogColor: '#0ea5e9',
    fogDensity: 0.012,
    causticIntensity: 0.85,
    shaftAlpha: 0.85,
  },
  particles: {
    profile: 'bubbles' as const,
    count: 1200,
    color: '#e0f2fe',
    size: 6.5,
  },
  creatureBias: {
    schoolFish: 0.9,
    predators: 0.4,
    gelatinous: 0.3,
    deepFish: 0.0,
    benthic: 0.1,
    megafauna: 0.6,
    empty: 0.05,
  },
};
