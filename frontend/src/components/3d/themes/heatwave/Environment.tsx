import React from 'react';
import { HEATWAVE_CONFIG } from './Config';

export const HeatwaveEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={HEATWAVE_CONFIG.lighting.ambientIntensity}
        color={HEATWAVE_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[10, 24, 8]}
        intensity={HEATWAVE_CONFIG.lighting.sunIntensity}
        color={HEATWAVE_CONFIG.lighting.sunColor}
      />
    </group>
  );
};
