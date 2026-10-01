import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { THERMOCLINE_CONFIG } from './Config';

export const CombJelly: React.FC = () => {
  const jellyRef = useRef<THREE.Group>(null);
  const seamY = THERMOCLINE_CONFIG.seamY;

  useFrame((state) => {
    if (!jellyRef.current) return;
    const time = state.clock.getElapsedTime();
    jellyRef.current.position.set(
      Math.sin(time * 0.4) * 8,
      seamY + Math.sin(time * 0.6) * 3,
      Math.cos(time * 0.3) * 6
    );
    jellyRef.current.rotation.y = time * 0.2;
    jellyRef.current.rotation.z = Math.sin(time * 1.2) * 0.1;
  });

  return (
    <group ref={jellyRef} scale={1.2}>
      {/* Translucent lobate ellipsoid bell */}
      <mesh scale={[0.8, 1.3, 0.8]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          roughness={0.05}
          transmission={0.88}
          thickness={0.4}
          transparent
          opacity={0.65}
          emissive="#67e8f9"
          emissiveIntensity={0.6}
        />
      </mesh>
      {/* 8 iridescent ciliated comb rows */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.82, 0, Math.sin(angle) * 0.82]}
            scale={[0.04, 1.2, 0.04]}
          >
            <cylinderGeometry args={[1, 1, 1, 4]} />
            <meshBasicMaterial color={i % 2 === 0 ? '#f43f5e' : '#22d3ee'} />
          </mesh>
        );
      })}
    </group>
  );
};
