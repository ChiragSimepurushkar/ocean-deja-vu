import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { OPEN_OCEAN_CONFIG } from './Config';

export const OpenOceanParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="snow"
        count={OPEN_OCEAN_CONFIG.particles.count}
        color={OPEN_OCEAN_CONFIG.particles.color}
        size={OPEN_OCEAN_CONFIG.particles.size}
        speedMultiplier={1.0}
      />
    </group>
  );
};
