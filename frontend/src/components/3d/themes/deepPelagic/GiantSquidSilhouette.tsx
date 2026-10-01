import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const GiantSquidSilhouette: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    // Massive stealthy transit through edge of beam
    groupRef.current.position.set(
      -25 + Math.sin(time * 0.12) * 20,
      -175 + Math.cos(time * 0.15) * 3,
      -22 + Math.sin(time * 0.1) * 8
    );
    groupRef.current.rotation.y = time * 0.12;
  });

  return (
    <group ref={groupRef} scale={4.5}>
      {/* Torpedo mantle */}
      <mesh scale={[0.8, 2.2, 0.8]}>
        <coneGeometry args={[1, 3, 10]} />
        <meshBasicMaterial color="#030712" />
      </mesh>
      {/* Dinner-plate eye with glowing iris */}
      <mesh position={[0.7, 0.2, 0.5]} scale={0.25}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      {/* Massive trailing feeding tentacles */}
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={i} position={[x, -3.5, 0]}>
          <cylinderGeometry args={[0.04, 0.08, 6.0, 4]} />
          <meshBasicMaterial color="#030712" />
        </mesh>
      ))}
    </group>
  );
};
