import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { REEF_CONFIG } from './Config';

export const ReefFauna: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  const damselfishRef = useRef<THREE.InstancedMesh>(null);
  const mantaRef = useRef<THREE.Group>(null);
  const count = 35;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const floorY = REEF_CONFIG.seafloorY;

  const offsets = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 25,
      y: floorY + 1 + Math.random() * 8,
      z: (Math.random() - 0.5) * 25,
      speed: 0.8 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count, floorY]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (damselfishRef.current) {
      offsets.forEach((fish, i) => {
        const t = time * fish.speed + fish.phase;
        dummy.position.set(
          fish.x + Math.sin(t * 1.5) * 0.8,
          fish.y + Math.cos(t * 2.0) * 0.4,
          fish.z + Math.cos(t * 1.2) * 0.8
        );
        dummy.rotation.set(0, t + Math.PI / 2, Math.sin(t * 4) * 0.15);
        dummy.scale.set(0.25, 0.35, 0.45);
        dummy.updateMatrix();
        damselfishRef.current!.setMatrixAt(i, dummy.matrix);
      });
      damselfishRef.current.instanceMatrix.needsUpdate = true;
    }

    if (mantaRef.current) {
      mantaRef.current.position.set(
        Math.sin(time * 0.3) * 18,
        floorY + 7 + Math.sin(time * 0.5) * 1.5,
        Math.cos(time * 0.25) * 12
      );
      mantaRef.current.rotation.y = time * 0.3 + Math.PI / 2;
    }
  });

  return (
    <group>
      {/* Colorful damselfish flitting around coral heads */}
      <instancedMesh ref={damselfishRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.4} />
      </instancedMesh>

      {/* Reef Manta sweeping overhead */}
      <group ref={mantaRef} scale={1.2}>
        <mesh scale={[1.8, 0.2, 1.4]}>
          <coneGeometry args={[1.2, 2.0, 5]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
};
