import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const StormFoamSurface: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    // Violent horizontal and vertical storm wave surges
    meshRef.current.position.y = 1.8 + Math.sin(time * 3.5) * 0.8;
  });

  return (
    <group>
      {/* Heavy churning foam sheet on the surface */}
      <mesh ref={meshRef} position={[0, 1.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120, 32, 32]} />
        <meshStandardMaterial
          color="#f1f5f9"
          roughness={0.9}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
