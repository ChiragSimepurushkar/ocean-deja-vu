import React from 'react';
import { OMZ_CONFIG } from './Config';

export const OMZEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={OMZ_CONFIG.lighting.ambientIntensity}
        color={OMZ_CONFIG.lighting.ambientColor}
      />
    </group>
  );
};
