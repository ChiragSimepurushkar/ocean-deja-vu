import React from 'react';
import { MONSOON_BLOOM_CONFIG } from './Config';

export const MonsoonBloomEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={MONSOON_BLOOM_CONFIG.lighting.ambientIntensity}
        color={MONSOON_BLOOM_CONFIG.lighting.ambientColor}
      />
      <directionalLight
        position={[10, 20, 10]}
        intensity={MONSOON_BLOOM_CONFIG.lighting.sunIntensity}
        color={MONSOON_BLOOM_CONFIG.lighting.sunColor}
      />
    </group>
  );
};
