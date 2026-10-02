import React from 'react';
import { ThermoclineEnvironment } from './Environment';
import { RefractiveSeam } from './RefractiveSeam';
import { CombJelly } from './CombJelly';
import { ThermoclineThresherShark } from './ThresherShark';
import { ThermoclineParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const ThermoclineTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-thermocline">
      <ThermoclineEnvironment />
      <RefractiveSeam />
      <CombJelly />
      <ThermoclineThresherShark />
      <ThermoclineParticles currentDepth={currentDepth} />
    </group>
  );
};
export default ThermoclineTheme;
