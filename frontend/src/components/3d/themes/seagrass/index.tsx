import React from 'react';
import { SeagrassEnvironment } from './Environment';
import { SeagrassMeadow } from './Meadow';
import { SeagrassFauna } from './Fauna';
import { SeagrassParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';
export * from './Shaders';

export const SeagrassTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-seagrass">
      <SeagrassEnvironment />
      <SeagrassMeadow />
      <SeagrassFauna />
      <SeagrassParticles currentDepth={currentDepth} />
    </group>
  );
};
export default SeagrassTheme;
