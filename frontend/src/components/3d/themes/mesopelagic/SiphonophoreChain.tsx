import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const SiphonophoreChain: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const segments = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    y: -i * 0.7,
    phase: i * 0.35,
  })), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    groupRef.current.position.set(
      Math.sin(time * 0.15) * 10,
      -150 + Math.cos(time * 0.12) * 2,
      Math.cos(time * 0.18) * 8
    );
    groupRef.current.children.forEach((child, i) => {
      child.position.x = Math.sin(time * 0.8 + i * 0.3) * 0.45;
    });
  });

  return (
    <group ref={groupRef} scale={1.1}>
      {segments.map((seg, i) => (
        <mesh key={i} position={[0, seg.y, 0]}>
          <sphereGeometry args={[0.22 - i * 0.005, 8, 8]} />
          <meshPhysicalMaterial
            color={i % 2 === 0 ? '#38bdf8' : '#22d3ee'}
            transparent
            opacity={0.7}
            transmission={0.3}
            emissive={i % 3 === 0 ? '#0284c7' : '#06b6d4'}
            emissiveIntensity={0.65}
          />
        </mesh>
      ))}
    </group>
  );
};
