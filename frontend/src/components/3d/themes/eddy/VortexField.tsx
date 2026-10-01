import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const EddyVortexField: React.FC = () => {
  const funnelRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!funnelRef.current) return;
    const time = state.clock.getElapsedTime();
    funnelRef.current.rotation.y = time * 0.4;
  });

  return (
    <group position={[0, -40, 0]}>
      {/* Translucent vortex funnel indicator */}
      <mesh ref={funnelRef}>
        <cylinderGeometry args={[18, 5, 60, 20, 1, true]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};
