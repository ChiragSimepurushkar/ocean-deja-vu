import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SEAGRASS_CONFIG } from './Config';
import { SEAGRASS_VERTEX, SEAGRASS_FRAGMENT } from './Shaders';
import { depthToY } from '../../core/depthScale';

export const SeagrassMeadow: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pebblesRef = useRef<THREE.InstancedMesh>(null);
  const count = SEAGRASS_CONFIG.blades.count;
  const pebbleCount = 45;
  const floorY = depthToY(25);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  const { instanceParams, matrices } = useMemo(() => {
    const params = new Float32Array(count * 4);
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 45;
      const z = (Math.random() - 0.5) * 45;
      const height = THREE.MathUtils.lerp(
        SEAGRASS_CONFIG.blades.heightMin,
        SEAGRASS_CONFIG.blades.heightMax,
        Math.random()
      );

      dummy.position.set(x, floorY, z);
      dummy.scale.set(0.14, height, 0.14);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      params[i * 4 + 0] = Math.random() * Math.PI * 2; // phase
      params[i * 4 + 1] = 0.35 + Math.random() * 0.45; // amplitude
      params[i * 4 + 2] = 1.2 + Math.random() * 0.8;  // speed
      params[i * 4 + 3] = Math.random() * Math.PI * 2; // direction
    }
    return { instanceParams: params, matrices: mats };
  }, [count, floorY]);

  const pebbleMatrices = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < pebbleCount; i++) {
      const x = (Math.random() - 0.5) * 45;
      const z = (Math.random() - 0.5) * 45;
      const s = 0.15 + Math.random() * 0.25;
      dummy.position.set(x, floorY + s * 0.4, z);
      dummy.scale.set(s, s * 0.6, s * 1.2);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [pebbleCount, floorY]);

  useEffect(() => {
    if (!meshRef.current) return;
    matrices.forEach((mat, i) => meshRef.current!.setMatrixAt(i, mat));
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  useEffect(() => {
    if (!pebblesRef.current) return;
    pebbleMatrices.forEach((mat, i) => pebblesRef.current!.setMatrixAt(i, mat));
    pebblesRef.current.instanceMatrix.needsUpdate = true;
  }, [pebbleMatrices]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <group>
      {/* Sandy muddy seafloor with ripples */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[110, 110, 24, 24]} />
        <meshStandardMaterial color="#1a2e05" roughness={0.9} />
      </mesh>

      {/* Instanced sway blades with per-instance vertex animation */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[0.3, 1.0, 1, 6]} />
        <bufferAttribute attach="geometry-attributes-aInstanceParams" args={[instanceParams, 4]} />
        <shaderMaterial
          vertexShader={SEAGRASS_VERTEX}
          fragmentShader={SEAGRASS_FRAGMENT}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* Instanced shells and pebbles scatter */}
      <instancedMesh ref={pebblesRef} args={[undefined, undefined, pebbleCount]}>
        <dodecahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
      </instancedMesh>
    </group>
  );
};
