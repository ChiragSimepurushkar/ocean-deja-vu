import React from 'react';
import { CycloneEnvironment } from './Environment';
import { StormFoamSurface } from './StormFoamSurface';
import { CycloneParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const CycloneTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-cyclone">
      <CycloneEnvironment />
      <StormFoamSurface />
      <CycloneParticles currentDepth={currentDepth} />
    </group>
  );
};
export default CycloneTheme;
