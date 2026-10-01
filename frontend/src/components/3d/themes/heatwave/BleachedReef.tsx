import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { HEATWAVE_CONFIG } from './Config';

export const BleachedReef: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 40;
  const floorY = HEATWAVE_CONFIG.floorY;

  const matrices = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 35;
      const z = (Math.random() - 0.5) * 35;
      const scale = 0.8 + Math.random() * 0.8;
      dummy.position.set(x, floorY + scale * 0.8, z);
      dummy.scale.set(scale, scale * 1.4, scale);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
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
      {/* Sunken sandy bleached seabed */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[90, 90, 16, 16]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.9} />
      </mesh>

      {/* Instanced bleached ghostly white Acropora branches */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <cylinderGeometry args={[0.1, 0.45, 2.2, 6]} />
        <meshStandardMaterial color="#f5f5f4" roughness={0.7} />
      </instancedMesh>
    </group>
  );
};
