import React from 'react';
import { BengalPlumeEnvironment } from './Environment';
import { HaloclineInterface } from './HaloclineInterface';
import { DeltaicFauna } from './DeltaicFauna';
import { BengalPlumeParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const BengalPlumeTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-bengal-plume">
      <BengalPlumeEnvironment />
      <HaloclineInterface />
      <DeltaicFauna />
      <BengalPlumeParticles currentDepth={currentDepth} />
    </group>
  );
};
export default BengalPlumeTheme;
