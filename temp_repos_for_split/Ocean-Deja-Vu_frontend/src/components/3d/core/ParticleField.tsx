import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from './depthScale';

export type ParticleProfile =
  | 'snow'
  | 'bubbles'
  | 'plankton'
  | 'sediment'
  | 'mineral'
  | 'vent'
  | 'methane'
  | 'biolum';

interface ParticleFieldProps {
  currentDepth: number;
  profile?: ParticleProfile;
  count?: number;
  color?: string;
  size?: number;
  speedMultiplier?: number;
  swirl?: number;
}

export const ParticleField: React.FC<ParticleFieldProps> = ({
  currentDepth,
  profile = 'snow',
  count = 2000,
  color,
  size,
  speedMultiplier = 1.0,
  swirl = 0.0,
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const particleColor = useMemo(() => {
    if (color) return new THREE.Color(color);
    switch (profile) {
      case 'bubbles': return new THREE.Color('#e0f2fe');
      case 'plankton': return new THREE.Color('#86efac');
      case 'sediment': return new THREE.Color('#94a3b8');
      case 'mineral': return new THREE.Color('#f59e0b');
      case 'vent': return new THREE.Color('#334155');
      case 'methane': return new THREE.Color('#ccfbf1');
      case 'biolum': return new THREE.Color('#38bdf8');
      case 'snow':
      default: return new THREE.Color('#bae6fd');
    }
  }, [profile, color]);

  const { positions, randoms, scales } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    const scl = new Float32Array(count);

    const radius = 25;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * radius * 2;
      pos[i * 3 + 1] = (Math.random() - 0.5) * radius * 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * radius * 2;

      rnd[i * 4 + 0] = Math.random();
      rnd[i * 4 + 1] = Math.random();
      rnd[i * 4 + 2] = Math.random();
      rnd[i * 4 + 3] = Math.random();

      scl[i] = 0.6 + Math.random() * 0.8;
    }

    return { positions: pos, randoms: rnd, scales: scl };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCameraY: { value: 0 },
      uColor: { value: particleColor },
      uBaseSize: { value: size || (profile === 'bubbles' ? 7.0 : profile === 'biolum' ? 5.5 : 4.0) },
      uProfile: {
        value:
          profile === 'bubbles' ? 1 :
          profile === 'biolum' ? 2 :
          profile === 'vent' ? 3 :
          profile === 'methane' ? 4 :
          profile === 'sediment' ? 5 : 0
      },
      uSpeed: { value: speedMultiplier },
      uSwirl: { value: swirl },
      uBoxSize: { value: 50.0 },
    }),
    [particleColor, size, profile, speedMultiplier, swirl]
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    materialRef.current.uniforms.uCameraY.value = depthToY(currentDepth);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 4]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={profile === 'biolum' ? THREE.AdditiveBlending : THREE.NormalBlending}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          uniform float uCameraY;
          uniform float uBaseSize;
          uniform int uProfile;
          uniform float uSpeed;
          uniform float uSwirl;
          uniform float uBoxSize;

          attribute vec4 aRandom;
          attribute float aScale;

          varying float vAlpha;
          varying vec4 vRandom;

          void main() {
            vRandom = aRandom;
            vec3 pos = position;

            // GPU motion profile
            if (uProfile == 1) {
              // Bubbles: rising upward with wobble
              float rise = mod((uTime * 4.5 * uSpeed * aRandom.x) + aRandom.y * uBoxSize, uBoxSize);
              pos.y = -uBoxSize * 0.5 + rise;
              pos.x += sin(uTime * 2.0 + aRandom.z * 6.28) * 0.45;
              pos.z += cos(uTime * 1.8 + aRandom.w * 6.28) * 0.45;
            } else if (uProfile == 3) {
              // Vent smoke: upward expanding plume
              float rise = mod((uTime * 3.0 * uSpeed) + aRandom.y * uBoxSize, uBoxSize);
              pos.y = -uBoxSize * 0.5 + rise;
              float expand = (pos.y + uBoxSize * 0.5) / uBoxSize;
              pos.x *= (1.0 + expand * 1.5);
              pos.z *= (1.0 + expand * 1.5);
            } else {
              // Marine snow / Plankton / Biolum: gentle downward settling drift
              float fall = mod((-uTime * 1.2 * uSpeed * (0.5 + aRandom.y * 0.5)) + aRandom.z * uBoxSize, uBoxSize);
              pos.y = uBoxSize * 0.5 - fall;
              pos.x += sin(uTime * 0.6 + aRandom.x * 6.28) * 0.35;
              pos.z += cos(uTime * 0.5 + aRandom.y * 6.28) * 0.35;
            }

            // Vortex swirl flow
            if (uSwirl > 0.01) {
              float angle = uTime * 0.4 * uSwirl + length(pos.xz) * 0.05;
              float ca = cos(angle);
              float sa = sin(angle);
              pos.xz = mat2(ca, -sa, sa, ca) * pos.xz;
            }

            // Wrap around camera Y
            pos.y += uCameraY;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            // Attenuation
            gl_PointSize = (uBaseSize * aScale * 250.0) / -mvPosition.z;
            vAlpha = smoothstep(2.0, 15.0, -mvPosition.z) * (1.0 - smoothstep(45.0, 60.0, -mvPosition.z));
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform int uProfile;
          varying float vAlpha;
          varying vec4 vRandom;

          void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            if (dist > 0.5) discard;

            float intensity = 1.0;
            if (uProfile == 1) {
              // Bubble rim sprite
              float rim = smoothstep(0.2, 0.45, dist) * (1.0 - smoothstep(0.45, 0.5, dist));
              intensity = rim * 1.8 + (1.0 - dist * 2.0) * 0.3;
            } else if (uProfile == 2) {
              // Bioluminescent glow pulse
              intensity = pow(1.0 - dist * 2.0, 1.6);
            } else {
              // Soft gaussian particle
              intensity = pow(1.0 - dist * 2.0, 1.2);
            }

            gl_FragColor = vec4(uColor, intensity * vAlpha * (0.6 + vRandom.x * 0.4));
          }
        `}
      />
    </points>
  );
};
