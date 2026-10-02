import React from 'react';
import { VENT_CONFIG } from './Config';

export const VentEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={VENT_CONFIG.lighting.ambientIntensity}
        color={VENT_CONFIG.lighting.ambientColor}
      />
    </group>
  );
};
