import React from 'react';
import { TRENCH_CONFIG } from './Config';

export const TrenchEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={TRENCH_CONFIG.lighting.ambientIntensity}
        color={TRENCH_CONFIG.lighting.ambientColor}
      />
    </group>
  );
};
