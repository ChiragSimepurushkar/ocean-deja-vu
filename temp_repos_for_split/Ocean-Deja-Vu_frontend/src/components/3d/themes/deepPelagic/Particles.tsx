import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { DEEP_PELAGIC_CONFIG } from './Config';

export const DeepPelagicParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="biolum"
        count={DEEP_PELAGIC_CONFIG.particles.count}
        color={DEEP_PELAGIC_CONFIG.particles.color}
        size={DEEP_PELAGIC_CONFIG.particles.size}
        speedMultiplier={0.6}
      />
    </group>
  );
};
