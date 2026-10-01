import React from 'react';
import { SunlitEnvironment } from './Environment';
import { SunlitFlora } from './Flora';
import { SunlitFauna } from './Fauna';
import { SunlitParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';
export * from './Shaders';

export const SunlitTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-sunlit">
      <SunlitEnvironment currentDepth={currentDepth} />
      <SunlitFlora currentDepth={currentDepth} />
      <SunlitFauna currentDepth={currentDepth} />
      <SunlitParticles currentDepth={currentDepth} />
    </group>
  );
};
export default SunlitTheme;
