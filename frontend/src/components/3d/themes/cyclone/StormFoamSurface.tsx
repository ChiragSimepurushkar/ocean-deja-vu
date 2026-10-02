/**
 * StormFoamSurface.tsx — Cyclone Theme (0–200m)
 *
 * Complete tropical cyclone underwater experience:
 * - Churning white foam surface layer with vertex-shader violent waves
 * - Grey-green turbid fog shift
 * - Horizontal particle shear (debris, bubbles ripped sideways)
 * - Camera shake driven by cycloneShake from env state
 * - Rotating flow field visible in particle drift
 * - Scattered fish (pushed deeper, stressed)
 * - Dense bubble curtains from breaking waves
 * - Thunder flash (brief white light pulse)
 * - Debris particles: leaves, wood fragments, sediment
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

const SURFACE_Y = depthToY(0);

// ─── Storm wave surface shader ──────────────────────────────────────────────
const STORM_SURF_VERT = `
  uniform float uTime;
  uniform float uIntensity; // 0..1 storm power
  varying vec2  vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Multi-frequency storm waves
    float w1 = sin(pos.x * 0.8 + uTime * 3.5) * 1.8 * uIntensity;
    float w2 = cos(pos.z * 1.2 + uTime * 4.2) * 1.2 * uIntensity;
    float w3 = sin((pos.x + pos.z) * 0.5 + uTime * 5.0) * 0.6 * uIntensity;
    float w4 = cos(pos.x * 2.0 - uTime * 6.0) * 0.3 * uIntensity; // high-freq chop
    pos.y += w1 + w2 + w3 + w4;
    vWave = (w1 + w2) * 0.25;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const STORM_SURF_FRAG = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2  vUv;
  varying float vWave;

  void main() {
    // Foam is whiter on wave crests
    float foam = smoothstep(0.0, 0.8, vWave);
    vec3 base  = vec3(0.45, 0.55, 0.50); // grey-green storm water
    vec3 white = vec3(0.90, 0.92, 0.88); // foam crests
    vec3 col   = mix(base, white, foam * uIntensity);

    // Foam streaks
    float streak = sin(vUv.x * 40.0 + uTime * 8.0 + vUv.y * 15.0) * 0.5 + 0.5;
    streak = pow(streak, 5.0) * uIntensity * 0.3;
    col += streak;

    float alpha = 0.65 + foam * 0.3;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Debris particle shader ─────────────────────────────────────────────────
const DEBRIS_VERT = `
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aType; // 0=bubble, 0.5=sediment, 1=leaf

  uniform float uTime;
  uniform float uShear; // horizontal shear speed

  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec3 pos = position;

    // Horizontal shear — everything blown sideways
    float t = uTime * aSpeed + aPhase;
    pos.x += uShear * sin(t * 0.5 + aPhase) * 3.0;
    pos.z += uShear * cos(t * 0.4 + aPhase * 0.7) * 2.0;

    // Vertical turbulence
    pos.y += sin(t * 2.0 + aPhase) * 1.5 + cos(t * 3.0) * 0.5;

    // Type-based color
    if (aType < 0.33) {
      vColor = vec3(0.85, 0.90, 0.95); // bubble (white)
    } else if (aType < 0.66) {
      vColor = vec3(0.40, 0.35, 0.25); // sediment (brown)
    } else {
      vColor = vec3(0.20, 0.35, 0.12); // leaf debris (green)
    }

    vAlpha = 0.5 + sin(t * 1.5) * 0.2;
    gl_PointSize = 3.0 + aType * 4.0;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
  }
`;

const DEBRIS_FRAG = `
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float falloff = 1.0 - r * r;
    gl_FragColor = vec4(vColor * falloff, vAlpha * falloff);
  }
`;

// ─── Dense bubble curtain shader ────────────────────────────────────────────
const BUBBLE_CURTAIN_VERT = `
  attribute float aPhase;
  uniform float uTime;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float t = uTime * 1.5 + aPhase;
    // Rapid rising bubbles from breaking waves
    pos.y += mod(t * 4.0, 20.0) - 10.0;
    pos.x += sin(t * 3.0 + aPhase) * 1.5;
    pos.z += cos(t * 2.5 + aPhase) * 1.0;

    float age = mod(t * 4.0, 20.0) / 20.0;
    vAlpha = (1.0 - age) * 0.6;
    gl_PointSize = 3.0 + (1.0 - age) * 5.0;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
  }
`;

const BUBBLE_CURTAIN_FRAG = `
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float rim = smoothstep(0.6, 1.0, r);
    vec3 col = vec3(0.80, 0.85, 0.92);
    gl_FragColor = vec4(col, vAlpha * (0.3 + rim * 0.7));
  }
`;

// ─── Stressed scattered fish ────────────────────────────────────────────────
const StressedFish: React.FC<{ depthY: number }> = ({ depthY }) => {
  const count = 20;
  const ref   = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data  = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 30,
    y: depthY - 8 - Math.random() * 20, // pushed deeper
    z: (Math.random() - 0.5) * 25,
    speed: 1.8 + Math.random() * 1.2, // faster, erratic
    phase: Math.random() * Math.PI * 2,
  })), [depthY]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    data.forEach((f, i) => {
      const ft = t * f.speed + f.phase;
      dummy.position.set(
        f.x + Math.sin(ft * 0.8) * 5 + Math.sin(ft * 3.0) * 0.5, // erratic
        f.y + Math.sin(ft * 1.2) * 1.5,
        f.z + Math.cos(ft * 0.7) * 4 + Math.cos(ft * 2.5) * 0.4
      );
      dummy.rotation.set(0, ft * 0.8, Math.sin(ft * 5) * 0.15);
      dummy.scale.set(0.3, 0.12, 0.65);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <coneGeometry args={[0.15, 0.5, 4]} />
      <meshStandardMaterial color="#4b5563" roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
};

// ─── Main StormFoamSurface ──────────────────────────────────────────────────
export const StormFoamSurface: React.FC<{ cycloneIntensity?: number }> = ({
  cycloneIntensity = 0.85,
}) => {
  const depthY     = SURFACE_Y;
  const surfRef    = useRef<THREE.Mesh>(null);
  const debrisRef  = useRef<THREE.Points>(null);
  const bubbleRef  = useRef<THREE.Points>(null);
  const thunderRef = useRef<THREE.PointLight>(null);

  const surfUniforms = useMemo(() => ({
    uTime:      { value: 0 },
    uIntensity: { value: cycloneIntensity },
  }), [cycloneIntensity]);

  // Debris particles
  const debrisCount = 300;
  const { debrisGeo, debrisUniforms } = useMemo(() => {
    const pos    = new Float32Array(debrisCount * 3);
    const phases = new Float32Array(debrisCount);
    const speeds = new Float32Array(debrisCount);
    const types  = new Float32Array(debrisCount);

    for (let i = 0; i < debrisCount; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = depthY - Math.random() * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.8 + Math.random() * 0.8;
      types[i]  = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aType',    new THREE.BufferAttribute(types, 1));

    return {
      debrisGeo: geo,
      debrisUniforms: { uTime: { value: 0 }, uShear: { value: cycloneIntensity * 2.5 } },
    };
  }, [debrisCount, depthY, cycloneIntensity]);

  // Bubble curtain particles
  const bubbleCount = 200;
  const { bubbleGeo, bubbleUniforms } = useMemo(() => {
    const pos    = new Float32Array(bubbleCount * 3);
    const phases = new Float32Array(bubbleCount);

    for (let i = 0; i < bubbleCount; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = depthY - Math.random() * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));

    return {
      bubbleGeo: geo,
      bubbleUniforms: { uTime: { value: 0 } },
    };
  }, [bubbleCount, depthY]);

  const debrisMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: DEBRIS_VERT, fragmentShader: DEBRIS_FRAG,
    uniforms: debrisUniforms, transparent: true, depthWrite: false,
  }), [debrisUniforms]);

  const bubbleMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: BUBBLE_CURTAIN_VERT, fragmentShader: BUBBLE_CURTAIN_FRAG,
    uniforms: bubbleUniforms, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [bubbleUniforms]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    surfUniforms.uTime.value    = time;
    debrisUniforms.uTime.value  = time;
    bubbleUniforms.uTime.value  = time;

    // Thunder flash: random intense white burst
    if (thunderRef.current) {
      const flash = Math.random() < 0.003 ? 25 : 0;
      thunderRef.current.intensity = flash;
    }
  });

  return (
    <group name="cyclone-storm">
      {/* ── Churning storm surface ───────────────────────────────── */}
      <mesh ref={surfRef} position={[0, depthY + 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[130, 130, 40, 40]} />
        <shaderMaterial
          vertexShader={STORM_SURF_VERT}
          fragmentShader={STORM_SURF_FRAG}
          uniforms={surfUniforms}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Debris particle field ────────────────────────────────── */}
      <points ref={debrisRef} geometry={debrisGeo} material={debrisMat} />

      {/* ── Bubble curtains ──────────────────────────────────────── */}
      <points ref={bubbleRef} geometry={bubbleGeo} material={bubbleMat} />

      {/* ── Stressed scattered fish ──────────────────────────────── */}
      <StressedFish depthY={depthY} />

      {/* ── Thunder flash light ──────────────────────────────────── */}
      <pointLight ref={thunderRef} position={[0, depthY + 20, 0]} color="#ffffff" intensity={0} distance={80} />

      {/* ── Storm ambient: grey-green dim ────────────────────────── */}
      <ambientLight color="#5b6b6b" intensity={0.6} />
      <directionalLight position={[0, 15, -10]} color="#9ca3af" intensity={0.5} />
    </group>
  );
};
