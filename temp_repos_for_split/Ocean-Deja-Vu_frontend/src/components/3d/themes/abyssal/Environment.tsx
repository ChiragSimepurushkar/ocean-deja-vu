import React from 'react';
import { ABYSSAL_CONFIG } from './Config';

export const AbyssalEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={ABYSSAL_CONFIG.lighting.ambientIntensity}
        color={ABYSSAL_CONFIG.lighting.ambientColor}
      />
    </group>
  );
};
