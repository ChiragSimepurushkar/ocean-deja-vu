import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SEAGRASS_CONFIG } from './Config';

export const SeagrassFauna: React.FC = () => {
  const starfishRef = useRef<THREE.InstancedMesh>(null);
  const crabRef = useRef<THREE.Group>(null);
  const count = 18;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const floorY = SEAGRASS_CONFIG.seafloorY;

  useMemo(() => {
    //
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (starfishRef.current) {
      for (let i = 0; i < count; i++) {
        const x = Math.sin(i * 1.5) * 14;
        const z = Math.cos(i * 1.8) * 14;
        dummy.position.set(x, floorY + 0.1, z);
        dummy.rotation.set(-Math.PI / 2, 0, i * 0.7);
        dummy.scale.setScalar(0.4 + (i % 3) * 0.15);
        dummy.updateMatrix();
        starfishRef.current.setMatrixAt(i, dummy.matrix);
      }
      starfishRef.current.instanceMatrix.needsUpdate = true;
    }

    if (crabRef.current) {
      // Scuttling crab sideways along the floor
      const walk = Math.sin(time * 1.2) * 6;
      crabRef.current.position.set(walk, floorY + 0.2, 4 + Math.cos(time * 0.6) * 3);
      crabRef.current.rotation.y = time * 0.5;
    }
  });

  return (
    <group>
      {/* 5-arm Starfish on the floor */}
      <instancedMesh ref={starfishRef} args={[undefined, undefined, count]}>
        <cylinderGeometry args={[0.4, 0.4, 0.08, 5]} />
        <meshStandardMaterial color="#f97316" roughness={0.8} />
      </instancedMesh>

      {/* Scuttling benthic crab */}
      <group ref={crabRef} scale={0.5}>
        <mesh scale={[1.2, 0.4, 0.8]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#dc2626" roughness={0.6} />
        </mesh>
        {/* Claws */}
        <mesh position={[-0.8, 0.1, 0.4]} rotation={[0, 0.4, 0]}>
          <sphereGeometry args={[0.25, 6, 6]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0.8, 0.1, 0.4]} rotation={[0, -0.4, 0]}>
          <sphereGeometry args={[0.25, 6, 6]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>
    </group>
  );
};
