import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { ABYSSAL_CONFIG } from './Config';

export const BenthicPlain: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = ABYSSAL_CONFIG.nodules.count;
  const floorY = ABYSSAL_CONFIG.seafloorY;

  const matrices = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 45;
      const z = (Math.random() - 0.5) * 45;
      const scale = 0.3 + Math.random() * 0.5;
      dummy.position.set(x, floorY + scale * 0.4, z);
      dummy.scale.set(scale, scale * 0.6, scale);
      dummy.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, Math.random() * 0.2);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [count, floorY]);

  useEffect(() => {
    if (!meshRef.current) return;
    matrices.forEach((mat, i) => {
      meshRef.current!.setMatrixAt(i, mat);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  return (
    <group>
      {/* Abyssal pelagic red clay sediment bed */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120, 16, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.95} />
      </mesh>

      {/* Instanced black manganese nodules */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <dodecahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color="#030712" roughness={0.9} />
      </instancedMesh>
    </group>
  );
};
