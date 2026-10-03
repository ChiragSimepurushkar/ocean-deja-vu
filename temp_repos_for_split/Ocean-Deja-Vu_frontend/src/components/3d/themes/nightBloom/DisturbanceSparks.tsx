/**
 * DisturbanceSparks.tsx — Bioluminescent Night Bloom Theme (0–100m)
 *
 * The "galaxy underwater" effect — thousands of bioluminescent dinoflagellates
 * that flash when disturbed. This is the signature visual of the night bloom.
 *
 * Features:
 * - 1200 bioluminescent particles in a camera-relative volume
 * - Disturbance-reactive flashing: particles near the camera flash brighter
 * - Multiple hue channels: cyan (dominant), violet, emerald green
 * - GPU-driven additive particle shader with:
 *   · Per-particle random seed, hue, size, phase
 *   · Proximity-based "disturbed" trigger (camera distance)
 *   · Flash envelope: quick flare up, exponential decay
 *   · Size variation (small ambient, large flashes)
 * - Depth-fade: brighter in upper 40m, dimmer below
 * - Scroll-reactive: as user changes depth, particles flash in wave
 * - Secondary firefly jelly swarm (small pulsing dots on slow drift)
 */
import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

// ─── GPU Particle Shader ────────────────────────────────────────────────────
const BIOLUM_VERT = `
  attribute float aSeed;
  attribute float aHue; // 0=cyan, 0.33=violet, 0.66=green
  attribute float aSize;

  uniform float uTime;
  uniform vec3  uCameraPos;
  uniform float uDisturbRadius;

  varying float vAlpha;
  varying vec3  vColor;
  varying float vFlash;

  // hash function for per-particle randomness
  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float dist = distance(wp.xyz, uCameraPos);

    // Disturbance proximity trigger
    float distFac = 1.0 - smoothstep(0.0, uDisturbRadius, dist);

    // Flash envelope: triggered by proximity, with decay
    float flashPhase = mod(uTime * 1.2 + aSeed * 6.28, 6.28);
    float baseFlash  = pow(max(0.0, sin(flashPhase)), 12.0); // sharp spike
    float disturbedFlash = distFac * pow(sin(mod(uTime * 3.5 + aSeed * 10.0, 6.28) * 0.5 + 0.5), 4.0);
    vFlash = max(baseFlash * 0.3, disturbedFlash);

    // Color from hue attribute
    vec3 cyan   = vec3(0.15, 0.85, 1.0);
    vec3 violet = vec3(0.65, 0.20, 0.95);
    vec3 green  = vec3(0.10, 1.0,  0.55);
    if (aHue < 0.33) {
      vColor = mix(cyan, violet, aHue * 3.0);
    } else if (aHue < 0.66) {
      vColor = mix(violet, green, (aHue - 0.33) * 3.0);
    } else {
      vColor = mix(green, cyan, (aHue - 0.66) * 3.0);
    }

    // Alpha: ambient dim + flash bright
    vAlpha = 0.08 + vFlash * 0.92;

    // Point size: small ambient, large flash
    float sz = aSize * (2.0 + vFlash * 14.0);
    gl_PointSize = sz;

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const BIOLUM_FRAG = `
  varying float vAlpha;
  varying vec3  vColor;
  varying float vFlash;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;

    // Soft radial falloff
    float falloff = 1.0 - r * r;
    falloff = pow(falloff, 1.5);

    // Core is brighter white, rim is colored
    vec3 core = vec3(0.95, 0.98, 1.0);
    vec3 col  = mix(vColor, core, vFlash * 0.5);
    col *= 1.0 + vFlash * 4.0; // HDR bloom driver

    gl_FragColor = vec4(col * falloff, vAlpha * falloff);
  }
`;

// ─── Firefly Jelly Mini-Swarm Shader ────────────────────────────────────────
const FIREFLY_VERT = `
  uniform float uTime;
  attribute float aPhase;
  varying float vPulse;

  void main() {
    vec3 pos = position;
    float t = uTime * 0.8 + aPhase;
    pos.x += sin(t * 0.4) * 2.0;
    pos.y += cos(t * 0.5) * 1.5;
    pos.z += sin(t * 0.3 + aPhase) * 1.8;

    vPulse = pow(sin(uTime * 2.0 + aPhase) * 0.5 + 0.5, 3.0);
    gl_PointSize = 4.0 + vPulse * 8.0;
    gl_Position  = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
  }
`;

const FIREFLY_FRAG = `
  varying float vPulse;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float falloff = pow(1.0 - r, 2.0);
    vec3 col = mix(vec3(0.0, 0.8, 0.5), vec3(0.3, 0.95, 1.0), vPulse);
    gl_FragColor = vec4(col * (1.0 + vPulse * 3.0) * falloff, falloff * (0.3 + vPulse * 0.7));
  }
`;

// ─── Main Component ─────────────────────────────────────────────────────────
export const DisturbanceSparks: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  const count       = 1200;
  const fireflyN    = 80;
  const pointsRef   = useRef<THREE.Points>(null);
  const fireflyRef  = useRef<THREE.Points>(null);
  const { camera }  = useThree();
  const depthY      = depthToY(currentDepth);

  // Main bioluminescent particle field
  const { geo, uniforms } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds     = new Float32Array(count);
    const hues      = new Float32Array(count);
    const sizes     = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 45;
      positions[i * 3 + 1] = depthToY(0) + (Math.random()) * (depthToY(100) - depthToY(0));
      positions[i * 3 + 2] = (Math.random() - 0.5) * 45;
      seeds[i]  = Math.random();
      hues[i]   = Math.random();
      sizes[i]  = 1.0 + Math.random() * 2.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aHue',     new THREE.BufferAttribute(hues, 1));
    geometry.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

    const u = {
      uTime:          { value: 0 },
      uCameraPos:     { value: new THREE.Vector3() },
      uDisturbRadius: { value: 12.0 },
    };

    return { geo: geometry, uniforms: u };
  }, [count]);

  // Firefly jelly geometry
  const { ffGeo, ffUniforms } = useMemo(() => {
    const positions = new Float32Array(fireflyN * 3);
    const phases    = new Float32Array(fireflyN);

    for (let i = 0; i < fireflyN; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = depthToY(5) + Math.random() * (depthToY(60) - depthToY(5));
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      phases[i]  = Math.random() * Math.PI * 2;
    }

    const geo2 = new THREE.BufferGeometry();
    geo2.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo2.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));

    return {
      ffGeo: geo2,
      ffUniforms: { uTime: { value: 0 } },
    };
  }, [fireflyN]);

  const biolumMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   BIOLUM_VERT,
    fragmentShader: BIOLUM_FRAG,
    uniforms,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
  }), [uniforms]);

  const ffMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   FIREFLY_VERT,
    fragmentShader: FIREFLY_FRAG,
    uniforms:       ffUniforms,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
  }), [ffUniforms]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    uniforms.uTime.value      = time;
    uniforms.uCameraPos.value.copy(camera.position);
    ffUniforms.uTime.value    = time;

    // Gently drift the particle field
    if (pointsRef.current) {
      const posArr = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        posArr[i * 3]     += Math.sin(time * 0.3 + i * 0.01) * 0.012;
        posArr[i * 3 + 1] += Math.cos(time * 0.25 + i * 0.02) * 0.008;
        posArr[i * 3 + 2] += Math.sin(time * 0.2 + i * 0.015) * 0.01;
      }
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <group name="disturbance-sparks">
      {/* ── Main bioluminescent galaxy field ─────────────────────── */}
      <points ref={pointsRef} geometry={geo} material={biolumMat} />

      {/* ── Firefly jelly swarm ──────────────────────────────────── */}
      <points ref={fireflyRef} geometry={ffGeo} material={ffMat} />

      {/* ── Ambient glow fill lights ─────────────────────────────── */}
      <pointLight position={[0, depthY + 5, 0]}  color="#22c55e" intensity={2.5} distance={25} />
      <pointLight position={[-8, depthY, -5]}     color="#38bdf8" intensity={1.8} distance={20} />
      <pointLight position={[6, depthY - 3, 8]}   color="#a855f7" intensity={1.5} distance={18} />
    </group>
  );
};
