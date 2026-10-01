import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const FilterFeedingWhaleShark: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    // Gentle cruising through dense plankton soup
    groupRef.current.position.set(
      Math.sin(time * 0.15) * 20,
      -25 + Math.sin(time * 0.2) * 2.5,
      -15 + Math.cos(time * 0.12) * 10
    );
    groupRef.current.rotation.y = time * 0.15 + Math.PI / 2;
    groupRef.current.rotation.z = Math.sin(time * 0.8) * 0.05;
  });

  return (
    <group ref={groupRef} scale={3.5}>
      {/* Flattened wide head & spindle body */}
      <mesh scale={[1.2, 0.7, 3.8]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>
      {/* Broad transverse filter-feeding mouth */}
      <mesh position={[0, -0.1, 3.7]} scale={[1.1, 0.4, 0.3]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* White spotted skin dots */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0.7, 0.5]} scale={0.12}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      ))}
      {/* Large dorsal fin */}
      <mesh position={[0, 1.1, -0.4]} rotation={[-0.4, 0, 0]}>
        <coneGeometry args={[0.25, 1.4, 4]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
};
