import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { TRENCH_CONFIG } from './Config';

export const TrenchParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="sediment"
        count={TRENCH_CONFIG.particles.count}
        color={TRENCH_CONFIG.particles.color}
        size={TRENCH_CONFIG.particles.size}
        speedMultiplier={0.5}
      />
    </group>
  );
};
