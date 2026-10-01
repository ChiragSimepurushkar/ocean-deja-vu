import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { SEEP_CONFIG } from './Config';

export const CarbonateMounds: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 35;
  const floorY = SEEP_CONFIG.floorY;

  const matrices = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      const scale = 1.0 + Math.random() * 2.2;
      dummy.position.set(x, floorY + scale * 0.4, z);
      dummy.scale.set(scale, scale * 0.5, scale * 1.2);
      dummy.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, 0);
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
    <group>
      {/* Dark seep sediment floor */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100, 16, 16]} />
        <meshStandardMaterial color="#064e3b" roughness={0.95} />
      </mesh>

      {/* Instanced authigenic carbonate pavements */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </instancedMesh>
    </group>
  );
};
