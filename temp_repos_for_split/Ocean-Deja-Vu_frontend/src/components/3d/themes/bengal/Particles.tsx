import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { BENGAL_PLUME_CONFIG } from './Config';

export const BengalPlumeParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="sediment"
        count={BENGAL_PLUME_CONFIG.particles.count}
        color={BENGAL_PLUME_CONFIG.particles.color}
        size={BENGAL_PLUME_CONFIG.particles.size}
        speedMultiplier={0.7}
      />
    </group>
  );
};
