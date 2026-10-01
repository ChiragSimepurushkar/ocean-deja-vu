import React from 'react';
import { ArabianUpwellingEnvironment } from './Environment';
import { UpwellingPlume } from './UpwellingPlume';
import { UpwellingFauna } from './UpwellingFauna';
import { ArabianUpwellingParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const ArabianUpwellingTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-arabian-upwelling">
      <ArabianUpwellingEnvironment />
      <UpwellingPlume />
      <UpwellingFauna />
      <ArabianUpwellingParticles currentDepth={currentDepth} />
    </group>
  );
};
export default ArabianUpwellingTheme;
