import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const UpwellingFauna: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 40;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const fishOffsets = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 16,
      y: (Math.random() - 0.5) * 8,
      z: (Math.random() - 0.5) * 14,
      speed: 1.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();

    fishOffsets.forEach((f, i) => {
      const t = time * f.speed + f.phase;
      // Fish angled slightly downward swimming against the upward current
      dummy.position.set(
        f.x + Math.sin(t * 0.8) * 1.5,
        -25 + f.y + Math.cos(t * 1.2) * 0.8,
        f.z + Math.cos(t * 0.7) * 1.2
      );
      dummy.rotation.set(-0.25, t * 0.5, Math.sin(t * 3) * 0.1);
      dummy.scale.set(0.35, 0.15, 0.7);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <coneGeometry args={[0.22, 1.0, 4]} />
      <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.8} />
    </instancedMesh>
  );
};
