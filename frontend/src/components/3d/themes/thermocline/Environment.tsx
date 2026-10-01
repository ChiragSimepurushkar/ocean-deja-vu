import React from 'react';
import { THERMOCLINE_CONFIG } from './Config';

export const ThermoclineEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={THERMOCLINE_CONFIG.lighting.ambientIntensity}
        color={THERMOCLINE_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[6, 15, 4]}
        intensity={THERMOCLINE_CONFIG.lighting.sunIntensity}
        color={THERMOCLINE_CONFIG.lighting.sunColor}
      />
    </group>
  );
};
