import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const SunlitFauna: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  const schoolCount = 45;
  const schoolRef = useRef<THREE.InstancedMesh>(null);
  const turtleRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const fishOffsets = useMemo(() => {
    return Array.from({ length: schoolCount }, () => ({
      x: (Math.random() - 0.5) * 12,
      y: -6 + (Math.random() - 0.5) * 5,
      z: -10 + (Math.random() - 0.5) * 8,
      speed: 1.2 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [schoolCount]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Schooling fish animation
    if (schoolRef.current) {
      const leaderX = Math.sin(time * 0.4) * 15;
      const leaderZ = -12 + Math.cos(time * 0.3) * 6;

      fishOffsets.forEach((f, i) => {
        const t = time * f.speed + f.phase;
        dummy.position.set(
          leaderX + f.x + Math.sin(t) * 1.2,
          f.y + Math.sin(t * 1.5) * 0.4,
          leaderZ + f.z + Math.cos(t) * 1.2
        );
        dummy.rotation.set(0, Math.sin(time * 0.4) > 0 ? 0 : Math.PI, Math.sin(t * 3) * 0.1);
        dummy.scale.set(0.35, 0.15, 0.6);
        dummy.updateMatrix();
        schoolRef.current!.setMatrixAt(i, dummy.matrix);
      });
      schoolRef.current.instanceMatrix.needsUpdate = true;
    }

    // Gentle cruising turtle
    if (turtleRef.current) {
      turtleRef.current.position.set(
        Math.sin(time * 0.2) * 16 - 5,
        -14 + Math.sin(time * 0.3) * 1.5,
        -8 + Math.cos(time * 0.18) * 8
      );
      turtleRef.current.rotation.y = time * 0.2 + Math.PI / 2;
    }
  });

  return (
    <group>
      {/* Schooling epipelagic fish */}
      <instancedMesh ref={schoolRef} args={[undefined, undefined, schoolCount]}>
        <coneGeometry args={[0.2, 0.8, 4]} />
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.2}
          metalness={0.8}
        />
      </instancedMesh>

      {/* Cruising Sea Turtle */}
      <group ref={turtleRef}>
        <mesh scale={[1.2, 0.35, 1.5]}>
          <sphereGeometry args={[0.8, 12, 10]} />
          <meshStandardMaterial color="#065f46" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.05, 0.95]}>
          <sphereGeometry args={[0.25, 8, 8]} />
          <meshStandardMaterial color="#047857" />
        </mesh>
      </group>
    </group>
  );
};
