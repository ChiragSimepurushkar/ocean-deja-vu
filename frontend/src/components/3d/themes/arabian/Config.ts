import { depthToY } from '../../core/depthScale';

export const ARABIAN_UPWELLING_CONFIG = {
  id: 'arabian',
  name: 'Arabian Coastal Upwelling',
  layer: 'water-mass' as const,
  depthRange: [0, 100] as [number, number],
  yRange: [depthToY(0), depthToY(100)] as [number, number],
  lighting: {
    sunColor: '#e0f2fe',
    sunIntensity: 1.7,
    ambientColor: '#38bdf8',
    ambientIntensity: 1.2,
    fogColor: '#0c4a6e',
    fogDensity: 0.016,
  },
  particles: {
    profile: 'plankton' as const,
    count: 2200,
    color: '#7dd3fc',
    size: 4.8,
  },
  flow: {
    upwardSpeed: 1.8, // Vertical advection bias
  },
  creatureBias: {
    schoolFish: 0.95,
    predators: 0.7,
    gelatinous: 0.4,
    deepFish: 0.2,
    benthic: 0.1,
    megafauna: 0.6,
    empty: 0.05,
  },
};
