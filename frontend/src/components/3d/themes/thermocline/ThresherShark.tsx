import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { THERMOCLINE_CONFIG } from './Config';

export const ThermoclineThresherShark: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const seamY = THERMOCLINE_CONFIG.seamY;

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    groupRef.current.position.set(
      Math.sin(time * 0.2) * 18,
      seamY - 5 + Math.sin(time * 0.3) * 2,
      Math.cos(time * 0.16) * 12
    );
    groupRef.current.rotation.y = time * 0.2 + Math.PI / 2;
    groupRef.current.rotation.z = Math.sin(time * 0.8) * 0.08;
  });

  return (
    <group ref={groupRef} scale={1.5}>
      {/* Torpedo body */}
      <mesh scale={[0.65, 0.55, 2.2]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </mesh>
      {/* Huge bigeye adaptation for twilight pycnocline */}
      <mesh position={[-0.4, 0.25, 1.4]} scale={0.22}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      <mesh position={[0.4, 0.25, 1.4]} scale={0.22}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      {/* Long whip-like scythe caudal tail */}
      <mesh position={[0, 1.1, -2.4]} rotation={[-0.45, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.12, 3.2, 5]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
};
