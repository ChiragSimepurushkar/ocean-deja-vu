import React from 'react';
import { NIGHT_CONFIG } from './Config';

export const NightEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={NIGHT_CONFIG.lighting.ambientIntensity}
        color={NIGHT_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[6, 20, 6]}
        intensity={NIGHT_CONFIG.lighting.moonIntensity}
        color={NIGHT_CONFIG.lighting.moonColor}
      />
    </group>
  );
};
