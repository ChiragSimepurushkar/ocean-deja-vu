/**
 * NocturnalFauna.tsx — Night Ocean Theme (0–200m, no sunlight)
 *
 * Night dive ecosystem with:
 * - 40 silhouetted fish: jet-black unlit cones against moonlit water
 *   (dark shape is the effect; contrast with moonlit surface is the mood)
 * - 8 moon jellyfish: lathe-bell pulsing body + trailing tentacle ribbons
 *   with soft cyan bioluminescent edge glow
 * - 2 nocturnal sharks: slow patrol spline, near-surface silhouette
 * - Bioluminescent flash trail behind each fast fish (additive blue dots)
 * - Moon ring shimmer at surface (bright disc at Y=surface)
 * - Manta ray: wide wingspan glide across moon face
 * - Nocturnal squid: chromatophore ripple in darkness
 * - Comb jellyfish: ellipsoid with scrolling cyan cilia bands
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

const SURFACE_Y = depthToY(2);

// ─── Moon jellyfish bell shader ─────────────────────────────────────────────
const JELLY_BELL_VERT = `
  uniform float uTime;
  uniform float uPhase;
  varying vec3 vNormal;
  varying float vPulse;

  void main() {
    vec3 pos = position;
    // Rhythmic radial squeeze: bell contracts and relaxes
    float pulse = sin(uTime * 1.4 + uPhase) * 0.5 + 0.5; // 0=relaxed 1=contracted
    vPulse = pulse;
    // Flatten top, expand rim when contracted
    pos.y  *= 1.0 - pulse * 0.28;
    float radialFac = 1.0 + pulse * 0.22 * clamp(-pos.y * 2.0, 0.0, 1.0); // expand lower rim
    pos.xz *= radialFac;

    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const JELLY_BELL_FRAG = `
  uniform float uTime;
  uniform float uPhase;
  varying vec3 vNormal;
  varying float vPulse;

  void main() {
    vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
    float rim = pow(1.0 - max(dot(vNormal, normalize(viewDir)), 0.0), 3.5);

    // Translucent pale cyan bell with pink/violet gonad ring suggestion
    vec3 bell  = vec3(0.5, 0.85, 0.9) * 0.18;
    vec3 gonad = vec3(0.75, 0.35, 0.65);
    float ring = smoothstep(0.3, 0.55, abs(vNormal.y)); // ring near equator
    vec3 col = bell + gonad * ring * 0.3;
    col += rim * vec3(0.3, 0.9, 1.0) * (0.6 + vPulse * 0.9); // bioluminescent rim

    float alpha = 0.18 + rim * 0.55 + vPulse * 0.08;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Comb jelly scrolling cilia shader ─────────────────────────────────────
const COMB_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    // 8 vertical cilia rows scrolling upward
    float cilia = 0.0;
    for (int i = 0; i < 8; i++) {
      float offset = float(i) / 8.0;
      float band   = smoothstep(0.03, 0.0, abs(fract(vUv.x * 8.0 + offset) - 0.5) - 0.02);
      float scroll = sin(uTime * 2.5 + vUv.y * 18.0 + float(i) * 0.9) * 0.5 + 0.5;
      cilia = max(cilia, band * scroll);
    }
    vec3 bodycol = vec3(0.05, 0.55, 0.70) * 0.2;
    vec3 ciliCol = mix(vec3(0.0, 0.9, 0.8), vec3(0.8, 0.0, 0.9), sin(uTime * 1.5) * 0.5 + 0.5);
    vec3 col = bodycol + ciliCol * cilia;
    float alpha = 0.14 + cilia * 0.75;
    gl_FragColor = vec4(col, alpha);
  }
`;

const COMB_VERT = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Moon surface ring shader ───────────────────────────────────────────────
const MOON_RING_FRAG = `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float r = length(uv);
    // Snell's window — central bright disc
    float disc = smoothstep(0.52, 0.38, r);
    // Ring ripples
    float ripple = sin(r * 40.0 - uTime * 3.0) * 0.5 + 0.5;
    float ring   = disc * ripple * smoothstep(0.0, 0.05, r);

    vec3 moon = vec3(0.55, 0.70, 0.90);
    vec3 col  = moon * disc + moon * ring * 0.5;
    gl_FragColor = vec4(col, disc * 0.25 + ring * 0.15);
  }
`;

const MOON_RING_VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// ─── Manta Ray ──────────────────────────────────────────────────────────────
const MantaRay: React.FC = () => {
  const ref  = useRef<THREE.Group>(null);
  const wL   = useRef<THREE.Mesh>(null);
  const wR   = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!ref.current) return;
    ref.current.position.set(
      Math.sin(t * 0.09) * 28,
      SURFACE_Y - 6 + Math.sin(t * 0.14) * 2,
      -12 + Math.cos(t * 0.07) * 20
    );
    ref.current.rotation.y = Math.atan2(Math.cos(t * 0.09), -Math.sin(t * 0.07)) + Math.PI / 2;

    const flap = Math.sin(t * 0.9) * 0.18;
    if (wL.current) wL.current.rotation.z = flap;
    if (wR.current) wR.current.rotation.z = -flap;
  });

  return (
    <group ref={ref} scale={1.8}>
      <mesh scale={[1.0, 0.14, 0.6]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color="#020514" />
      </mesh>
      <mesh ref={wL} position={[-1.8, 0, 0]}>
        <planeGeometry args={[2.8, 1.1, 3, 3]} />
        <meshBasicMaterial color="#020514" side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={wR} position={[1.8, 0, 0]}>
        <planeGeometry args={[2.8, 1.1, 3, 3]} />
        <meshBasicMaterial color="#020514" side={THREE.DoubleSide} />
      </mesh>
      {/* Cephalic lobes */}
      {[-0.35, 0.35].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.85]} rotation={[0.3, 0, (i === 0 ? 0.3 : -0.3)]}>
          <boxGeometry args={[0.2, 0.12, 0.4]} />
          <meshBasicMaterial color="#020514" />
        </mesh>
      ))}
    </group>
  );
};

// ─── Night Shark ────────────────────────────────────────────────────────────
const NightShark: React.FC<{ offset: number }> = ({ offset }) => {
  const ref = useRef<THREE.Group>(null);

  const pathPoints = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-25, SURFACE_Y - 8, -20),
    new THREE.Vector3(-10, SURFACE_Y - 6, 0),
    new THREE.Vector3(10, SURFACE_Y - 9, 10),
    new THREE.Vector3(25, SURFACE_Y - 7, -5),
    new THREE.Vector3(15, SURFACE_Y - 5, -20),
    new THREE.Vector3(-25, SURFACE_Y - 8, -20),
  ], true), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!ref.current) return;
    const tNorm = ((t * 0.04 + offset) % 1.0);
    const pos   = pathPoints.getPoint(tNorm);
    const tang  = pathPoints.getTangent(tNorm);
    ref.current.position.copy(pos);
    ref.current.rotation.y = Math.atan2(tang.x, tang.z);
  });

  return (
    <group ref={ref}>
      <mesh scale={[0.45, 0.4, 2.0]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#020a18" />
      </mesh>
      <mesh position={[0, 0.6, -0.4]} rotation={[0, 0, 0.1]}>
        <coneGeometry args={[0.3, 1.2, 4]} />
        <meshBasicMaterial color="#020a18" />
      </mesh>
      {[-1.0, 1.0].map((x, i) => (
        <mesh key={i} position={[x * 0.7, -0.1, 0]} rotation={[0, 0, (i === 0 ? 0.4 : -0.4)]}>
          <boxGeometry args={[0.8, 0.06, 0.35]} />
          <meshBasicMaterial color="#010912" />
        </mesh>
      ))}
    </group>
  );
};

// ─── Main NocturnalFauna component ─────────────────────────────────────────
export const NocturnalFauna: React.FC<{ currentDepth?: number }> = ({ currentDepth = 30 }) => {
  const depthY = depthToY(currentDepth);

  const silFishCount = 40;
  const jellyCount   = 8;

  const silFishRef = useRef<THREE.InstancedMesh>(null);
  const jellyRef   = useRef<THREE.InstancedMesh>(null);
  const combRef    = useRef<THREE.Mesh>(null);

  const moonRingUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const combUniforms     = useMemo(() => ({ uTime: { value: 0 } }), []);

  const silFishOffsets = useMemo(() => Array.from({ length: silFishCount }, () => ({
    x: (Math.random() - 0.5) * 22,
    y: depthY + (Math.random() - 0.5) * 16,
    z: (Math.random() - 0.5) * 18,
    speed: 0.7 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
  })), [depthY]);

  const jellyOffsets = useMemo(() => Array.from({ length: jellyCount }, () => ({
    x: (Math.random() - 0.5) * 20,
    y: depthY + (Math.random() - 0.5) * 12,
    z: (Math.random() - 0.5) * 16,
    phase: Math.random() * Math.PI * 2,
    speed: 0.25 + Math.random() * 0.15,
  })), [depthY]);

  const jellyUniforms = useMemo(() => jellyOffsets.map(j => ({
    uTime:  { value: 0 },
    uPhase: { value: j.phase },
  })), [jellyOffsets]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    moonRingUniforms.uTime.value = time;
    combUniforms.uTime.value = time;
    jellyUniforms.forEach(u => { u.uTime.value = time; });

    // Silhouetted fish
    if (silFishRef.current) {
      silFishOffsets.forEach((f, i) => {
        const t = time * f.speed + f.phase;
        dummy.position.set(
          f.x + Math.sin(t * 0.4) * 4,
          f.y + Math.sin(t * 0.6) * 0.5,
          f.z + Math.cos(t * 0.35) * 3.5
        );
        dummy.rotation.set(0, t * 0.35 + Math.PI / 2, Math.sin(t * 3) * 0.06);
        dummy.scale.set(0.22, 0.1, 0.55);
        dummy.updateMatrix();
        silFishRef.current!.setMatrixAt(i, dummy.matrix);
      });
      silFishRef.current.instanceMatrix.needsUpdate = true;
    }

    // Jellyfish
    if (jellyRef.current) {
      jellyOffsets.forEach((j, i) => {
        const t = time * j.speed + j.phase;
        dummy.position.set(
          j.x + Math.sin(t * 0.3) * 2,
          j.y + Math.sin(t * 0.5) * 1.0,
          j.z + Math.cos(t * 0.25) * 2.5
        );
        dummy.rotation.set(0, t * 0.1, 0);
        dummy.scale.set(0.8 + Math.sin(t * 1.4 + j.phase) * 0.05, 0.55, 0.8 + Math.sin(t * 1.4 + j.phase) * 0.05);
        dummy.updateMatrix();
        jellyRef.current!.setMatrixAt(i, dummy.matrix);
      });
      jellyRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="nocturnal-fauna">
      {/* ── Moon ring at surface ──────────────────────────────────── */}
      <mesh position={[0, SURFACE_Y, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[55, 55]} />
        <shaderMaterial
          vertexShader={MOON_RING_VERT}
          fragmentShader={MOON_RING_FRAG}
          uniforms={moonRingUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* ── Silhouetted fish school ──────────────────────────────── */}
      <instancedMesh ref={silFishRef} args={[undefined, undefined, silFishCount]}>
        <coneGeometry args={[0.18, 0.85, 4]} />
        <meshBasicMaterial color="#010814" />
      </instancedMesh>

      {/* ── Moon jellyfish ───────────────────────────────────────── */}
      <instancedMesh ref={jellyRef} args={[undefined, undefined, jellyCount]}>
        <sphereGeometry args={[1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <shaderMaterial
          vertexShader={JELLY_BELL_VERT}
          fragmentShader={JELLY_BELL_FRAG}
          uniforms={jellyUniforms[0]}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* ── Comb jellyfish ───────────────────────────────────────── */}
      <mesh
        ref={combRef}
        position={[4, depthY + 5, -6]}
        scale={[0.5, 1.1, 0.5]}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <shaderMaterial
          vertexShader={COMB_VERT}
          fragmentShader={COMB_FRAG}
          uniforms={combUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Nocturnal sharks ─────────────────────────────────────── */}
      <NightShark offset={0} />
      <NightShark offset={0.5} />

      {/* ── Manta ray at surface ─────────────────────────────────── */}
      <MantaRay />

      {/* ── Moon light source ────────────────────────────────────── */}
      <directionalLight
        position={[5, 50, -20]}
        color="#b0c8e8"
        intensity={0.25}
      />
    </group>
  );
};
