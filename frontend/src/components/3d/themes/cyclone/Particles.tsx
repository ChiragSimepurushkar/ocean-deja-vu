import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { CYCLONE_CONFIG } from './Config';

export const CycloneParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="bubbles"
        count={CYCLONE_CONFIG.particles.count}
        color={CYCLONE_CONFIG.particles.color}
        size={CYCLONE_CONFIG.particles.size}
        speedMultiplier={2.5}
        swirl={1.2}
      />
    </group>
  );
};
