import React from 'react';
import { REEF_CONFIG } from './Config';

export const ReefEnvironment: React.FC<{ currentDepth: number }> = () => {
  return (
    <group>
      <ambientLight
        intensity={REEF_CONFIG.lighting.ambientIntensity}
        color={REEF_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[10, 20, 10]}
        intensity={REEF_CONFIG.lighting.sunIntensity}
        color={REEF_CONFIG.lighting.sunColor}
      />
    </group>
  );
};
