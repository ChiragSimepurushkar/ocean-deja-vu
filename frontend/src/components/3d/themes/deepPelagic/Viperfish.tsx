import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const DeepViperfish: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    groupRef.current.position.set(
      Math.sin(time * 0.2) * 12,
      -165 + Math.cos(time * 0.25) * 1.5,
      Math.cos(time * 0.16) * 7
    );
    groupRef.current.rotation.y = time * 0.2 + Math.PI / 2;
  });

  return (
    <group ref={groupRef} scale={1.2}>
      {/* Elongated slender body */}
      <mesh scale={[0.4, 0.45, 2.4]}>
        <sphereGeometry args={[0.6, 8, 8]} />
        <meshStandardMaterial color="#090d16" roughness={0.8} />
      </mesh>
      {/* Saber fangs protruding */}
      {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
        <mesh key={i} position={[x, -0.22, 1.3]} rotation={[0.45, 0, 0]}>
          <coneGeometry args={[0.02, 0.4, 3]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
      ))}
      {/* Ventral photophore row */}
      {[-0.7, -0.3, 0.1, 0.5].map((z, i) => (
        <mesh key={i} position={[0, -0.28, z]} scale={0.05}>
          <sphereGeometry args={[1, 4, 4]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      ))}
    </group>
  );
};
