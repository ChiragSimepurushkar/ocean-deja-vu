import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SEAGRASS_CONFIG } from './Config';
import { SEAGRASS_VERTEX, SEAGRASS_FRAGMENT } from './Shaders';

export const SeagrassMeadow: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = SEAGRASS_CONFIG.blades.count;
  const floorY = SEAGRASS_CONFIG.seafloorY;

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  const { instanceParams, matrices } = useMemo(() => {
    const params = new Float32Array(count * 4);
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 35;
      const z = (Math.random() - 0.5) * 35;
      const height = THREE.MathUtils.lerp(
        SEAGRASS_CONFIG.blades.heightMin,
        SEAGRASS_CONFIG.blades.heightMax,
        Math.random()
      );

      dummy.position.set(x, floorY, z);
      dummy.scale.set(0.12, height, 0.12);
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

  useEffect(() => {
    if (!meshRef.current) return;
    matrices.forEach((mat, i) => {
      meshRef.current!.setMatrixAt(i, mat);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <group>
      {/* Sandy muddy seafloor */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100, 16, 16]} />
        <meshStandardMaterial color="#365314" roughness={0.9} />
      </mesh>

      {/* Instanced sway blades */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[0.3, 1.0, 1, 6]} />
        <shaderMaterial
          vertexShader={SEAGRASS_VERTEX}
          fragmentShader={SEAGRASS_FRAGMENT}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
};
