import React from 'react';
import { BENGAL_PLUME_CONFIG } from './Config';

export const BengalPlumeEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={BENGAL_PLUME_CONFIG.lighting.ambientIntensity}
        color={BENGAL_PLUME_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[8, 16, 6]}
        intensity={BENGAL_PLUME_CONFIG.lighting.sunIntensity}
        color={BENGAL_PLUME_CONFIG.lighting.sunColor}
      />
    </group>
  );
};
