import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const DeltaicFauna: React.FC = () => {
  const dolphinRef = useRef<THREE.Group>(null);
  const rayRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (dolphinRef.current) {
      dolphinRef.current.position.set(
        Math.sin(time * 0.25) * 16,
        -15 + Math.sin(time * 0.5) * 1.5,
        -12 + Math.cos(time * 0.2) * 10
      );
      dolphinRef.current.rotation.y = time * 0.25 + Math.PI / 2;
    }

    if (rayRef.current) {
      rayRef.current.position.set(
        Math.cos(time * 0.2) * 14,
        -28 + Math.sin(time * 0.4) * 0.8,
        Math.sin(time * 0.2) * 12
      );
      rayRef.current.rotation.y = time * 0.2;
    }
  });

  return (
    <group>
      {/* Irrawaddy / Indo-Pacific Dolphin silhouette */}
      <group ref={dolphinRef} scale={1.2}>
        <mesh scale={[0.6, 0.5, 2.0]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#475569" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.45, -0.2]} rotation={[-0.4, 0, 0]}>
          <coneGeometry args={[0.15, 0.6, 4]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>

      {/* Estuarine Eagle Ray */}
      <group ref={rayRef} scale={1.1}>
        <mesh scale={[1.4, 0.15, 1.2]}>
          <coneGeometry args={[1, 1.8, 4]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};
