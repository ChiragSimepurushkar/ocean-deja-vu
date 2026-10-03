import React from 'react';
import { NightEnvironment } from './Environment';
import { MoonlitSurface } from './MoonlitSurface';
import { NocturnalFauna } from './NocturnalFauna';
import { NightParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const NightTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-pelagic-night">
      <NightEnvironment />
      <MoonlitSurface />
      <NocturnalFauna />
      <NightParticles currentDepth={currentDepth} />
    </group>
  );
};
export default NightTheme;
