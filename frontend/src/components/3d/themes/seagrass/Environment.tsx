import React from 'react';
import { SEAGRASS_CONFIG } from './Config';

export const SeagrassEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={SEAGRASS_CONFIG.lighting.ambientIntensity}
        color={SEAGRASS_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[8, 18, 5]}
        intensity={SEAGRASS_CONFIG.lighting.sunIntensity}
        color={SEAGRASS_CONFIG.lighting.sunColor}
      />
    </group>
  );
};
