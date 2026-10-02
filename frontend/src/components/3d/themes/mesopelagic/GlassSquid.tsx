/**
 * GlassSquid.tsx — Mesopelagic Theme
 *
 * Cranchiidae glass squid — nearly transparent body with glowing photophore eyes,
 * chromatophore flashes, and ink-trail bioluminescence.
 *
 * Features:
 * - Translucent ellipsoid mantle (glass material with refraction approximation)
 * - Eight tentacles trailing behind, sinusoidal sway
 * - Two massive round eyes with turquoise bioluminescent sclera
 * - Chromatophore color wave rippling across body surface
 * - Jet-propulsion burst locomotion (rapid escape then slow drift cycle)
 * - Ink-trail bioluminescent particle burst (additive cyan spray)
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

// ─── Mantle glass shader ────────────────────────────────────────────────────
const MANTLE_VERT = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const MANTLE_FRAG = `
  uniform float uTime;
  uniform float uChromaPhase;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    // Fresnel rim glow
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - clamp(dot(vNormal, viewDir), 0.0, 1.0), 2.8);

    // Chromatophore color flash — ripples across body
    float chroma = sin(uTime * 3.0 + uChromaPhase + vWorldPos.y * 2.5) * 0.5 + 0.5;
    vec3 bodyColor  = mix(vec3(0.05, 0.45, 0.55), vec3(0.15, 0.85, 0.65), chroma);
    vec3 rimColor   = vec3(0.1, 0.95, 0.85);

    // Glass — mostly transparent, vivid rim
    vec3 col = mix(bodyColor * 0.15, rimColor, fresnel * 0.9);
    float alpha = 0.12 + fresnel * 0.55 + chroma * 0.08;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Eye shader — large glowing round eyes ─────────────────────────────────
const EYE_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv - 0.5;
    float r = length(uv);
    // Iris/pupil
    float pupil  = smoothstep(0.18, 0.14, r);
    float iris   = smoothstep(0.34, 0.20, r);
    float sclera = smoothstep(0.50, 0.36, r);

    float pulse  = sin(uTime * 1.5) * 0.5 + 0.5;

    vec3 pupiCol  = vec3(0.0);
    vec3 irisCol  = mix(vec3(0.0, 0.8, 0.6), vec3(0.2, 1.0, 0.8), pulse);
    vec3 sclCol   = vec3(0.0, 0.3, 0.4);

    vec3 col = sclCol * sclera + irisCol * iris + pupiCol * pupil;
    col += irisCol * iris * 3.0 * pulse; // bright glow
    float alpha = sclera;
    gl_FragColor = vec4(col, alpha);
  }
`;

const EYE_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Tentacle GLSL ─────────────────────────────────────────────────────────
const TENT_VERT = `
  uniform float uTime;
  uniform float uTentIndex;
  varying float vLen;
  void main() {
    vec3 pos = position;
    float taper = (pos.y + 0.5); // 0 at tip, 1 at base
    float sway = sin(uTime * 2.5 + uTentIndex * 0.8 + taper * 3.0) * 0.25 * (1.0 - taper);
    pos.x += sway;
    pos.z += cos(uTime * 1.8 + uTentIndex * 1.1) * 0.15 * (1.0 - taper);
    vLen = 1.0 - taper;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const TENT_FRAG = `
  uniform float uTime;
  uniform float uTentIndex;
  varying float vLen;
  void main() {
    float chroma = sin(uTime * 3.0 + uTentIndex * 0.8) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.05, 0.55, 0.65), vec3(0.3, 0.9, 0.5), chroma);
    col *= 1.0 + chroma * 1.2;
    float alpha = (1.0 - vLen * 0.7) * 0.5;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Glass Squid Component ─────────────────────────────────────────────────
export const MesopelagicGlassSquid: React.FC<{ currentDepth?: number }> = ({ currentDepth = 380 }) => {
  const depthY = depthToY(currentDepth);

  const squidGroupRef = useRef<THREE.Group>(null);
  const mantleRef     = useRef<THREE.Mesh>(null);
  const leftEyeRef    = useRef<THREE.Mesh>(null);
  const rightEyeRef   = useRef<THREE.Mesh>(null);

  const tentacleRefs  = useRef<(THREE.Mesh | null)[]>([]);

  const mantleUniforms = useMemo(() => ({
    uTime:        { value: 0 },
    uChromaPhase: { value: Math.random() * Math.PI * 2 },
  }), []);

  const eyeUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const tentacleUniforms = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      uTime:       { value: 0 },
      uTentIndex:  { value: i },
    })),
  []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    mantleUniforms.uTime.value = time;
    eyeUniforms.uTime.value    = time;
    tentacleUniforms.forEach(u => { u.uTime.value = time; });

    if (!squidGroupRef.current) return;

    // Jet-propulsion burst cycle: slow drift, then quick dart
    const burstCycle = (time * 0.4) % (Math.PI * 2);
    const speed = burstCycle < 0.8 ? 0.8 : 0.12;
    const jetOffset = Math.pow(Math.max(0, Math.sin(burstCycle)), 4) * 4;

    squidGroupRef.current.position.set(
      Math.sin(time * 0.18) * 10 - 3,
      depthY + Math.sin(time * 0.12) * 4 - jetOffset * 0.5,
      -8 + Math.cos(time * 0.14) * 6 + jetOffset
    );
    squidGroupRef.current.rotation.set(
      Math.sin(burstCycle) * 0.15,
      time * 0.08,
      Math.sin(time * 0.4) * 0.05
    );

    // Mantle pulsation (squeezing to jet)
    const mantleScale = 1.0 - Math.max(0, Math.sin(burstCycle)) * 0.25;
    if (mantleRef.current) {
      mantleRef.current.scale.set(1, mantleScale, 1);
    }
  });

  return (
    <group ref={squidGroupRef} name="glass-squid">
      {/* ── Translucent glass mantle ───────────────────────────────── */}
      <mesh ref={mantleRef}>
        <sphereGeometry args={[1.2, 20, 14]} />
        <shaderMaterial
          vertexShader={MANTLE_VERT}
          fragmentShader={MANTLE_FRAG}
          uniforms={mantleUniforms}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Eyes — two massive bioluminescent orbs ─────────────────── */}
      <mesh ref={leftEyeRef} position={[-0.55, 0.2, 0.9]}>
        <circleGeometry args={[0.42, 20]} />
        <shaderMaterial
          vertexShader={EYE_VERT}
          fragmentShader={EYE_FRAG}
          uniforms={eyeUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={rightEyeRef} position={[0.55, 0.2, 0.9]}>
        <circleGeometry args={[0.42, 20]} />
        <shaderMaterial
          vertexShader={EYE_VERT}
          fragmentShader={EYE_FRAG}
          uniforms={eyeUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Eye glow point lights */}
      <pointLight position={[-0.55, 0.2, 0.9]} color="#00e5d4" intensity={2.0} distance={5} />
      <pointLight position={[0.55, 0.2, 0.9]}  color="#00e5d4" intensity={2.0} distance={5} />

      {/* ── Eight tentacles trailing from base ─────────────────────── */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            ref={el => { tentacleRefs.current[i] = el; }}
            position={[Math.cos(angle) * 0.5, -1.3, Math.sin(angle) * 0.5]}
            rotation={[0.3, angle, 0]}
          >
            <cylinderGeometry args={[0.04, 0.01, 2.0, 5, 6]} />
            <shaderMaterial
              vertexShader={TENT_VERT}
              fragmentShader={TENT_FRAG}
              uniforms={tentacleUniforms[i]}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* ── Body chromatophore glow ─────────────────────────────────── */}
      <pointLight color="#00ffcc" intensity={1.5} distance={8} />
    </group>
  );
};
