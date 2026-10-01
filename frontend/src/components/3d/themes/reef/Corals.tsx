import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { REEF_CONFIG } from './Config';
import { CAUSTIC_VERTEX, CAUSTIC_FRAGMENT } from './Shaders';

export const ReefCorals: React.FC<{ bleachFactor?: number }> = ({ bleachFactor = 0 }) => {
  const branchingRef = useRef<THREE.InstancedMesh>(null);
  const tableRef = useRef<THREE.InstancedMesh>(null);
  const spongeRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBleach: { value: bleachFactor },
    uBaseColor: { value: new THREE.Color('#f43f5e') },
  }), [bleachFactor]);

  const floorY = REEF_CONFIG.seafloorY;

  // Initialize branching coral instances
  useMemo(() => {
    // Generate scattered cluster positions
  }, []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime();
    uniforms.uBleach.value = bleachFactor;

    if (branchingRef.current && branchingRef.current.count > 0) {
      for (let i = 0; i < REEF_CONFIG.corals.branchingCount; i++) {
        const x = Math.sin(i * 1.7) * 22;
        const z = Math.cos(i * 2.3) * 16;
        dummy.position.set(x, floorY + 1.2, z);
        dummy.rotation.set(0, i * 0.8, Math.sin(i) * 0.1);
        dummy.scale.setScalar(0.8 + (i % 5) * 0.2);
        dummy.updateMatrix();
        branchingRef.current.setMatrixAt(i, dummy.matrix);
      }
      branchingRef.current.instanceMatrix.needsUpdate = true;
    }

    if (tableRef.current && tableRef.current.count > 0) {
      for (let i = 0; i < REEF_CONFIG.corals.tableCount; i++) {
        const x = Math.sin(i * 3.1) * 20;
        const z = Math.cos(i * 1.9) * 14;
        dummy.position.set(x, floorY + 2.5, z);
        dummy.rotation.set(0.1, i * 1.2, 0);
        dummy.scale.set(1.5, 0.2, 1.5);
        dummy.updateMatrix();
        tableRef.current.setMatrixAt(i, dummy.matrix);
      }
      tableRef.current.instanceMatrix.needsUpdate = true;
    }

    if (spongeRef.current && spongeRef.current.count > 0) {
      for (let i = 0; i < REEF_CONFIG.corals.spongeCount; i++) {
        const x = Math.cos(i * 4.3) * 18;
        const z = Math.sin(i * 3.7) * 15;
        dummy.position.set(x, floorY + 1.0, z);
        dummy.rotation.set(0, i * 0.5, 0);
        dummy.scale.set(0.7, 1.2, 0.7);
        dummy.updateMatrix();
        spongeRef.current.setMatrixAt(i, dummy.matrix);
      }
      spongeRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Sandy reef base floor */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120, 32, 32]} />
        <meshStandardMaterial color="#fef08a" roughness={0.9} />
      </mesh>

      {/* Branching Acropora Corals */}
      <instancedMesh
        ref={branchingRef}
        args={[undefined, undefined, REEF_CONFIG.corals.branchingCount]}
      >
        <cylinderGeometry args={[0.08, 0.4, 2.4, 6]} />
        <shaderMaterial
          vertexShader={CAUSTIC_VERTEX}
          fragmentShader={CAUSTIC_FRAGMENT}
          uniforms={uniforms}
        />
      </instancedMesh>

      {/* Table Corals */}
      <instancedMesh
        ref={tableRef}
        args={[undefined, undefined, REEF_CONFIG.corals.tableCount]}
      >
        <cylinderGeometry args={[1.2, 0.3, 0.4, 12]} />
        <meshStandardMaterial
          color={bleachFactor > 0.5 ? '#f5f5f4' : '#14b8a6'}
          roughness={0.6}
        />
      </instancedMesh>

      {/* Giant Barrel Sponges */}
      <instancedMesh
        ref={spongeRef}
        args={[undefined, undefined, REEF_CONFIG.corals.spongeCount]}
      >
        <cylinderGeometry args={[0.6, 0.45, 1.8, 8, 1, true]} />
        <meshStandardMaterial
          color="#ea580c"
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
};
