import React from 'react';
import { OMZEnvironment } from './Environment';
import { VampireSquid } from './VampireSquid';
import { HypoxicMedusa } from './HypoxicMedusa';
import { OMZParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const OMZTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-omz">
      <OMZEnvironment />
      <VampireSquid />
      <HypoxicMedusa />
      <OMZParticles currentDepth={currentDepth} />
    </group>
  );
};
export default OMZTheme;
