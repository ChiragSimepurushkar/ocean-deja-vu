import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { EDDY_CONFIG } from './Config';

export const EddyParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="plankton"
        count={EDDY_CONFIG.particles.count}
        color={EDDY_CONFIG.particles.color}
        size={EDDY_CONFIG.particles.size}
        speedMultiplier={1.2}
        swirl={1.5}
      />
    </group>
  );
};
