import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { VENT_CONFIG } from './Config';

export const VentParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="vent"
        count={VENT_CONFIG.particles.count}
        color={VENT_CONFIG.particles.color}
        size={VENT_CONFIG.particles.size}
        speedMultiplier={1.5}
      />
    </group>
  );
};
