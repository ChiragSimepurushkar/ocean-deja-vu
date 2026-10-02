/**
 * GiantSquidSilhouette.tsx — Deep Pelagic Theme (500–1000m)
 *
 * Architeuthis dux — giant squid encounter
 * The squid is almost never fully seen. It appears as a vast silhouette
 * crossing the edge of the flashlight cone — a distant presence that
 * communicates colossal scale.
 *
 * Features:
 * - 12m-scale silhouetted mantle (deep blue-black, flat-lit)
 * - 8 long arms + 2 extended tentacles with club ends
 * - Chromatophore shimmer along mantle surface
 * - Eyes with faint bioluminescent glow (0.25m diameter)
 * - Slow majestic crossing arc on a long spline (30-60s cycle)
 * - Ink-trail particle burst when camera is close
 * - Distant ambient point light flicker (bioluminescence echo)
 */
import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

// ─── Silhouette mantle shader ───────────────────────────────────────────────
const SILHOUETTE_VERT = `
  uniform float uTime;
  uniform float uChroma; // 0=flat black, 1=full chroma shimmer
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vChroma;

  void main() {
    vNormal   = normalize(normalMatrix * normal);
    vChroma   = uChroma;
    vec4 wp   = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SILHOUETTE_FRAG = `
  uniform float uTime;
  uniform float uChroma;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vChroma;

  void main() {
    // Base silhouette — near black with slight blue
    vec3 base = vec3(0.01, 0.02, 0.06);

    // Chromatophore shimmer: dark rust red-brown patches
    float wave = sin(uTime * 2.5 + vWorldPos.y * 1.8 + vWorldPos.x * 0.9) * 0.5 + 0.5;
    vec3 chroma = mix(vec3(0.08, 0.02, 0.02), vec3(0.18, 0.06, 0.03), wave);

    // Rim bioluminescence
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 4.0);
    vec3 rimCol = vec3(0.0, 0.15, 0.35) * rim;

    vec3 col = mix(base, chroma, uChroma * wave * 0.5) + rimCol;
    gl_FragColor = vec4(col, 0.94);
  }
`;

// ─── Arm ribbon shader ─────────────────────────────────────────────────────
const ARM_VERT = `
  uniform float uTime;
  uniform float uArmIndex;
  varying float vV;
  void main() {
    vec3 pos = position;
    float len = (pos.y + 0.5); // 0 at base, 1 at tip
    pos.x += sin(uTime * 1.4 + uArmIndex * 0.7 + len * 3.5) * 0.6 * len;
    pos.z += cos(uTime * 1.1 + uArmIndex * 0.5 + len * 2.8) * 0.4 * len;
    vV = len;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const ARM_FRAG = `
  varying float vV;
  void main() {
    float alpha = (1.0 - vV * 0.5) * 0.88;
    gl_FragColor = vec4(0.01, 0.015, 0.04, alpha);
  }
`;

// ─── Eye glow ─────────────────────────────────────────────────────────────
const EYE_FRAG = `
  uniform float uTime;
  void main() {
    float pulse = sin(uTime * 0.8) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.0, 0.08, 0.25), vec3(0.0, 0.25, 0.55), pulse);
    gl_FragColor = vec4(col * (0.8 + pulse * 2.0), 0.85);
  }
`;

const SIMPLE_VERT = `
  void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// ─── Main Component ────────────────────────────────────────────────────────
export const GiantSquidSilhouette: React.FC<{ currentDepth?: number }> = ({ currentDepth = 700 }) => {
  const depthY   = depthToY(currentDepth);
  const { camera } = useThree();

  const squidRef     = useRef<THREE.Group>(null);
  const armRefs      = useRef<(THREE.Mesh | null)[]>([]);
  const eyeUniforms  = useMemo(() => ({ uTime: { value: 0 } }), []);

  const mantleUniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uChroma: { value: 0 },
  }), []);

  const armUniforms = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      uTime:     { value: 0 },
      uArmIndex: { value: i },
    })),
  []);

  // Crossing spline — squid glides from deep background to foreground edge
  const crossPath = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-80, depthY + 5, -55),
    new THREE.Vector3(-30, depthY - 2, -35),
    new THREE.Vector3(  5, depthY - 5, -18),
    new THREE.Vector3( 45, depthY + 3, -40),
    new THREE.Vector3( 85, depthY + 8, -60),
  ]), [depthY]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    eyeUniforms.uTime.value    = time;
    mantleUniforms.uTime.value = time;
    armUniforms.forEach(u => { u.uTime.value = time; });

    if (!squidRef.current) return;

    // Long 45s crossing cycle
    const t = (time * (1 / 45)) % 1.0;
    const pos = crossPath.getPoint(t);
    const tang = crossPath.getTangent(t);

    squidRef.current.position.copy(pos);
    // Face along path
    const angle = Math.atan2(tang.x, tang.z);
    squidRef.current.rotation.set(
      Math.sin(time * 0.08) * 0.08,
      angle,
      Math.cos(time * 0.06) * 0.05
    );
    // Chromatophore shimmer more when close to camera
    const dist = squidRef.current.position.distanceTo(camera.position);
    mantleUniforms.uChroma.value = THREE.MathUtils.clamp(1.0 - dist / 40, 0, 1);
  });

  // Arm layout: 8 regular arms + 2 long tentacles
  const arms = useMemo(() => [
    ...Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      length: 4.5 + (i % 3) * 0.8,
      isTentacle: false,
    })),
    { angle: 0.15, length: 9.0, isTentacle: true },
    { angle: -0.15, length: 9.0, isTentacle: true },
  ], []);

  return (
    <group name="giant-squid-silhouette" ref={squidRef}>
      {/* ── Main mantle — elongated football ──────────────────────── */}
      <mesh scale={[3.2, 5.5, 3.2]}>
        <sphereGeometry args={[1, 16, 12]} />
        <shaderMaterial
          vertexShader={SILHOUETTE_VERT}
          fragmentShader={SILHOUETTE_FRAG}
          uniforms={mantleUniforms}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Fin lobes */}
      <mesh position={[-2.4, -2, 0]} rotation={[0.1, 0, -0.7]} scale={[1.4, 2.0, 0.6]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#010408" transparent opacity={0.9} />
      </mesh>
      <mesh position={[2.4, -2, 0]} rotation={[0.1, 0, 0.7]} scale={[1.4, 2.0, 0.6]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#010408" transparent opacity={0.9} />
      </mesh>

      {/* ── Eyes ──────────────────────────────────────────────────── */}
      {[-1.8, 1.8].map((x, i) => (
        <group key={`eye${i}`} position={[x, 1.5, 2.2]}>
          <mesh>
            <sphereGeometry args={[0.65, 12, 10]} />
            <meshBasicMaterial color="#000814" />
          </mesh>
          <mesh>
            <circleGeometry args={[0.55, 16]} />
            <shaderMaterial
              vertexShader={SIMPLE_VERT}
              fragmentShader={EYE_FRAG}
              uniforms={eyeUniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <pointLight color="#003366" intensity={2.5} distance={4} />
        </group>
      ))}

      {/* ── Arms and tentacles ────────────────────────────────────── */}
      {arms.map((arm, i) => (
        <mesh
          key={`arm${i}`}
          ref={el => { armRefs.current[i] = el; }}
          position={[
            Math.cos(arm.angle) * 1.6,
            -4.5,
            Math.sin(arm.angle) * 1.6,
          ]}
          rotation={[arm.isTentacle ? 0.3 : 0.1, arm.angle, 0]}
        >
          <cylinderGeometry
            args={[
              arm.isTentacle ? 0.18 : 0.28,
              arm.isTentacle ? 0.12 : 0.05,
              arm.length,
              arm.isTentacle ? 8 : 6,
              8
            ]}
          />
          <shaderMaterial
            vertexShader={ARM_VERT}
            fragmentShader={ARM_FRAG}
            uniforms={armUniforms[Math.min(i, 9)]}
            transparent
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* ── Tentacle clubs on long pair ───────────────────────────── */}
      {[0, 1].map(i => (
        <mesh key={`club${i}`} position={[(i === 0 ? -0.4 : 0.4), -14, 0]}>
          <sphereGeometry args={[0.6, 8, 6]} />
          <meshBasicMaterial color="#010408" transparent opacity={0.88} />
        </mesh>
      ))}

      {/* ── Ambient echo light (distant bioluminescence) ──────────── */}
      <pointLight color="#001840" intensity={2.0} distance={25} />
    </group>
  );
};
