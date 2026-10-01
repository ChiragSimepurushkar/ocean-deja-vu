import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const PlanktonBaitBall: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 120;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const fishOffsets = useMemo(() => {
    return Array.from({ length: count }, () => {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 4.5;
      return {
        radius: r,
        theta,
        phi,
        speed: 1.5 + Math.random() * 1.0,
      };
    });
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const centerX = 0;
    const centerY = -18;
    const centerZ = -8;

    fishOffsets.forEach((f, i) => {
      const angle = f.theta + time * f.speed * 0.8;
      const x = centerX + f.radius * Math.sin(f.phi) * Math.cos(angle);
      const y = centerY + f.radius * Math.cos(f.phi) + Math.sin(time * 2 + i) * 0.3;
      const z = centerZ + f.radius * Math.sin(f.phi) * Math.sin(angle);

      dummy.position.set(x, y, z);
      // Tangential velocity heading
      dummy.rotation.set(0, -angle + Math.PI / 2, Math.sin(time * 5 + i) * 0.2);
      dummy.scale.set(0.18, 0.1, 0.45);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <coneGeometry args={[0.2, 0.8, 4]} />
      <meshStandardMaterial
        color="#a7f3d0"
        roughness={0.2}
        metalness={0.9}
      />
    </instancedMesh>
  );
};
