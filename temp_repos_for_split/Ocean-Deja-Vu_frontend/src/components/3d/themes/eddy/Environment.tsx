import React from 'react';
import { EDDY_CONFIG } from './Config';

export const EddyEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={EDDY_CONFIG.lighting.ambientIntensity}
        color={EDDY_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[10, 20, 10]}
        intensity={EDDY_CONFIG.lighting.sunIntensity}
        color={EDDY_CONFIG.lighting.sunColor}
      />
    </group>
  );
};
