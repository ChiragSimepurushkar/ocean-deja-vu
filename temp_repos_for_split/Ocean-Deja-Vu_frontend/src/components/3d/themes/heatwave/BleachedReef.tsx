/**
 * BleachedReef.tsx — Marine Heatwave Theme (0–40m)
 *
 * Coral reef devastated by marine heatwave — a deliberately unsettling scene.
 * The colour palette shifts from reef's vibrant to ghostly bleached whites
 * with amber-orange heat tint.
 *
 * Features:
 * - 60 bleached coral skeletons: white/bone branching structures
 *   (same procedural branching geometry as reef, but dead-white)
 * - 10 stress-coloured corals still alive but fading (pink → white gradient)
 * - Dead fish lying on sand (belly-up silhouettes)
 * - Algae overgrowth on dead coral (brownish-green fuzzy patches)
 * - Sandy bleached seabed — warm white with amber shimmer
 * - Heat shimmer distortion: subtle vertex-shader displacement on water
 * - Amber-orange fog and sun lighting
 * - Reduced fish population: only 8 stressed fish (erratic swimming)
 * - Barrel sponge still alive: deep brown-red, sole survivor
 * - Temperature visual: heat haze rising from sand (additive particles)
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HEATWAVE_CONFIG } from './Config';
import { depthToY } from '../../core/depthScale';

// ─── Heat shimmer floor shader ──────────────────────────────────────────────
const FLOOR_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
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

  float caustic(vec2 p, float t) {
    return pow(abs(sin(p.x * 5.0 + t) * cos(p.y * 4.5 + t * 0.8)), 3.0) * 0.3;
  }

  void main() {
    // Bleached white sand with warm amber tint
    vec3 sand   = vec3(0.90, 0.85, 0.76);
    vec3 amber  = vec3(0.95, 0.82, 0.55);

    // Amber heat caustics
    float c = caustic(vUv * 6.0, uTime * 1.5) + caustic(vUv * 5.0 + vec2(1.5, 0.8), uTime * 1.1);
    vec3 col = mix(sand, amber, c * 0.6);

    // Dead algae patches (dark brown-green)
    float algae = smoothstep(0.48, 0.5, sin(vUv.x * 20.0) * sin(vUv.y * 18.0));
    col = mix(col, vec3(0.25, 0.30, 0.15), algae * 0.3);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Bleached coral skeleton shader ─────────────────────────────────────────
const BLEACH_VERT = `
  varying vec3 vNormal;
  varying float vY;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
  }
`;

const BLEACH_FRAG = `
  uniform float uBleachLevel; // 0=alive, 1=fully bleached
  varying vec3 vNormal;
  varying float vY;
  void main() {
    // Alive coral: brown-pink; dead: bone white
    vec3 alive   = vec3(0.55, 0.32, 0.28);
    vec3 stressed = vec3(0.85, 0.55, 0.60); // pink stress
    vec3 dead    = vec3(0.92, 0.90, 0.86);  // bone white

    vec3 col;
    if (uBleachLevel < 0.5) {
      col = mix(alive, stressed, uBleachLevel * 2.0);
    } else {
      col = mix(stressed, dead, (uBleachLevel - 0.5) * 2.0);
    }

    // Rougher lighting on dead
    float diffuse = max(dot(vNormal, vec3(0.3, 0.8, 0.2)), 0.15);
    col *= diffuse * (0.6 + 0.4 * uBleachLevel); // dead is brighter (whiter)

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Heat haze rising particles ─────────────────────────────────────────────
const HAZE_VERT = `
  attribute float aPhase;
  uniform float uTime;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float t = uTime + aPhase;
    float age = mod(t * 0.8, 8.0);
    pos.y += age * 1.5;
    pos.x += sin(t * 2.0 + aPhase) * 0.8;
    pos.z += cos(t * 1.5 + aPhase) * 0.6;

    vAlpha = (1.0 - age / 8.0) * 0.2;
    gl_PointSize = 4.0 + age * 2.0;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
  }
`;

const HAZE_FRAG = `
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float falloff = 1.0 - r * r;
    vec3 col = vec3(1.0, 0.75, 0.35); // amber heat
    gl_FragColor = vec4(col * falloff, vAlpha * falloff);
  }
`;

// ─── Dead fish on sand ──────────────────────────────────────────────────────
const DeadFish: React.FC<{ position: [number, number, number]; rotation: number }> = ({
  position: pos, rotation
}) => (
  <mesh position={pos} rotation={[-0.1, rotation, Math.PI]}>
    <coneGeometry args={[0.12, 0.55, 4]} />
    <meshStandardMaterial color="#b8b0a0" roughness={0.8} />
  </mesh>
);

// ─── Barrel Sponge (sole survivor) ──────────────────────────────────────────
const BarrelSponge: React.FC<{ position: [number, number, number] }> = ({ position: pos }) => (
  <group position={pos}>
    <mesh>
      <cylinderGeometry args={[0.5, 0.7, 1.4, 10, 4, true]} />
      <meshStandardMaterial color="#5c2a1a" roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 0.7, 0]}>
      <torusGeometry args={[0.5, 0.08, 6, 10]} />
      <meshStandardMaterial color="#4a2218" roughness={0.9} />
    </mesh>
  </group>
);

// ─── Main BleachedReef ──────────────────────────────────────────────────────
export const BleachedReef: React.FC = () => {
  const floorY       = HEATWAVE_CONFIG.floorY;
  const coralCount   = 60;
  const stressCount  = 10;
  const hazeCount    = 150;
  const fishCount    = 8;

  const deadCoralRef    = useRef<THREE.InstancedMesh>(null);
  const stressCoralRef  = useRef<THREE.InstancedMesh>(null);
  const hazeRef         = useRef<THREE.Points>(null);
  const stressFishRef   = useRef<THREE.InstancedMesh>(null);
  const dummy           = useMemo(() => new THREE.Object3D(), []);

  const floorUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const deadBleachUniforms  = useMemo(() => ({ uBleachLevel: { value: 1.0 } }), []);
  const stressBleachUniforms = useMemo(() => ({ uBleachLevel: { value: 0.4 } }), []);

  // Dead coral skeletons layout
  const deadMats = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < coralCount; i++) {
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      const s = 0.6 + Math.random() * 1.0;
      dummy.position.set(x, floorY + s * 0.6, z);
      dummy.scale.set(s, s * 1.3, s);
      dummy.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, 0);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [coralCount, floorY, dummy]);

  const stressMats = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < stressCount; i++) {
      const x = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 30;
      const s = 0.5 + Math.random() * 0.6;
      dummy.position.set(x, floorY + s * 0.5, z);
      dummy.scale.set(s, s * 1.1, s);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [stressCount, floorY, dummy]);

  // Heat haze particle field
  const { hazeGeo, hazeUniforms } = useMemo(() => {
    const pos    = new Float32Array(hazeCount * 3);
    const phases = new Float32Array(hazeCount);

    for (let i = 0; i < hazeCount; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = floorY + 0.1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      phases[i]       = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));

    return { hazeGeo: geo, hazeUniforms: { uTime: { value: 0 } } };
  }, [hazeCount, floorY]);

  const hazeMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG,
    uniforms: hazeUniforms, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [hazeUniforms]);

  // Stressed swimming fish
  const fishData = useMemo(() => Array.from({ length: fishCount }, () => ({
    x: (Math.random() - 0.5) * 25,
    y: floorY + 3 + Math.random() * 6,
    z: (Math.random() - 0.5) * 20,
    speed: 2.0 + Math.random() * 1.5,
    phase: Math.random() * Math.PI * 2,
  })), [floorY]);

  useEffect(() => {
    if (deadCoralRef.current) {
      deadMats.forEach((m, i) => deadCoralRef.current!.setMatrixAt(i, m));
      deadCoralRef.current.instanceMatrix.needsUpdate = true;
    }
    if (stressCoralRef.current) {
      stressMats.forEach((m, i) => stressCoralRef.current!.setMatrixAt(i, m));
      stressCoralRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [deadMats, stressMats]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    floorUniforms.uTime.value  = time;
    hazeUniforms.uTime.value   = time;

    // Stressed fish: erratic flight
    if (stressFishRef.current) {
      fishData.forEach((f, i) => {
        const t = time * f.speed + f.phase;
        dummy.position.set(
          f.x + Math.sin(t * 0.6) * 5 + Math.sin(t * 3.5) * 0.6,
          f.y + Math.sin(t * 1.8) * 1.2,
          f.z + Math.cos(t * 0.5) * 4 + Math.cos(t * 2.8) * 0.5
        );
        dummy.rotation.set(0, t * 0.6, Math.sin(t * 4) * 0.15);
        dummy.scale.set(0.2, 0.1, 0.5);
        dummy.updateMatrix();
        stressFishRef.current!.setMatrixAt(i, dummy.matrix);
      });
      stressFishRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="bleached-reef">
      {/* ── Bleached sandy floor with heat caustics ───────────────── */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100, 20, 20]} />
        <shaderMaterial
          vertexShader={FLOOR_VERT}
          fragmentShader={FLOOR_FRAG}
          uniforms={floorUniforms}
        />
      </mesh>

      {/* ── Dead bleached coral skeletons ─────────────────────────── */}
      <instancedMesh ref={deadCoralRef} args={[undefined, undefined, coralCount]}>
        <cylinderGeometry args={[0.08, 0.35, 1.8, 6]} />
        <shaderMaterial
          vertexShader={BLEACH_VERT}
          fragmentShader={BLEACH_FRAG}
          uniforms={deadBleachUniforms}
        />
      </instancedMesh>

      {/* ── Stressed but alive corals (pink fading) ──────────────── */}
      <instancedMesh ref={stressCoralRef} args={[undefined, undefined, stressCount]}>
        <cylinderGeometry args={[0.1, 0.3, 1.5, 6]} />
        <shaderMaterial
          vertexShader={BLEACH_VERT}
          fragmentShader={BLEACH_FRAG}
          uniforms={stressBleachUniforms}
        />
      </instancedMesh>

      {/* ── Dead fish belly-up on sand ────────────────────────────── */}
      <DeadFish position={[-3, floorY + 0.08, 4]} rotation={0.5} />
      <DeadFish position={[5, floorY + 0.08, -3]} rotation={2.1} />
      <DeadFish position={[-8, floorY + 0.08, -6]} rotation={3.8} />
      <DeadFish position={[2, floorY + 0.08, 8]} rotation={1.3} />

      {/* ── Surviving barrel sponge ───────────────────────────────── */}
      <BarrelSponge position={[-6, floorY, -5]} />
      <BarrelSponge position={[8, floorY, 7]} />

      {/* ── Stressed swimming fish (few, erratic) ─────────────────── */}
      <instancedMesh ref={stressFishRef} args={[undefined, undefined, fishCount]}>
        <coneGeometry args={[0.12, 0.5, 4]} />
        <meshStandardMaterial color="#a89080" roughness={0.5} />
      </instancedMesh>

      {/* ── Heat haze particles ──────────────────────────────────── */}
      <points ref={hazeRef} geometry={hazeGeo} material={hazeMat} />

      {/* ── Amber heat lighting ──────────────────────────────────── */}
      <directionalLight position={[5, 20, -5]} color="#fde68a" intensity={2.5} />
      <ambientLight color="#fdba74" intensity={1.0} />
    </group>
  );
};
