import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const WhaleSilhouette: React.FC = () => {
  const whaleRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!whaleRef.current) return;
    const time = state.clock.getElapsedTime();
    // Slow majestic cruise deep in the fog distance
    whaleRef.current.position.set(
      -45 + Math.sin(time * 0.08) * 35,
      -35 + Math.sin(time * 0.12) * 4,
      -55 + Math.cos(time * 0.06) * 20
    );
    whaleRef.current.rotation.y = time * 0.08 + Math.PI / 2;
  });

  return (
    <group ref={whaleRef} scale={6.5}>
      {/* Massive whale body silhouette */}
      <mesh scale={[1.4, 1.2, 5.5]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshBasicMaterial color="#082f49" transparent opacity={0.65} />
      </mesh>
      {/* Flukes / Tail */}
      <mesh position={[0, 0.4, -5.2]} rotation={[0, 0, 0]} scale={[3.2, 0.2, 1.2]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#082f49" transparent opacity={0.65} />
      </mesh>
    </group>
  );
};
