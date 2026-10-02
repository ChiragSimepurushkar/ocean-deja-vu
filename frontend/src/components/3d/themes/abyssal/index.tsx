import React from 'react';
import { AbyssalEnvironment } from './Environment';
import { AbyssalAnglerfish } from './Anglerfish';
import { TripodFish } from './TripodFish';
import { BenthicPlain } from './BenthicPlain';
import { AbyssalParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const AbyssalTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-abyssal">
      <AbyssalEnvironment />
      <BenthicPlain />
      <AbyssalAnglerfish />
      <TripodFish />
      <AbyssalParticles currentDepth={currentDepth} />
    </group>
  );
};
export default AbyssalTheme;
