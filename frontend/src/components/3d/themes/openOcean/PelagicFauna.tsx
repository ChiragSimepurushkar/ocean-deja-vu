import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const PelagicFauna: React.FC<{ currentDepth: number }> = () => {
  const schoolRef = useRef<THREE.InstancedMesh>(null);
  const sharkRef = useRef<THREE.Group>(null);
  const count = 50;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const boidOffsets = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 14,
      y: (Math.random() - 0.5) * 6,
      z: (Math.random() - 0.5) * 12,
      speed: 1.4 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Fast-swimming tuna school
    if (schoolRef.current) {
      const leaderX = Math.sin(time * 0.5) * 22;
      const leaderZ = Math.cos(time * 0.4) * 16;
      boidOffsets.forEach((b, i) => {
        const t = time * b.speed + b.phase;
        dummy.position.set(
          leaderX + b.x + Math.sin(t) * 1.5,
          -30 + b.y + Math.sin(t * 1.8) * 0.6,
          leaderZ + b.z + Math.cos(t) * 1.5
        );
        dummy.rotation.set(0, Math.sin(time * 0.5) > 0 ? 0 : Math.PI, Math.sin(t * 3) * 0.12);
        dummy.scale.set(0.4, 0.2, 0.9);
        dummy.updateMatrix();
        schoolRef.current!.setMatrixAt(i, dummy.matrix);
      });
      schoolRef.current.instanceMatrix.needsUpdate = true;
    }

    // Cruising oceanic whitetip shark
    if (sharkRef.current) {
      sharkRef.current.position.set(
        Math.cos(time * 0.25) * 20,
        -42 + Math.sin(time * 0.3) * 2,
        Math.sin(time * 0.2) * 15
      );
      sharkRef.current.rotation.y = time * 0.25 + Math.PI;
    }
  });

  return (
    <group>
      <instancedMesh ref={schoolRef} args={[undefined, undefined, count]}>
        <coneGeometry args={[0.25, 1.2, 5]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.3} metalness={0.7} />
      </instancedMesh>

      {/* Pelagic Shark */}
      <group ref={sharkRef} scale={1.3}>
        <mesh scale={[0.8, 0.6, 2.8]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#334155" roughness={0.5} />
        </mesh>
        {/* Dorsal fin */}
        <mesh position={[0, 0.9, 0.2]} rotation={[-0.3, 0, 0]}>
          <coneGeometry args={[0.18, 1.1, 4]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </group>
    </group>
  );
};
