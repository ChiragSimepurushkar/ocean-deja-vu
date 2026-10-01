import React from 'react';
import { NightBloomEnvironment } from './Environment';
import { PyrosomeColony } from './PyrosomeColony';
import { DisturbanceSparks } from './DisturbanceSparks';
import { NightBloomParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const NightBloomTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-bioluminescent-bloom">
      <NightBloomEnvironment />
      <PyrosomeColony />
      <DisturbanceSparks currentDepth={currentDepth} />
      <NightBloomParticles currentDepth={currentDepth} />
    </group>
  );
};
export default NightBloomTheme;
