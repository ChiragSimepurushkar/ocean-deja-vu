import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { ABYSSAL_CONFIG } from './Config';

export const AbyssalParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="snow"
        count={ABYSSAL_CONFIG.particles.count}
        color={ABYSSAL_CONFIG.particles.color}
        size={ABYSSAL_CONFIG.particles.size}
        speedMultiplier={0.5}
      />
    </group>
  );
};
