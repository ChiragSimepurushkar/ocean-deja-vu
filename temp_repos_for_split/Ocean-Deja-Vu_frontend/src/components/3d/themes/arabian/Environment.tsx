import React from 'react';
import { ARABIAN_UPWELLING_CONFIG } from './Config';

export const ArabianUpwellingEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={ARABIAN_UPWELLING_CONFIG.lighting.ambientIntensity}
        color={ARABIAN_UPWELLING_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[14, 25, 6]}
        intensity={ARABIAN_UPWELLING_CONFIG.lighting.sunIntensity}
        color={ARABIAN_UPWELLING_CONFIG.lighting.sunColor}
      />
    </group>
  );
};
