/**
 * CarbonateMounds.tsx — Cold Seep Theme (500–2000m)
 *
 * Cold seep ecosystem: methane bubbling from the seafloor.
 * Features:
 * - Carbonate rock mounds (authigenic carbonate)
 * - Methane bubble streams rising from the seafloor (shader)
 * - Brine pool (dense super-salty water sitting in depressions)
 * - Bathymodiolus mussels (instanced dense clusters)
 * - Yeti crabs crawling on carbonate
 * - Tubeworms (Lamellibrachia, slow growing, bushy)
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SEEP_CONFIG } from './Config';
import { createNoise2D } from 'simplex-noise';

// ─── Brine Pool Shader ──────────────────────────────────────────────────────
const BRINE_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    // Slow, dense ripples
    float ripple = sin(pos.x * 3.0 + uTime * 0.5) * cos(pos.z * 2.0 + uTime * 0.4) * 0.1;
    pos.y += ripple;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const BRINE_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x) *
                     smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    vec3 col = vec3(0.1, 0.4, 0.3); // Toxic milky green
    float alpha = 0.65 * edgeFade;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Methane Bubbles Shader ─────────────────────────────────────────────────
const BUBBLE_VERT = `
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  uniform float uTime;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float t = uTime * aSpeed + aPhase;
    // Bubbles rise constantly, wrap around after a certain height
    pos.y += mod(t * 4.0, 25.0);
    // Wobble horizontally
    pos.x += sin(t * 5.0 + aPhase) * 0.3;
    pos.z += cos(t * 4.5 + aPhase) * 0.3;

    vAlpha = 1.0 - smoothstep(15.0, 25.0, mod(t * 4.0, 25.0)); // Fade out at top
    gl_PointSize = aSize * 4.0;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
  }
`;

const BUBBLE_FRAG = `
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float rim = smoothstep(0.7, 1.0, r);
    vec3 col = vec3(0.7, 0.9, 0.9); // Silvery methane bubble
    gl_FragColor = vec4(col, (rim + 0.2) * vAlpha);
  }
`;

// ─── Yeti Crab ──────────────────────────────────────────────────────────────
const YetiCrab: React.FC<{ position: [number, number, number], rotation: number }> = ({ position, rotation }) => {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={0.4}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.6, 0.3, 0.8]} />
        <meshStandardMaterial color="#f0eee9" roughness={0.9} />
      </mesh>
      {/* Hairy claws (simplified as fuzzy cylinders) */}
      <mesh position={[-0.4, 0.2, 0.6]} rotation={[0, 0.5, -0.4]}>
        <cylinderGeometry args={[0.15, 0.1, 1.0]} />
        <meshStandardMaterial color="#e0dac8" roughness={1.0} />
      </mesh>
      <mesh position={[0.4, 0.2, 0.6]} rotation={[0, -0.5, 0.4]}>
        <cylinderGeometry args={[0.15, 0.1, 1.0]} />
        <meshStandardMaterial color="#e0dac8" roughness={1.0} />
      </mesh>
    </group>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────
export const CarbonateMounds: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const musselRef = useRef<THREE.InstancedMesh>(null);
  const bubbleRef = useRef<THREE.Points>(null);

  const floorY = SEEP_CONFIG.floorY;
  const count = 35;
  const musselCount = 200;
  const bubbleCount = 300;

  const brineUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const bubbleUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const matrices = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      const scale = 1.0 + Math.random() * 2.2;
      dummy.position.set(x, floorY + scale * 0.4, z);
      dummy.scale.set(scale, scale * 0.5, scale * 1.2);
      dummy.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, 0);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [count, floorY]);

  const musselMats = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < musselCount; i++) {
      // Cluster near center (around mounds)
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 12;
      dummy.position.set(Math.cos(a) * r, floorY + 0.1, Math.sin(a) * r);
      dummy.scale.setScalar(0.15 + Math.random() * 0.1);
      dummy.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [musselCount, floorY]);

  const { bubbleGeo } = useMemo(() => {
    const pos = new Float32Array(bubbleCount * 3);
    const phases = new Float32Array(bubbleCount);
    const speeds = new Float32Array(bubbleCount);
    const sizes = new Float32Array(bubbleCount);

    for (let i = 0; i < bubbleCount; i++) {
      // Stream from 3 main seep vents
      const vent = i % 3;
      const vx = vent === 0 ? 0 : vent === 1 ? -8 : 10;
      const vz = vent === 0 ? 0 : vent === 1 ? 5 : -4;
      
      pos[i * 3] = vx + (Math.random() - 0.5) * 1.5;
      pos[i * 3 + 1] = floorY;
      pos[i * 3 + 2] = vz + (Math.random() - 0.5) * 1.5;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.5 + Math.random() * 0.5;
      sizes[i] = 0.5 + Math.random() * 1.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return { bubbleGeo: geo };
  }, [bubbleCount, floorY]);

  useEffect(() => {
    if (meshRef.current) {
      matrices.forEach((m, i) => meshRef.current!.setMatrixAt(i, m));
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (musselRef.current) {
      musselMats.forEach((m, i) => musselRef.current!.setMatrixAt(i, m));
      musselRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [matrices, musselMats]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    brineUniforms.uTime.value = time;
    bubbleUniforms.uTime.value = time;
  });

  return (
    <group>
      {/* Dark seep sediment floor */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100, 16, 16]} />
        <meshStandardMaterial color="#061a15" roughness={0.95} />
      </mesh>

      {/* Brine Pool (toxic lake underwater) */}
      <mesh position={[12, floorY + 0.1, -12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 10, 16, 16]} />
        <shaderMaterial 
          vertexShader={BRINE_VERT} 
          fragmentShader={BRINE_FRAG} 
          uniforms={brineUniforms} 
          transparent
        />
      </mesh>

      {/* Instanced authigenic carbonate pavements/mounds */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </instancedMesh>

      {/* Instanced Bathymodiolus mussels */}
      <instancedMesh ref={musselRef} args={[undefined, undefined, musselCount]}>
        <capsuleGeometry args={[0.4, 0.8, 4, 8]} />
        <meshStandardMaterial color="#1f1510" roughness={0.7} />
      </instancedMesh>

      {/* Methane bubbles */}
      <points ref={bubbleRef} geometry={bubbleGeo}>
        <shaderMaterial
          vertexShader={BUBBLE_VERT}
          fragmentShader={BUBBLE_FRAG}
          uniforms={bubbleUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Yeti Crabs */}
      <YetiCrab position={[-4, floorY, 2]} rotation={1.0} />
      <YetiCrab position={[6, floorY, -3]} rotation={2.5} />
      <YetiCrab position={[1, floorY, 5]} rotation={-0.8} />

      {/* Ambient faint greenish bioluminescent glow */}
      <ambientLight color="#021510" intensity={0.5} />
    </group>
  );
};
