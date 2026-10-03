import React from 'react';
import { VentEnvironment } from './Environment';
import { ChimneyStack } from './ChimneyStack';
import { TubeWorms } from './TubeWorms';
import { VentParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const VentTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-hydrothermal-vent">
      <VentEnvironment />
      <ChimneyStack />
      <TubeWorms />
      <VentParticles currentDepth={currentDepth} />
    </group>
  );
};
export default VentTheme;
