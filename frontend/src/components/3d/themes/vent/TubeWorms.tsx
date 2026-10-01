import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { VENT_CONFIG } from './Config';

export const TubeWorms: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 75;
  const floorY = VENT_CONFIG.floorY;

  const matrices = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 2.2 + Math.random() * 3.5;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const h = 1.2 + Math.random() * 1.8;

      dummy.position.set(x, floorY + h * 0.5, z);
      // Slight outward tilt away from chimney
      dummy.rotation.set(
        (Math.sin(angle) * 0.25),
        angle,
        (-Math.cos(angle) * 0.25)
      );
      dummy.scale.set(0.08, h, 0.08);
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
      {/* White chitinous worm tubes */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </instancedMesh>
    </group>
  );
};
