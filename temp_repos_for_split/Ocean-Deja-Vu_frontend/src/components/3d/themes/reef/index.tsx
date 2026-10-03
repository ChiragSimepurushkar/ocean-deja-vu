import React from 'react';
import { ReefEnvironment } from './Environment';
import { ReefCorals } from './Corals';
import { ReefFauna } from './Fauna';
import { ReefParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';
export * from './Shaders';

export const ReefTheme: React.FC<{ currentDepth: number; bleachFactor?: number }> = ({
  currentDepth,
  bleachFactor = 0,
}) => {
  return (
    <group name="theme-reef">
      <ReefEnvironment currentDepth={currentDepth} />
      <ReefCorals bleachFactor={bleachFactor} />
      <ReefFauna currentDepth={currentDepth} />
      <ReefParticles currentDepth={currentDepth} />
    </group>
  );
};
export default ReefTheme;
