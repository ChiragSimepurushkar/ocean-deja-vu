import React from 'react';
import { OPEN_OCEAN_CONFIG } from './Config';

export const OpenOceanEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={OPEN_OCEAN_CONFIG.lighting.ambientIntensity}
        color={OPEN_OCEAN_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[12, 25, 8]}
        intensity={OPEN_OCEAN_CONFIG.lighting.sunIntensity}
        color={OPEN_OCEAN_CONFIG.lighting.sunColor}
      />
    </group>
  );
};
