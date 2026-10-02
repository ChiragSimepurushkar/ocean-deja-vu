import React from 'react';
import { CYCLONE_CONFIG } from './Config';

export const CycloneEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={CYCLONE_CONFIG.lighting.ambientIntensity}
        color={CYCLONE_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[8, 12, 5]}
        intensity={CYCLONE_CONFIG.lighting.sunIntensity}
        color={CYCLONE_CONFIG.lighting.sunColor}
      />
    </group>
  );
};
