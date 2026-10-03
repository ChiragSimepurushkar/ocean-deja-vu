import React from 'react';
import { HeatwaveEnvironment } from './Environment';
import { BleachedReef } from './BleachedReef';
import { HeatwaveParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const HeatwaveTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-heatwave">
      <HeatwaveEnvironment />
      <BleachedReef />
      <HeatwaveParticles currentDepth={currentDepth} />
    </group>
  );
};
export default HeatwaveTheme;
