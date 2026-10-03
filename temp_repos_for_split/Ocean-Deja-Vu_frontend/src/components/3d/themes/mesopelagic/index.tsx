import React from 'react';
import { MesopelagicEnvironment } from './Environment';
import { LanternfishSchool } from './LanternfishSchool';
import { MesopelagicGlassSquid } from './GlassSquid';
import { SiphonophoreChain } from './SiphonophoreChain';
import { MesopelagicParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const MesopelagicTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-mesopelagic">
      <MesopelagicEnvironment />
      <LanternfishSchool />
      <MesopelagicGlassSquid />
      <SiphonophoreChain />
      <MesopelagicParticles currentDepth={currentDepth} />
    </group>
  );
};
export default MesopelagicTheme;
