import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const MoonlitSurface: React.FC = () => {
  const moonRingRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!moonRingRef.current) return;
    const time = state.clock.getElapsedTime();
    moonRingRef.current.rotation.z = time * 0.05;
  });

  return (
    <group position={[0, 2, 0]}>
      {/* Silvery moon pool reflection on water surface */}
      <mesh ref={moonRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4, 18, 32]} />
        <meshBasicMaterial
          color="#bae6fd"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};
