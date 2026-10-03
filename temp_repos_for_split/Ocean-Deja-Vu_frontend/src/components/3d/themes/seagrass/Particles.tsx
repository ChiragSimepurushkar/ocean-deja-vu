import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { SEAGRASS_CONFIG } from './Config';

export const SeagrassParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="sediment"
        count={SEAGRASS_CONFIG.particles.count}
        color={SEAGRASS_CONFIG.particles.color}
        size={SEAGRASS_CONFIG.particles.size}
        speedMultiplier={0.7}
      />
    </group>
  );
};
