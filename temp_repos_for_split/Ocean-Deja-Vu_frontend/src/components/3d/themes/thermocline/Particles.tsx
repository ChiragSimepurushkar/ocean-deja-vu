import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { THERMOCLINE_CONFIG } from './Config';

export const ThermoclineParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="snow"
        count={THERMOCLINE_CONFIG.particles.count}
        color={THERMOCLINE_CONFIG.particles.color}
        size={THERMOCLINE_CONFIG.particles.size}
        speedMultiplier={0.9}
      />
    </group>
  );
};
