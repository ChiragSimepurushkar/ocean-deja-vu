import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TRENCH_CONFIG } from './Config';

export const HadalFauna: React.FC = () => {
  const snailfishRef = useRef<THREE.Group>(null);
  const amphipodsRef = useRef<THREE.InstancedMesh>(null);
  const count = 30;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const floorY = TRENCH_CONFIG.floorY;

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Translucent ghostly snailfish swimming sluggishly
    if (snailfishRef.current) {
      snailfishRef.current.position.set(
        Math.sin(time * 0.25) * 8,
        floorY + 6 + Math.sin(time * 0.3) * 1.5,
        Math.cos(time * 0.2) * 10
      );
      snailfishRef.current.rotation.y = time * 0.25 + Math.PI / 2;
    }

    // Scavenging amphipods crawling and hovering near floor
    if (amphipodsRef.current) {
      for (let i = 0; i < count; i++) {
        const t = time * 1.5 + i;
        dummy.position.set(
          Math.sin(i * 1.2) * 10 + Math.sin(t) * 0.4,
          floorY + 0.3 + (i % 4 === 0 ? Math.sin(t * 1.5) * 0.8 : 0),
          Math.cos(i * 1.4) * 14
        );
        dummy.rotation.set(0, i, 0);
        dummy.scale.set(0.15, 0.08, 0.25);
        dummy.updateMatrix();
        amphipodsRef.current.setMatrixAt(i, dummy.matrix);
      }
      amphipodsRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Ghostly Hadal Snailfish */}
      <group ref={snailfishRef} scale={1.2}>
        <mesh scale={[0.5, 0.4, 1.8]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshPhysicalMaterial
            color="#f1f5f9"
            roughness={0.1}
            transmission={0.82}
            thickness={0.5}
            transparent
            opacity={0.65}
          />
        </mesh>
      </group>

      {/* Giant scavenging amphipods */}
      <instancedMesh ref={amphipodsRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f87171" roughness={0.6} />
      </instancedMesh>
    </group>
  );
};
