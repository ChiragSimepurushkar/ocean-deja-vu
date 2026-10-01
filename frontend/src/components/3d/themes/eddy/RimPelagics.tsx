import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EDDY_CONFIG } from './Config';

export const EddyRimPelagics: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 40;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rimR = EDDY_CONFIG.vortex.rimRadius;

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + time * 0.35;
      const r = rimR + Math.sin(time + i) * 1.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = -35 + Math.sin(time * 1.2 + i) * 1.5;

      dummy.position.set(x, y, z);
      // Aligned along the circumference tangent
      dummy.rotation.set(0, -angle + Math.PI / 2, Math.sin(time * 3 + i) * 0.1);
      dummy.scale.set(0.3, 0.15, 0.65);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <coneGeometry args={[0.2, 0.9, 4]} />
      <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.8} />
    </instancedMesh>
  );
};
