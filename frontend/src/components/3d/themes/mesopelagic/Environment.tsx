import React from 'react';
import { MESOPELAGIC_CONFIG } from './Config';

export const MesopelagicEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={MESOPELAGIC_CONFIG.lighting.ambientIntensity}
        color={MESOPELAGIC_CONFIG.lighting.ambientColor}
      />
    </group>
  );
};
