import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BENGAL_PLUME_CONFIG } from './Config';

export const HaloclineInterface: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    // Undulating internal salinity boundary
    meshRef.current.position.y = BENGAL_PLUME_CONFIG.haloclineY + Math.sin(time * 0.8) * 0.4;
  });

  return (
    <group>
      {/* Semi-transparent undulating halocline density sheet */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[90, 90, 24, 24]} />
        <meshBasicMaterial
          color="#0d9488"
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};
