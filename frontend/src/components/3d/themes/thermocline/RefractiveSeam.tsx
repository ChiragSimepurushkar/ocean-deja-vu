import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { THERMOCLINE_CONFIG } from './Config';

export const RefractiveSeam: React.FC = () => {
  const seamRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!seamRef.current) return;
    const time = state.clock.getElapsedTime();
    seamRef.current.position.y = THERMOCLINE_CONFIG.seamY + Math.sin(time * 0.7) * 0.8;
  });

  return (
    <group>
      {/* Refractive haze layer at thermocline depth */}
      <mesh ref={seamRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[110, 110, 24, 24]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};
