import React from 'react';
import { MonsoonBloomEnvironment } from './Environment';
import { FilterFeedingWhaleShark } from './WhaleShark';
import { PlanktonBaitBall } from './BaitBall';
import { MonsoonBloomParticles } from './Particles';
export * from './Config';
export * from './AudioProfile';

export const MonsoonBloomTheme: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  return (
    <group name="theme-monsoon-bloom">
      <MonsoonBloomEnvironment />
      <FilterFeedingWhaleShark />
      <PlanktonBaitBall />
      <MonsoonBloomParticles currentDepth={currentDepth} />
    </group>
  );
};
export default MonsoonBloomTheme;
