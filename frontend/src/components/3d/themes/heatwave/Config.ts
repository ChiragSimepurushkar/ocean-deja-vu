import { depthToY } from '../../core/depthScale';

export const HEATWAVE_CONFIG = {
  id: 'heatwave',
  name: 'Marine Heatwave & Bleaching',
  layer: 'event' as const,
  depthRange: [0, 60] as [number, number],
  yRange: [depthToY(0), depthToY(60)] as [number, number],
  floorY: depthToY(35),
  lighting: {
    sunColor: '#fdba74',
    sunIntensity: 2.4, // Blistering tropical thermal irradiance
    ambientColor: '#f97316',
    ambientIntensity: 1.3,
    fogColor: '#7c2d12',
    fogDensity: 0.016,
  },
  particles: {
    profile: 'bubbles' as const,
    count: 1400,
    color: '#ffedd5',
    size: 5.0,
  },
  creatureBias: {
    schoolFish: 0.35, // Emigrated or perished from hypoxia/heat
    predators: 0.25,
    gelatinous: 0.6,
    deepFish: 0.05,
    benthic: 0.3,
    megafauna: 0.2,
    empty: 0.35,
  },
};
