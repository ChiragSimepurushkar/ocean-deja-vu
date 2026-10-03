import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { REEF_CONFIG } from './Config';

export const ReefParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="bubbles"
        count={REEF_CONFIG.particles.count}
        color={REEF_CONFIG.particles.color}
        size={REEF_CONFIG.particles.size}
        speedMultiplier={1.0}
      />
    </group>
  );
};
