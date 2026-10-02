import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ABYSSAL_CONFIG } from './Config';

export const AbyssalAnglerfish: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const floorY = ABYSSAL_CONFIG.seafloorY;

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    groupRef.current.position.set(
      Math.cos(time * 0.3) * 6,
      floorY + 4 + Math.sin(time * 0.4) * 0.8,
      Math.sin(time * 0.25) * 4
    );
    groupRef.current.rotation.y = time * 0.15;
    if (lightRef.current) {
      lightRef.current.intensity = 2.0 + Math.sin(time * 8.0) * 1.0;
    }
  });

  return (
    <group ref={groupRef} scale={1.3}>
      {/* Bulbous body */}
      <mesh scale={[1.1, 0.9, 1.3]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#050811" roughness={0.9} />
      </mesh>
      {/* Lower jaw jutting forward */}
      <mesh position={[0, -0.4, 0.6]} rotation={[0.25, 0, 0]} scale={[0.9, 0.3, 1.0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#03050a" />
      </mesh>
      {/* Needle teeth */}
      {[-0.3, -0.1, 0.1, 0.3].map((x, i) => (
        <mesh key={i} position={[x, -0.15, 1.0]} rotation={[-0.25, 0, 0]}>
          <coneGeometry args={[0.035, 0.28, 3]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
      ))}
      {/* Illicium lure stalk */}
      <mesh position={[0, 0.9, 0.6]} rotation={[-0.7, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.045, 1.2, 5]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* Glowing esca bulb with real point light */}
      <mesh position={[0, 1.45, 1.1]} scale={0.16}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color="#22d3ee" />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[0, 1.45, 1.1]}
        color="#22d3ee"
        intensity={2.2}
        distance={9}
      />
    </group>
  );
};
