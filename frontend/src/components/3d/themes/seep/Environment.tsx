import React from 'react';
import { SEEP_CONFIG } from './Config';

export const SeepEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={SEEP_CONFIG.lighting.ambientIntensity}
        color={SEEP_CONFIG.lighting.ambientColor}
      />
    </group>
  );
};
