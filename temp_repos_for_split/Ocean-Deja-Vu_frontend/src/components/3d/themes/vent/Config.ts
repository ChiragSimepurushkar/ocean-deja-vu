import { depthToY } from '../../core/depthScale';

export const VENT_CONFIG = {
  id: 'vent',
  name: 'Hydrothermal Black Smoker',
  layer: 'seafloor' as const,
  depthRange: [800, 1200] as [number, number],
  floorY: depthToY(980),
  chimneyHeight: 12,
  lighting: {
    amberColor: '#f97316',
    amberIntensity: 3.5,
    ambientColor: '#1c0a00',
    ambientIntensity: 0.1,
    fogColor: '#0c0400',
    fogDensity: 0.02,
  },
  particles: {
    profile: 'vent' as const,
    count: 2200,
    color: '#451a03',
    size: 6.5,
  },
  creatureBias: {
    schoolFish: 0.0,
    predators: 0.0,
    gelatinous: 0.1,
    deepFish: 0.3,
    benthic: 1.0,
    megafauna: 0.0,
    empty: 0.1,
  },
};
