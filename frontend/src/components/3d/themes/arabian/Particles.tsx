import React from 'react';
import { ParticleField } from '../../core/ParticleField';
import { ARABIAN_UPWELLING_CONFIG } from './Config';

export const ArabianUpwellingParticles: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group>
      <ParticleField
        currentDepth={currentDepth}
        profile="plankton"
        count={ARABIAN_UPWELLING_CONFIG.particles.count}
        color={ARABIAN_UPWELLING_CONFIG.particles.color}
        size={ARABIAN_UPWELLING_CONFIG.particles.size}
        speedMultiplier={1.6}
      />
    </group>
  );
};
