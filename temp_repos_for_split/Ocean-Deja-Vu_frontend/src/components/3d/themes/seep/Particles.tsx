import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { SEEP_CONFIG } from './Config';

export const SeepParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="methane"
        count={SEEP_CONFIG.particles.count}
        color={SEEP_CONFIG.particles.color}
        size={SEEP_CONFIG.particles.size}
        speedMultiplier={0.9}
      />
    </group>
  );
};
