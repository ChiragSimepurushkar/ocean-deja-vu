import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const PyrosomeColony: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    groupRef.current.position.set(
      Math.sin(time * 0.2) * 12,
      -35 + Math.cos(time * 0.25) * 2,
      Math.cos(time * 0.18) * 8
    );
    groupRef.current.rotation.z = time * 0.1;
    groupRef.current.rotation.x = Math.sin(time * 0.5) * 0.1;
  });

  return (
    <group ref={groupRef} scale={1.8}>
      {/* Hollow translucent bioluminescent pyrosome tube */}
      <mesh>
        <cylinderGeometry args={[0.5, 0.7, 4.5, 14, 1, true]} />
        <meshPhysicalMaterial
          color="#6ee7b7"
          roughness={0.1}
          transmission={0.8}
          transparent
          opacity={0.7}
          emissive="#10b981"
          emissiveIntensity={1.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight color="#34d399" intensity={1.5} distance={10} />
    </group>
  );
};
