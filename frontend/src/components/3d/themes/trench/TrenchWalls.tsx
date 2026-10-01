import React from 'react';
import { TRENCH_CONFIG } from './Config';

export const TrenchWalls: React.FC = () => {
  const floorY = TRENCH_CONFIG.floorY;

  return (
    <group>
      {/* Trench Floor */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 160, 8, 32]} />
        <meshStandardMaterial color="#050811" roughness={0.9} />
      </mesh>

      {/* West Canyon Wall */}
      <mesh position={[-20, floorY + 60, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[160, 120, 16, 16]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.95} />
      </mesh>

      {/* East Canyon Wall */}
      <mesh position={[20, floorY + 60, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[160, 120, 16, 16]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.95} />
      </mesh>

      {/* Overhanging rock ledges */}
      {[-8, 0, 8].map((z, i) => (
        <mesh key={i} position={[-16, floorY + 30 + i * 20, z]} scale={[8, 2, 12]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#030712" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
};
