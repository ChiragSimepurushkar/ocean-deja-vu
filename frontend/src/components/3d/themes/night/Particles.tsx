import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { NIGHT_CONFIG } from './Config';

export const NightParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="biolum"
        count={NIGHT_CONFIG.particles.count}
        color={NIGHT_CONFIG.particles.color}
        size={NIGHT_CONFIG.particles.size}
        speedMultiplier={0.6}
      />
    </group>
  );
};
