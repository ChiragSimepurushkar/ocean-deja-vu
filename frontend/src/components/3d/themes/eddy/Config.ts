import { depthToY } from '../../core/depthScale';

export const EDDY_CONFIG = {
  id: 'eddy',
  name: 'Mesoscale Eddy Vortex',
  layer: 'event' as const,
  depthRange: [0, 200] as [number, number],
  yRange: [depthToY(0), depthToY(200)] as [number, number],
  lighting: {
    sunColor: '#bae6fd',
    sunIntensity: 1.4,
    ambientColor: '#0284c7',
    ambientIntensity: 1.0,
    fogColor: '#0c4a6e',
    fogDensity: 0.015,
  },
  particles: {
    profile: 'plankton' as const,
    count: 2400,
    color: '#38bdf8',
    size: 4.5,
  },
  vortex: {
    swirlVelocity: 1.8,
    coreRadius: 8.0,
    rimRadius: 22.0,
  },
  creatureBias: {
    schoolFish: 0.9,
    predators: 0.6,
    gelatinous: 0.5,
    deepFish: 0.2,
    benthic: 0.0,
    megafauna: 0.5,
    empty: 0.05,
  },
};
