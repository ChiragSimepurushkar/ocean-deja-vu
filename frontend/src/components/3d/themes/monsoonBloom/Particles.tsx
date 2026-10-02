import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { MONSOON_BLOOM_CONFIG } from './Config';

export const MonsoonBloomParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="plankton"
        count={MONSOON_BLOOM_CONFIG.particles.count}
        color={MONSOON_BLOOM_CONFIG.particles.color}
        size={MONSOON_BLOOM_CONFIG.particles.size}
        speedMultiplier={0.8}
      />
    </group>
  );
};
