import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const MesopelagicGlassSquid: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    groupRef.current.position.set(
      Math.sin(time * 0.4) * 8,
      -145 + Math.cos(time * 0.6) * 2,
      Math.sin(time * 0.35) * 6
    );
    groupRef.current.rotation.y = time * 0.28;
  });

  return (
    <group ref={groupRef} scale={1.2}>
      {/* Transparent mantle */}
      <mesh scale={[0.65, 1.6, 0.65]}>
        <sphereGeometry args={[0.6, 12, 12]} />
        <meshPhysicalMaterial
          color="#bae6fd"
          roughness={0.05}
          transmission={0.92}
          thickness={0.3}
          transparent
          opacity={0.5}
          emissive="#60a5fa"
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Photophore eyes */}
      <mesh position={[-0.26, -0.2, 0.5]} scale={0.1}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>
      <mesh position={[0.26, -0.2, 0.5]} scale={0.1}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>
    </group>
  );
};
