import React from 'react';
import { DEEP_PELAGIC_CONFIG } from './Config';

export const DeepPelagicEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={DEEP_PELAGIC_CONFIG.lighting.ambientIntensity}
        color={DEEP_PELAGIC_CONFIG.lighting.ambientColor}
      />
    </group>
  );
};
