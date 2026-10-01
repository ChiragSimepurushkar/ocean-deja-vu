import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { SUNLIT_CONFIG } from './Config';

export const SunlitParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="bubbles"
        count={SUNLIT_CONFIG.particles.count}
        color={SUNLIT_CONFIG.particles.color}
        size={SUNLIT_CONFIG.particles.size}
        speedMultiplier={1.2}
      />
    </group>
  );
};
