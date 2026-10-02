import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { HEATWAVE_CONFIG } from './Config';

export const HeatwaveParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="bubbles"
        count={HEATWAVE_CONFIG.particles.count}
        color={HEATWAVE_CONFIG.particles.color}
        size={HEATWAVE_CONFIG.particles.size}
        speedMultiplier={1.0}
      />
    </group>
  );
};
