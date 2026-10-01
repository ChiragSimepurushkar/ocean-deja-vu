import React from 'react';
import { TrenchEnvironment } from './Environment';
import { TrenchWalls } from './TrenchWalls';
import { HadalFauna } from './HadalFauna';
import { TrenchParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const TrenchTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-trench">
      <TrenchEnvironment />
      <TrenchWalls />
      <HadalFauna />
      <TrenchParticles currentDepth={currentDepth} />
    </group>
  );
};
export default TrenchTheme;
