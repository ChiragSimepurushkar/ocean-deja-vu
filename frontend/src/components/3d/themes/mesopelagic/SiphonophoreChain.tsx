/**
 * SiphonophoreChain.tsx — Mesopelagic Theme
 *
 * Colonial siphonophore organism — one of the longest animals in the ocean.
 * Rendered as:
 * - A long spline path that slowly drifts and curves
 * - 40-60 zooid spheres following the spline with elastic lag
 * - Warm orange-magenta bioluminescent glow cores
 * - Trailing tentacle ribbons (alpha-blended planes)
 * - Passive gentle pulsation (no fish-style swimming)
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

const ZOOID_VERT = `
  uniform float uTime;
  uniform float uIndex;
  varying float vPulse;
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vPulse = sin(uTime * 1.8 + uIndex * 0.4) * 0.5 + 0.5;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ZOOID_FRAG = `
  uniform float uTime;
  varying float vPulse;
  varying vec3 vWorldPos;

  void main() {
    // Core: warm amber-magenta, tentacles: cyan-blue
    vec3 core   = vec3(1.0, 0.45, 0.15);
    vec3 mantle = vec3(0.6, 0.10, 0.70);
    vec3 col = mix(mantle, core, vPulse);

    // Additive glow rim
    float rim = 1.0 - vPulse * 0.4;
    col *= 1.0 + rim * 2.5;
    float alpha = 0.55 + vPulse * 0.40;
    gl_FragColor = vec4(col, alpha);
  }
`;

const TENTACLE_VERT = `
  uniform float uTime;
  uniform float uOffset;
  varying float vY;
  void main() {
    vec3 pos = position;
    // Wave along tentacle length
    pos.x += sin(uTime * 1.2 + uOffset + pos.y * 2.0) * 0.25;
    pos.z += cos(uTime * 0.9 + uOffset + pos.y * 1.8) * 0.15;
    vY = (pos.y + 1.0) * 0.5; // 0=base, 1=tip
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const TENTACLE_FRAG = `
  uniform float uTime;
  uniform float uOffset;
  varying float vY;
  void main() {
    float alpha = (1.0 - vY) * 0.55; // fade toward tip
    vec3 col = mix(vec3(0.15, 0.9, 0.7), vec3(1.0, 0.3, 0.8), vY);
    float pulse = sin(uTime * 2.0 + uOffset) * 0.5 + 0.5;
    col *= 1.0 + pulse * 1.5;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Main component ────────────────────────────────────────────────────────
export const SiphonophoreChain: React.FC<{ currentDepth?: number }> = ({ currentDepth = 350 }) => {
  const zooidCount   = 50;
  const tentacleCount = 30;
  const depthY        = depthToY(currentDepth);

  const zooidRef    = useRef<THREE.InstancedMesh>(null);
  const tentRef     = useRef<THREE.InstancedMesh>(null);
  const dummy       = useMemo(() => new THREE.Object3D(), []);

  // Spline control points defining the colony's overall shape
  const splinePoints = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => new THREE.Vector3(
      (Math.random() - 0.5) * 18,
      depthY + (Math.random() - 0.5) * 14,
      -5 + i * 3.5 + (Math.random() - 0.5) * 2
    ));
  }, [depthY]);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(splinePoints, false, 'catmullrom', 0.5), [splinePoints]);

  const zooidUniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uIndex: { value: 0 },
  }), []);

  const tentUniforms = useMemo(() => Array.from({ length: tentacleCount }, (_, i) => ({
    uTime:   { value: 0 },
    uOffset: { value: i * 0.4 },
  })), [tentacleCount]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    zooidUniforms.uTime.value  = time;

    if (zooidRef.current) {
      for (let i = 0; i < zooidCount; i++) {
        const t = i / (zooidCount - 1);
        // Animate spline by slightly shifting the time basis for gentle drift
        const shiftedT = (t + time * 0.025) % 1.0;
        const pos = curve.getPoint(shiftedT);

        // Organic scale pulse per zooid
        const scale = 0.18 + Math.sin(time * 1.6 + i * 0.45) * 0.06;
        dummy.position.copy(pos);
        dummy.rotation.set(
          Math.sin(time * 0.5 + i * 0.3) * 0.3,
          time * 0.1 + i * 0.2,
          Math.cos(time * 0.4 + i * 0.25) * 0.2
        );
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        zooidRef.current.setMatrixAt(i, dummy.matrix);
      }
      zooidRef.current.instanceMatrix.needsUpdate = true;
    }

    // Animate tentacle planes
    if (tentRef.current) {
      for (let i = 0; i < tentacleCount; i++) {
        tentUniforms[i].uTime.value = time;
        const t2 = i / tentacleCount;
        const pos = curve.getPoint((t2 + time * 0.025) % 1.0);
        dummy.position.set(pos.x + (Math.random() - 0.5) * 0.5, pos.y - 0.4, pos.z);
        dummy.rotation.set(0, time * 0.3 + i * 0.5, 0);
        dummy.scale.set(0.1, 1.0 + Math.random() * 0.5, 0.1);
        dummy.updateMatrix();
        tentRef.current.setMatrixAt(i, dummy.matrix);
      }
      tentRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="siphonophore-chain">
      {/* ── Zooid bell instances (translucent bioluminescent spheres) ── */}
      <instancedMesh ref={zooidRef} args={[undefined, undefined, zooidCount]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <shaderMaterial
          vertexShader={ZOOID_VERT}
          fragmentShader={ZOOID_FRAG}
          uniforms={zooidUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* ── Trailing tentacle ribbons ──────────────────────────────── */}
      <instancedMesh ref={tentRef} args={[undefined, undefined, tentacleCount]} frustumCulled={false}>
        <planeGeometry args={[0.15, 2.0, 1, 8]} />
        <shaderMaterial
          vertexShader={TENTACLE_VERT}
          fragmentShader={TENTACLE_FRAG}
          uniforms={tentUniforms[0]}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* ── Ambient point light at chain center ───────────────────── */}
      <pointLight
        position={[0, depthY, 0]}
        color="#f97316"
        intensity={3.5}
        distance={18}
      />
      <pointLight
        position={[5, depthY - 3, -5]}
        color="#c026d3"
        intensity={2.2}
        distance={12}
      />
    </group>
  );
};
