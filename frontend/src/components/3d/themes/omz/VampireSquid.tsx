import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const VampireSquid: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    // Slow hovering drift conserving metabolic oxygen
    groupRef.current.position.set(
      Math.sin(time * 0.2) * 5,
      -140 + Math.sin(time * 0.3) * 1.2,
      Math.cos(time * 0.15) * 5
    );
    groupRef.current.rotation.y = time * 0.1;
    groupRef.current.rotation.z = Math.sin(time * 0.6) * 0.08;
  });

  return (
    <group ref={groupRef} scale={1.2}>
      {/* Crimson webbed cloak mantle */}
      <mesh scale={[0.9, 1.4, 0.9]}>
        <coneGeometry args={[1, 2, 8, 1, true]} />
        <meshStandardMaterial
          color="#881337"
          roughness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Huge opaque blue orb eyes */}
      <mesh position={[-0.45, 0.2, 0.6]} scale={0.22}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshPhysicalMaterial
          color="#0284c7"
          transmission={0.5}
          roughness={0.1}
          emissive="#0369a1"
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[0.45, 0.2, 0.6]} scale={0.22}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshPhysicalMaterial
          color="#0284c7"
          transmission={0.5}
          roughness={0.1}
          emissive="#0369a1"
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Bioluminescent arm-tip photophores */}
      {[-0.6, 0.6].map((x, i) => (
        <mesh key={i} position={[x, -1.8, 0]} scale={0.08}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      ))}
    </group>
  );
};
