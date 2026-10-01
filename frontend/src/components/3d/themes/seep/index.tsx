import React from 'react';
import { SeepEnvironment } from './Environment';
import { CarbonateMounds } from './CarbonateMounds';
import { BacterialMats } from './BacterialMats';
import { SeepParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const SeepTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-cold-seep">
      <SeepEnvironment />
      <CarbonateMounds />
      <BacterialMats />
      <SeepParticles currentDepth={currentDepth} />
    </group>
  );
};
export default SeepTheme;
