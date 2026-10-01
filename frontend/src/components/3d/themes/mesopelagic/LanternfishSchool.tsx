import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const LanternfishSchool: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 45;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const offsets = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 14,
      y: (Math.random() - 0.5) * 6,
      z: (Math.random() - 0.5) * 10,
      speed: 1.1 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();

    offsets.forEach((f, i) => {
      const t = time * f.speed + f.phase;
      dummy.position.set(
        f.x + Math.sin(t * 0.7) * 1.2,
        -135 + f.y + Math.cos(t * 0.9) * 0.4,
        f.z + Math.cos(t * 0.6) * 1.0
      );
      dummy.rotation.set(0, t * 0.5, Math.sin(t * 2) * 0.1);
      dummy.scale.set(0.18, 0.1, 0.45);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.3, 8, 8]} />
      <meshStandardMaterial
        color="#0284c7"
        emissive="#38bdf8"
        emissiveIntensity={0.8}
        roughness={0.2}
      />
    </instancedMesh>
  );
};
