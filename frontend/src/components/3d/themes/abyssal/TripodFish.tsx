import React, { useRef } from 'react';
import * as THREE from 'three';
import { ABYSSAL_CONFIG } from './Config';

export const TripodFish: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const floorY = ABYSSAL_CONFIG.seafloorY;

  return (
    <group ref={groupRef} position={[4, floorY, -3]} scale={1.1}>
      {/* Body perched 2m above seafloor facing the gentle abyssal current */}
      <mesh position={[0, 2.0, 0]} rotation={[0, -0.3, 0]} scale={[0.3, 0.25, 1.4]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>
      {/* 2 Pelvic stilts anchored to the sediment */}
      <mesh position={[-0.35, 1.0, 0.4]} rotation={[0.1, 0, 0.15]}>
        <cylinderGeometry args={[0.015, 0.025, 2.1, 4]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh position={[0.35, 1.0, 0.4]} rotation={[0.1, 0, -0.15]}>
        <cylinderGeometry args={[0.015, 0.025, 2.1, 4]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      {/* Caudal stilt */}
      <mesh position={[0, 1.0, -1.2]} rotation={[-0.2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.025, 2.1, 4]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
    </group>
  );
};
