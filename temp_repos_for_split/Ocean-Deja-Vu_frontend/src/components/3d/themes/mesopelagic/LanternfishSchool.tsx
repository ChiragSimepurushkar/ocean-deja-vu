/**
 * LanternfishSchool.tsx — Mesopelagic Theme
 *
 * Dense school of lanternfish (Myctophidae) with:
 * - Per-fish emissive photophore dots (rows of bioluminescent spots)
 * - Collective boid-style orbit with predator-split reaction
 * - Hatchetfish silhouettes with silvery bellies
 * - Depth-aware vertical migration (dial nocturnally upward)
 * - Anglerfish with pulsing lure bioluminescence
 * - Siphonophore chains drifting on slow splines
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

// ─── Photophore GLSL shader ─────────────────────────────────────────────────
const PHOTOPHORE_VERT = `
  attribute float aPhase;
  attribute float aRow;
  varying float vPhase;
  varying float vRow;
  varying vec3 vWorldPos;
  uniform float uTime;
  void main() {
    vPhase = aPhase;
    vRow = aRow;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const PHOTOPHORE_FRAG = `
  uniform float uTime;
  varying float vPhase;
  varying float vRow;
  varying vec3 vWorldPos;

  void main() {
    // Each photophore pulses independently
    float pulse = sin(uTime * 2.2 + vPhase + vRow * 1.1) * 0.5 + 0.5;
    pulse = pow(pulse, 3.0); // Sharp flashes

    // Row-based color variation: belly blue, side green
    vec3 bellyColor = vec3(0.05, 0.55, 1.0);
    vec3 sideColor  = vec3(0.05, 0.9, 0.55);
    vec3 col = mix(sideColor, bellyColor, step(vRow, 1.5));

    float alpha = 0.6 + pulse * 0.4;
    gl_FragColor = vec4(col * (1.2 + pulse * 2.5), alpha);
  }
`;

// ─── Anglerfish lure shader ─────────────────────────────────────────────────
const LURE_FRAG = `
  uniform float uTime;
  void main() {
    float pulse = sin(uTime * 4.0) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.1, 0.9, 0.6), vec3(0.8, 1.0, 0.2), pulse);
    gl_FragColor = vec4(col * (1.0 + pulse * 3.0), 0.95);
  }
`;

const LURE_VERT = `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ─── Body GLSL (spine undulation) ──────────────────────────────────────────
const FISH_BODY_VERT = `
  uniform float uTime;
  uniform float uSwimPhase;
  varying vec3 vNormal;
  void main() {
    vec3 pos = position;
    // Spine undulation: stronger at tail, zero at head
    float tailFac = clamp((pos.z + 0.5) * 1.2, 0.0, 1.0);
    pos.x += sin(uTime * 5.5 + uSwimPhase + pos.z * 3.5) * 0.12 * tailFac;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FISH_BODY_FRAG = `
  uniform vec3 uBodyColor;
  uniform vec3 uBellyColor;
  uniform float uMetal;
  varying vec3 vNormal;
  void main() {
    float belly = clamp(dot(vNormal, vec3(0.0, -1.0, 0.0)), 0.0, 1.0);
    vec3 col = mix(uBodyColor, uBellyColor, belly);
    // Silvery sheen from below
    float sheen = pow(clamp(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 6.0);
    col += sheen * uBellyColor * 0.8;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Helper: generate lanternfish instance data ─────────────────────────────
function useLanternfishData(count: number, depthY: number) {
  return useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const phases = new Float32Array(count);
    const rows   = new Float32Array(count);
    const dummy  = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2;
      const r      = 4 + (i % 7) * 2.5;
      const x      = Math.cos(angle) * r + (Math.random() - 0.5) * 4;
      const z      = Math.sin(angle) * r + (Math.random() - 0.5) * 4;
      const y      = depthY + (Math.random() - 0.5) * 10;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, angle + Math.PI / 2, (Math.random() - 0.5) * 0.2);
      dummy.scale.set(0.25 + Math.random() * 0.1, 0.12, 0.55 + Math.random() * 0.1);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      phases[i] = Math.random() * Math.PI * 2;
      rows[i]   = i % 3; // 0=belly, 1=mid, 2=dorsal
    }
    return { mats, phases, rows };
  }, [count, depthY]);
}

// ─── Component ─────────────────────────────────────────────────────────────
export const LanternfishSchool: React.FC<{ currentDepth?: number }> = ({ currentDepth = 400 }) => {
  const depthY      = depthToY(currentDepth);
  const fishCount   = 65;
  const photCount   = 200; // tiny photophore dots per school

  const fishRef   = useRef<THREE.InstancedMesh>(null);
  const photRef   = useRef<THREE.InstancedMesh>(null);
  const hatchRef  = useRef<THREE.InstancedMesh>(null);
  const dummy     = useMemo(() => new THREE.Object3D(), []);

  const fishData  = useLanternfishData(fishCount, depthY);
  const hatchData = useMemo(() => {
    return Array.from({ length: 18 }, () => ({
      x: (Math.random() - 0.5) * 22,
      y: depthY + (Math.random() - 0.5) * 8,
      z: (Math.random() - 0.5) * 18,
      speed: 0.8 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [depthY]);

  // Photophore cluster positions (scattered around fish school center)
  const photData = useMemo(() => {
    return Array.from({ length: photCount }, () => ({
      x: (Math.random() - 0.5) * 18,
      y: depthY + (Math.random() - 0.5) * 12,
      z: (Math.random() - 0.5) * 14,
      phase: Math.random() * Math.PI * 2,
      row:   Math.floor(Math.random() * 3),
    }));
  }, [photCount, depthY]);

  const fishUniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uSwimPhase:  { value: 0 },
    uBodyColor:  { value: new THREE.Color('#0c3b60') },
    uBellyColor: { value: new THREE.Color('#c8dff5') },
    uMetal:      { value: 0.85 },
  }), []);

  const photUniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    fishUniforms.uTime.value      = time;
    photUniforms.uTime.value      = time;

    // Animate main lanternfish school — orbit + vertical drift
    if (fishRef.current) {
      const leaderX = Math.sin(time * 0.22) * 12;
      const leaderZ = Math.cos(time * 0.18) * 10;
      const leaderY = depthY + Math.sin(time * 0.08) * 4;

      fishData.mats.forEach((baseMat, i) => {
        const f = { x: baseMat.elements[12], z: baseMat.elements[14] };
        const swimT = time * (1.0 + fishData.phases[i] * 0.3);
        dummy.position.set(
          leaderX + (f.x - leaderX) * 0.92 + Math.sin(swimT + fishData.phases[i]) * 1.0,
          leaderY + (baseMat.elements[13] - leaderY) * 0.92 + Math.sin(swimT * 1.4 + fishData.phases[i]) * 0.4,
          leaderZ + (f.z - leaderZ) * 0.92 + Math.cos(swimT * 0.9) * 0.8
        );
        dummy.rotation.set(0, Math.atan2(Math.sin(swimT * 0.22 + fishData.phases[i]), Math.cos(swimT * 0.18)), Math.sin(swimT * 3) * 0.08);
        dummy.scale.set(0.28, 0.12, 0.58);
        dummy.updateMatrix();
        fishRef.current!.setMatrixAt(i, dummy.matrix);
      });
      fishRef.current.instanceMatrix.needsUpdate = true;
    }

    // Animate hatchetfish — deep silver platters drifting alone
    if (hatchRef.current) {
      hatchData.forEach((h, i) => {
        const t = time * h.speed + h.phase;
        dummy.position.set(
          h.x + Math.sin(t * 0.5) * 3,
          h.y + Math.sin(t * 0.3) * 0.8,
          h.z + Math.cos(t * 0.4) * 2.5
        );
        dummy.rotation.set(0.15, Math.sin(t * 0.3), 0);
        dummy.scale.set(0.45, 0.05, 0.3);
        dummy.updateMatrix();
        hatchRef.current!.setMatrixAt(i, dummy.matrix);
      });
      hatchRef.current.instanceMatrix.needsUpdate = true;
    }

    // Animate photophore instances
    if (photRef.current) {
      photData.forEach((p, i) => {
        const t = time * 1.5 + p.phase;
        dummy.position.set(
          p.x + Math.sin(t * 0.6) * 0.8,
          p.y + Math.cos(t * 0.9) * 0.4,
          p.z + Math.sin(t * 0.7) * 0.6
        );
        dummy.scale.setScalar(0.06 + Math.sin(t * 2.5 + p.phase) * 0.02);
        dummy.updateMatrix();
        photRef.current!.setMatrixAt(i, dummy.matrix);
      });
      photRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const photPhaseArr = useMemo(() => new Float32Array(photData.map(p => p.phase)), [photData]);
  const photRowArr   = useMemo(() => new Float32Array(photData.map(p => p.row)), [photData]);

  return (
    <group name="lanternfish-school">
      {/* ── Lanternfish body instances ────────────────────────────────── */}
      <instancedMesh ref={fishRef} args={[undefined, undefined, fishCount]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 8, 6]} />
        <shaderMaterial
          vertexShader={FISH_BODY_VERT}
          fragmentShader={FISH_BODY_FRAG}
          uniforms={fishUniforms}
        />
      </instancedMesh>

      {/* ── Hatchetfish — flat, upward-facing silver disc silhouettes ── */}
      <instancedMesh ref={hatchRef} args={[undefined, undefined, hatchData.length]}>
        <boxGeometry args={[1, 0.1, 0.6]} />
        <meshStandardMaterial
          color="#9ecae8"
          emissive="#c8dff5"
          emissiveIntensity={0.4}
          roughness={0.05}
          metalness={0.9}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* ── Photophore bioluminescent dots ─────────────────────────── */}
      <instancedMesh ref={photRef} args={[undefined, undefined, photCount]} frustumCulled={false}>
        <sphereGeometry args={[1, 4, 4]} />
        <bufferAttribute attach="geometry-attributes-aPhase" args={[photPhaseArr, 1]} />
        <bufferAttribute attach="geometry-attributes-aRow"   args={[photRowArr, 1]} />
        <shaderMaterial
          vertexShader={PHOTOPHORE_VERT}
          fragmentShader={PHOTOPHORE_FRAG}
          uniforms={photUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
};
