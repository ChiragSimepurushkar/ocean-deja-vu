import React from 'react';
import { DeepPelagicEnvironment } from './Environment';
import { DeepViperfish } from './Viperfish';
import { GiantSquidSilhouette } from './GiantSquidSilhouette';
import { DeepPelagicParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const DeepPelagicTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-deep-pelagic">
      <DeepPelagicEnvironment />
      <DeepViperfish />
      <GiantSquidSilhouette />
      <DeepPelagicParticles currentDepth={currentDepth} />
    </group>
  );
};
export default DeepPelagicTheme;
