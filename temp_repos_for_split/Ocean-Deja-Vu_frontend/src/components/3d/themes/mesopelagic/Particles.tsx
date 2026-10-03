import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { MESOPELAGIC_CONFIG } from './Config';

export const MesopelagicParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="biolum"
        count={MESOPELAGIC_CONFIG.particles.count}
        color={MESOPELAGIC_CONFIG.particles.color}
        size={MESOPELAGIC_CONFIG.particles.size}
        speedMultiplier={0.7}
      />
    </group>
  );
};
