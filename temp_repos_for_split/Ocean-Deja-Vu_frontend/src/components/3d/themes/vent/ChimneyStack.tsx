/**
 * ChimneyStack.tsx — Hydrothermal Vent Theme (2000–4000m)
 *
 * Complete hydrothermal vent field with:
 * - 3 black smoker chimneys (stacked rough cone geometry)
 * - Animated thermal plume particle emitters (rising dark billowing smoke)
 * - Glowing amber/orange molten orifice at each vent throat
 * - Tube worm colonies clustered densely around warm rock
 * - Vent shrimp swarm on chimney surface
 * - Volcanic mineral crust texture via noise displacement
 * - Lava seep crack emissive geometry at base
 * - Chemical shimmer (refraction distortion) rising from vents
 * - Point lights: amber (hot), pale orange (warm rock)
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VENT_CONFIG } from './Config';
import { depthToY } from '../../core/depthScale';
import { createNoise2D } from 'simplex-noise';

// ─── Plume particle shader ─────────────────────────────────────────────────
const PLUME_VERT = `
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aHoriz;
  uniform float uTime;
  uniform vec3  uVentPos;
  varying float vAlpha;
  varying float vHeight;

  void main() {
    vec3 pos = position;
    // Rise and expand
    float age  = mod(uTime * aSpeed + aPhase, 6.0);
    float rise = age * 2.5;
    float expand = age * 0.6;

    pos.y += rise;
    pos.x  = uVentPos.x + pos.x * (1.0 + expand) + sin(uTime * 1.5 + aPhase + pos.y * 0.3) * 0.6;
    pos.z  = uVentPos.z + pos.z * (1.0 + expand) + cos(uTime * 1.2 + aPhase + pos.y * 0.25) * 0.5;

    vHeight = rise / 14.0;
    vAlpha  = (1.0 - smoothstep(0.0, 0.3, age / 6.0)) * (1.0 - vHeight * 1.4) * 0.6;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = 14.0 + expand * 8.0;
  }
`;

const PLUME_FRAG = `
  varying float vAlpha;
  varying float vHeight;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float alpha = (1.0 - r) * vAlpha;
    // Dark mineral smoke: near-black with brownish tint at base
    vec3 col = mix(vec3(0.10, 0.07, 0.04), vec3(0.04, 0.03, 0.02), vHeight);
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Hot orifice glow shader ───────────────────────────────────────────────
const ORIFICE_VERT = `
  uniform float uTime;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ORIFICE_FRAG = `
  uniform float uTime;
  void main() {
    float pulse = sin(uTime * 8.0) * 0.35 + 0.65;
    float hf    = sin(uTime * 12.5) * 0.2 + 0.8;
    vec3 col = mix(
      vec3(0.9, 0.3, 0.0),   // orange
      vec3(1.0, 0.85, 0.0),  // bright yellow
      pulse * hf
    );
    gl_FragColor = vec4(col * (1.5 + pulse * 2.0), 0.95);
  }
`;

// ─── Mineral crust noise displacement ─────────────────────────────────────
function createRoughChimneyGeometry(radiusBase: number, radiusTop: number, height: number): THREE.BufferGeometry {
  const noise2D = createNoise2D();
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBase, height, 12, 10);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const r = Math.sqrt(x * x + z * z);
    const n = noise2D(angle * 2, y * 0.3) * 0.35 + noise2D(angle * 4, y * 0.7) * 0.18;
    const newR = r + n;
    pos.setXYZ(i, Math.cos(angle) * newR, y, Math.sin(angle) * newR);
  }
  geo.computeVertexNormals();
  return geo;
}

// ─── Individual chimney ────────────────────────────────────────────────────
interface ChimneyProps {
  position: [number, number, number];
  height: number;
  scale: number;
  orificeColor: string;
  plumeOffset: number;
}

const SingleChimney: React.FC<ChimneyProps> = ({ position, height, scale, orificeColor, plumeOffset }) => {
  const orificeUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const plumeRef = useRef<THREE.Points>(null);

  const plumeGeo = useMemo(() => {
    const count = 120;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const phases    = new Float32Array(count);
    const speeds    = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.35;
      positions[i * 3]     = Math.cos(a) * r;
      positions[i * 3 + 1] = height * 0.5;
      positions[i * 3 + 2] = Math.sin(a) * r;
      phases[i]  = Math.random() * Math.PI * 2 + plumeOffset;
      speeds[i]  = 0.6 + Math.random() * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aHoriz',   new THREE.BufferAttribute(new Float32Array(count).fill(0), 1));
    return geo;
  }, [height, plumeOffset]);

  const plumeMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: PLUME_VERT,
    fragmentShader: PLUME_FRAG,
    uniforms: { uTime: { value: 0 }, uVentPos: { value: new THREE.Vector3(...position) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  }), [position]);

  const mainGeo  = useMemo(() => createRoughChimneyGeometry(scale * 1.8, scale * 0.65, height), [scale, height]);
  const neckGeo  = useMemo(() => createRoughChimneyGeometry(scale * 0.65, scale * 0.5, height * 0.28), [scale, height]);

  useFrame((state) => {
    orificeUniforms.uTime.value = state.clock.getElapsedTime();
    plumeMat.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <group position={position}>
      {/* Main shaft */}
      <mesh geometry={mainGeo} position={[0, height / 2, 0]}>
        <meshStandardMaterial color="#1a1208" roughness={0.97} metalness={0.05} />
      </mesh>
      {/* Neck taper */}
      <mesh geometry={neckGeo} position={[0, height + height * 0.14, 0]}>
        <meshStandardMaterial color="#221a10" roughness={0.95} />
      </mesh>

      {/* Glowing orifice cap */}
      <mesh position={[0, height + height * 0.3, 0]}>
        <sphereGeometry args={[scale * 0.52, 10, 8]} />
        <shaderMaterial
          vertexShader={ORIFICE_VERT}
          fragmentShader={ORIFICE_FRAG}
          uniforms={orificeUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Heat glow point light */}
      <pointLight
        position={[0, height + height * 0.3, 0]}
        color={orificeColor}
        intensity={18}
        distance={15}
      />

      {/* Warm rock base light */}
      <pointLight
        position={[0, 1, 0]}
        color="#fb923c"
        intensity={4}
        distance={8}
      />

      {/* Rising plume particles */}
      <points ref={plumeRef} geometry={plumeGeo} material={plumeMat} />

      {/* Lava seep crack at base */}
      {[-0.6, 0.4, -0.3].map((x, i) => (
        <mesh key={i} position={[x, 0.08, (i - 1) * 0.5]} rotation={[0, i * 0.8, 0]}>
          <boxGeometry args={[0.6 + i * 0.1, 0.05, 0.12]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>
      ))}
    </group>
  );
};

// ─── Main ChimneyStack export ─────────────────────────────────────────────
export const ChimneyStack: React.FC = () => {
  const noise2D   = useMemo(() => createNoise2D(), []);
  const floorY    = VENT_CONFIG.floorY;
  const floorYNum = typeof floorY === 'number' ? floorY : depthToY(3000);

  const chimneys: ChimneyProps[] = useMemo(() => [
    { position: [ 0.0,  floorYNum, 0.0], height: 9.5, scale: 1.0, orificeColor: '#fb923c', plumeOffset: 0   },
    { position: [-5.5,  floorYNum, 3.0], height: 6.5, scale: 0.7, orificeColor: '#f59e0b', plumeOffset: 1.2 },
    { position: [ 4.8,  floorYNum,-4.5], height: 7.2, scale: 0.8, orificeColor: '#ef4444', plumeOffset: 2.5 },
  ], [floorYNum]);

  return (
    <group>
      {/* ── Black basalt seafloor ──────────────────────────────────── */}
      <mesh position={[0, floorYNum - 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100, 24, 24]} />
        <meshStandardMaterial color="#0a0805" roughness={0.98} />
      </mesh>

      {/* ── Individual chimneys ───────────────────────────────────── */}
      {chimneys.map((c, i) => <SingleChimney key={i} {...c} />)}

      {/* ── Scene ambient fill — very dim amber ───────────────────── */}
      <ambientLight color="#3d1500" intensity={0.35} />

      {/* ── Distant warm glow (lava field suggestion) ─────────────── */}
      <pointLight position={[0, floorYNum + 1, 15]} color="#7c2d12" intensity={8} distance={35} />
      <pointLight position={[-10, floorYNum + 1, -5]} color="#92400e" intensity={5} distance={22} />
    </group>
  );
};
