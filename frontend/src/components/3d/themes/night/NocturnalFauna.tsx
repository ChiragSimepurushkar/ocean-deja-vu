import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const NocturnalFauna: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 30;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const offsets = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 20,
      y: -10 + (Math.random() - 0.5) * 12,
      z: -8 + (Math.random() - 0.5) * 10,
      speed: 0.9 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();

    offsets.forEach((f, i) => {
      const t = time * f.speed + f.phase;
      dummy.position.set(
        f.x + Math.sin(t * 0.5) * 1.5,
        f.y + Math.cos(t * 0.7) * 0.6,
        f.z + Math.cos(t * 0.4) * 1.5
      );
      dummy.rotation.set(0, t * 0.3, Math.sin(t * 2) * 0.08);
      dummy.scale.set(0.35, 0.15, 0.75);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <coneGeometry args={[0.2, 0.9, 4]} />
      {/* Jet black unlit silhouette against moonlit water */}
      <meshBasicMaterial color="#020617" />
    </instancedMesh>
  );
};
