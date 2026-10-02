import React from 'react';
import { EddyEnvironment } from './Environment';
import { EddyVortexField } from './VortexField';
import { EddyRimPelagics } from './RimPelagics';
import { EddyParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const EddyTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-mesoscale-eddy">
      <EddyEnvironment />
      <EddyVortexField />
      <EddyRimPelagics />
      <EddyParticles currentDepth={currentDepth} />
    </group>
  );
};
export default EddyTheme;
