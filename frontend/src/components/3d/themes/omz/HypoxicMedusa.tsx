import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const HypoxicMedusa: React.FC = () => {
  const medusaRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!medusaRef.current) return;
    const time = state.clock.getElapsedTime();
    medusaRef.current.position.set(
      Math.cos(time * 0.15) * 8,
      -155 + Math.sin(time * 0.4) * 2,
      Math.sin(time * 0.2) * 6
    );
    medusaRef.current.rotation.y = time * 0.1;
  });

  return (
    <group ref={medusaRef} scale={1.4}>
      {/* Dark scarlet red crown bell */}
      <mesh scale={[1.2, 0.5, 1.2]}>
        <sphereGeometry args={[1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#4c0519" roughness={0.5} />
      </mesh>
      {/* Hypertrophied trailing tentacle */}
      <mesh position={[0, -2.2, 0]}>
        <cylinderGeometry args={[0.02, 0.04, 4.4, 4]} />
        <meshBasicMaterial color="#be123c" transparent opacity={0.7} />
      </mesh>
    </group>
  );
};
