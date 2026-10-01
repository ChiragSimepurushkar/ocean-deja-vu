import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { SEEP_CONFIG } from './Config';

export const BacterialMats: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 25;
  const floorY = SEEP_CONFIG.floorY;

  const matrices = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 35;
      const z = (Math.random() - 0.5) * 35;
      const radius = 1.2 + Math.random() * 2.5;

      dummy.position.set(x, floorY + 0.05, z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.scale.set(radius, radius, 1);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [count, floorY]);

  useEffect(() => {
    if (!meshRef.current) return;
    matrices.forEach((m, i) => meshRef.current!.setMatrixAt(i, m));
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <circleGeometry args={[1, 16]} />
      <meshStandardMaterial
        color="#fef08a"
        roughness={0.7}
        transparent
        opacity={0.75}
      />
    </instancedMesh>
  );
};
