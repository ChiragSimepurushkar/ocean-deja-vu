import React from 'react';
import { NIGHT_BLOOM_CONFIG } from './Config';

export const NightBloomEnvironment: React.FC = () => {
  return (
    <group>
      <ambientLight
        intensity={NIGHT_BLOOM_CONFIG.lighting.ambientIntensity}
        color={NIGHT_BLOOM_CONFIG.lighting.ambientColor}
      />
    </group>
  );
};
