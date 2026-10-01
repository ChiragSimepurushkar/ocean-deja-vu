import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { OMZ_CONFIG } from './Config';

export const OMZParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="snow"
        count={OMZ_CONFIG.particles.count}
        color={OMZ_CONFIG.particles.color}
        size={OMZ_CONFIG.particles.size}
        speedMultiplier={0.5}
      />
    </group>
  );
};
