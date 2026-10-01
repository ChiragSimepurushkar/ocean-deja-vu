import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const SunlitFlora: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  const count = 35;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const instances = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 40,
      y: -2 - Math.random() * 8, // drifting near surface
      z: (Math.random() - 0.5) * 25,
      scale: 0.6 + Math.random() * 0.7,
      speed: 0.4 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    instances.forEach((inst, i) => {
      const bob = Math.sin(time * inst.speed + inst.phase) * 0.4;
      dummy.position.set(
        inst.x + Math.sin(time * 0.3 + inst.phase) * 1.5,
        inst.y + bob,
        inst.z + Math.cos(time * 0.25 + inst.phase) * 1.2
      );
      dummy.rotation.set(
        Math.sin(time * 0.5 + inst.phase) * 0.2,
        time * 0.2 + inst.phase,
        Math.cos(time * 0.4 + inst.phase) * 0.15
      );
      dummy.scale.setScalar(inst.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[0.35, 1]} />
      <meshStandardMaterial
        color="#84cc16"
        roughness={0.7}
        metalness={0.1}
      />
    </instancedMesh>
  );
};
