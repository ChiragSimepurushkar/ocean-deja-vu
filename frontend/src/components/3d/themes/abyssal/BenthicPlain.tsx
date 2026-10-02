/**
 * BenthicPlain.tsx — Abyssal Plain Theme (1000–3000m)
 *
 * Vast, flat, soft-sediment seafloor in eternal darkness.
 * The defining visual: falling marine snow catching faint ambient light.
 *
 * Features:
 * - Large flat mud-brown sediment plane with noise-displaced micro-relief
 * - 50 manganese nodules (dark rounded polyhedra scattered on floor)
 * - White glass sponges (Euplectella) — delicate lattice cylinders
 * - Deep-sea anemones with pale tentacles swaying in near-zero current
 * - Brittle stars — multi-arm starfish crawling slowly
 * - Amphipod crustaceans with tiny glowing eyes (instanced)
 * - Sea cucumbers — elongated soft tube bodies
 * - Xenophyophore — giant single-celled organisms (flat disc mounds)
 * - Tracks and trails in sediment (subtle raised lines on floor)
 * - Extremely sparse: "emptiness communicates the environment"
 * - Only flashlight illumination — no ambient, no sun
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ABYSSAL_CONFIG } from './Config';
import { createNoise2D } from 'simplex-noise';

// ─── Sediment floor shader ──────────────────────────────────────────────────
const FLOOR_VERT = `
  uniform float uTime;
  varying vec2  vUv;
  varying vec3  vWorldPos;

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FLOOR_FRAG = `
  uniform float uTime;
  varying vec2  vUv;
  varying vec3  vWorldPos;

  // Simple noise for sediment texture
  float hash2D(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Base: dark mud-brown-grey abyssal clay
    vec3 base = vec3(0.08, 0.07, 0.06);

    // Micro-texture: tiny grains
    float grain = hash2D(floor(vUv * 400.0)) * 0.04;

    // Worm tracks: faint lighter ridges
    float trackX = smoothstep(0.48, 0.5, fract(vUv.x * 25.0 + sin(vUv.y * 15.0) * 0.1));
    float trackZ = smoothstep(0.48, 0.5, fract(vUv.y * 22.0 + cos(vUv.x * 12.0) * 0.08));
    float tracks = max(trackX, trackZ) * 0.04;

    vec3 col = base + grain + tracks;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Glass sponge lattice shader ────────────────────────────────────────────
const SPONGE_VERT = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SPONGE_FRAG = `
  varying vec3 vNormal;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
    vec3 col = vec3(0.88, 0.90, 0.85) * (0.15 + rim * 0.65);
    float alpha = 0.25 + rim * 0.55;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Deep-sea anemone tentacle shader ──────────────────────────────────────
const ANEM_TENT_VERT = `
  uniform float uTime;
  uniform float uPhase;
  varying float vLen;
  void main() {
    vec3 pos = position;
    float len = clamp((pos.y + 0.5), 0.0, 1.0);
    vLen = len;
    // Very slow sway — barely any current at abyssal depth
    pos.x += sin(uTime * 0.4 + uPhase + len * 2.0) * 0.06 * len;
    pos.z += cos(uTime * 0.35 + uPhase + len * 1.5) * 0.04 * len;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const ANEM_TENT_FRAG = `
  varying float vLen;
  void main() {
    vec3 base = vec3(0.75, 0.68, 0.55); // pale cream
    vec3 tip  = vec3(0.90, 0.85, 0.72);
    vec3 col  = mix(base, tip, vLen);
    float alpha = 0.7 - vLen * 0.25;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Glass Sponge (Venus Flower Basket) ─────────────────────────────────────
const GlassSponge: React.FC<{ position: [number, number, number] }> = ({ position: pos }) => {
  return (
    <group position={pos}>
      {/* Lattice body: open cylinder with transparency */}
      <mesh>
        <cylinderGeometry args={[0.3, 0.45, 2.0, 8, 6, true]} />
        <shaderMaterial
          vertexShader={SPONGE_VERT}
          fragmentShader={SPONGE_FRAG}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Mesh cap (sieve plate) */}
      <mesh position={[0, 1.0, 0]}>
        <circleGeometry args={[0.3, 8]} />
        <meshStandardMaterial color="#d4d0c8" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* Base holdfast */}
      <mesh position={[0, -1.1, 0]}>
        <sphereGeometry args={[0.18, 6, 6]} />
        <meshStandardMaterial color="#a8a090" roughness={0.9} />
      </mesh>
    </group>
  );
};

// ─── Deep-sea anemone ───────────────────────────────────────────────────────
const DeepAnemone: React.FC<{ position: [number, number, number] }> = ({ position: pos }) => {
  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uPhase: { value: Math.random() * Math.PI * 2 },
  }), []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <group position={pos}>
      {/* Column */}
      <mesh>
        <cylinderGeometry args={[0.12, 0.2, 0.6, 8]} />
        <meshStandardMaterial color="#4a4540" roughness={0.85} />
      </mesh>
      {/* Tentacle crown (12 tentacles) */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15]} rotation={[0.5, a, 0]}>
            <cylinderGeometry args={[0.015, 0.008, 0.5, 4, 4]} />
            <shaderMaterial
              vertexShader={ANEM_TENT_VERT}
              fragmentShader={ANEM_TENT_FRAG}
              uniforms={uniforms}
              transparent
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ─── Sea Cucumber ───────────────────────────────────────────────────────────
const SeaCucumber: React.FC<{ position: [number, number, number]; rotation?: number }> = ({
  position: pos, rotation = 0
}) => {
  return (
    <group position={pos} rotation={[0, rotation, 0]}>
      <mesh scale={[0.2, 0.14, 0.5]} position={[0, 0.1, 0]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#1a1610" roughness={0.95} />
      </mesh>
      {/* Tube feet dots */}
      {[-0.15, 0, 0.15].map((z, i) => (
        <mesh key={i} position={[0, 0.02, z * 0.6]}>
          <sphereGeometry args={[0.02, 4, 4]} />
          <meshStandardMaterial color="#2a2420" />
        </mesh>
      ))}
    </group>
  );
};

// ─── Brittle Star ───────────────────────────────────────────────────────────
const BrittleStar: React.FC<{ position: [number, number, number] }> = ({ position: pos }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    // Very slow crawl
    ref.current.position.x = pos[0] + Math.sin(t * 0.05) * 0.5;
    ref.current.position.z = pos[2] + Math.cos(t * 0.04) * 0.4;
    ref.current.rotation.y = t * 0.02;
  });

  return (
    <group ref={ref} position={pos}>
      {/* Central disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.12, 8]} />
        <meshStandardMaterial color="#1a180e" roughness={0.9} />
      </mesh>
      {/* 5 sinuous arms */}
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3]} rotation={[-Math.PI / 2, 0, a]}>
            <cylinderGeometry args={[0.018, 0.005, 0.45, 4, 4]} />
            <meshStandardMaterial color="#1a180e" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
};

// ─── Main BenthicPlain ──────────────────────────────────────────────────────
export const BenthicPlain: React.FC = () => {
  const floorY = ABYSSAL_CONFIG.seafloorY;
  const noise2D = useMemo(() => createNoise2D(), []);

  // Manganese nodule instances
  const noduleCount = ABYSSAL_CONFIG.nodules.count;
  const noduleRef   = useRef<THREE.InstancedMesh>(null);
  const amphiRef    = useRef<THREE.InstancedMesh>(null);
  const dummy       = useMemo(() => new THREE.Object3D(), []);

  const noduleMats = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < noduleCount; i++) {
      const x = (Math.random() - 0.5) * 55;
      const z = (Math.random() - 0.5) * 55;
      const s = 0.25 + Math.random() * 0.45;
      dummy.position.set(x, floorY + s * 0.35, z);
      dummy.scale.set(s, s * 0.55, s);
      dummy.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.2);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [noduleCount, floorY, dummy]);

  // Amphipod crustaceans (tiny with glowing eyes)
  const amphiCount = 25;
  const amphiData  = useMemo(() => Array.from({ length: amphiCount }, () => ({
    x: (Math.random() - 0.5) * 40,
    z: (Math.random() - 0.5) * 40,
    speed: 0.3 + Math.random() * 0.3,
    phase: Math.random() * Math.PI * 2,
  })), []);

  // Floor displacement
  const floorGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(120, 120, 48, 48);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = noise2D(x * 0.05, y * 0.05) * 0.4 + noise2D(x * 0.15, y * 0.15) * 0.15;
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, [noise2D]);

  const floorUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useEffect(() => {
    if (!noduleRef.current) return;
    noduleMats.forEach((m, i) => noduleRef.current!.setMatrixAt(i, m));
    noduleRef.current.instanceMatrix.needsUpdate = true;
  }, [noduleMats]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    floorUniforms.uTime.value = time;

    // Amphipod animation
    if (amphiRef.current) {
      amphiData.forEach((a, i) => {
        const t = time * a.speed + a.phase;
        dummy.position.set(
          a.x + Math.sin(t * 0.3) * 1.0,
          floorY + 0.08,
          a.z + Math.cos(t * 0.25) * 0.8
        );
        dummy.scale.setScalar(0.06);
        dummy.rotation.set(0, t * 0.5, 0);
        dummy.updateMatrix();
        amphiRef.current!.setMatrixAt(i, dummy.matrix);
      });
      amphiRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  // Fixed decoration positions
  const spongePositions: [number, number, number][] = useMemo(() => [
    [-6, floorY, 4],
    [8, floorY, -6],
    [-3, floorY, -10],
    [12, floorY, 8],
  ], [floorY]);

  const anemonePositions: [number, number, number][] = useMemo(() => [
    [-10, floorY, 2],
    [5, floorY, 9],
    [-4, floorY, -14],
    [14, floorY, -3],
    [-8, floorY, -8],
  ], [floorY]);

  return (
    <group name="benthic-plain">
      {/* ── Abyssal sediment floor with micro-texture ────────────── */}
      <mesh geometry={floorGeo} position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shaderMaterial
          vertexShader={FLOOR_VERT}
          fragmentShader={FLOOR_FRAG}
          uniforms={floorUniforms}
        />
      </mesh>

      {/* ── Manganese nodules ────────────────────────────────────── */}
      <instancedMesh ref={noduleRef} args={[undefined, undefined, noduleCount]}>
        <dodecahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color="#050810" roughness={0.92} metalness={0.15} />
      </instancedMesh>

      {/* ── Glass sponges ────────────────────────────────────────── */}
      {spongePositions.map((p, i) => <GlassSponge key={`sp${i}`} position={p} />)}

      {/* ── Deep-sea anemones ────────────────────────────────────── */}
      {anemonePositions.map((p, i) => <DeepAnemone key={`an${i}`} position={p} />)}

      {/* ── Sea cucumbers ────────────────────────────────────────── */}
      <SeaCucumber position={[-2, floorY + 0.05, 5]} rotation={0.3} />
      <SeaCucumber position={[7, floorY + 0.05, -4]} rotation={1.8} />
      <SeaCucumber position={[-9, floorY + 0.05, -7]} rotation={2.5} />

      {/* ── Brittle stars ────────────────────────────────────────── */}
      <BrittleStar position={[3, floorY + 0.03, 2]} />
      <BrittleStar position={[-5, floorY + 0.03, -6]} />
      <BrittleStar position={[11, floorY + 0.03, 5]} />

      {/* ── Amphipod crustaceans ─────────────────────────────────── */}
      <instancedMesh ref={amphiRef} args={[undefined, undefined, amphiCount]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshStandardMaterial color="#1a1208" emissive="#003344" emissiveIntensity={0.6} roughness={0.8} />
      </instancedMesh>

      {/* ── Xenophyophore giant cell mounds ──────────────────────── */}
      {[[-12, 10], [10, -12], [-7, -15]].map(([x, z], i) => (
        <mesh key={`xeno${i}`} position={[x, floorY + 0.06, z]} rotation={[-Math.PI / 2, 0, i * 1.2]}>
          <circleGeometry args={[0.8 + Math.random() * 0.4, 10]} />
          <meshStandardMaterial color="#12100a" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
};
