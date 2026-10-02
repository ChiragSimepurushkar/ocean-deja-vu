import React from 'react';
import { OpenOceanEnvironment } from './Environment';
import { PelagicFauna } from './PelagicFauna';
import { WhaleSilhouette } from './WhaleSilhouette';
import { OpenOceanParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const OpenOceanTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-open-ocean">
      <OpenOceanEnvironment />
      <PelagicFauna currentDepth={currentDepth} />
      <WhaleSilhouette />
      <OpenOceanParticles currentDepth={currentDepth} />
    </group>
  );
};
export default OpenOceanTheme;
