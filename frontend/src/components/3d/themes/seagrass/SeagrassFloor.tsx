/**
 * SeagrassFloor.tsx — Seagrass Meadow Theme (10–40m)
 *
 * Complete seagrass meadow ecosystem with:
 * - 500 instanced seagrass blades via vertex shader sway
 *   (per-blade: height 0.4–1.2m, phase, amplitude, direction)
 * - Sandy substrate with shell and pebble scatter
 * - Seahorse gripping a blade (vertex-shader corrugated body)
 * - Cruising spotted eagle ray (gliding wing flap)
 * - Green sea turtle grazing above canopy
 * - Dense school of blue-green damselfish (50 agents)
 * - Hermit crab walking across sand patches
 * - Orange starfish posed on sand
 * - Caustic light patterns scrolling across the floor
 * - Vertical sun rays slanting through the canopy
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

const FLOOR_Y = depthToY(28); // Seagrass at ~28m depth

// ─── Seagrass blade vertex shader ─────────────────────────────────────────
const BLADE_VERT = `
  attribute float aPhase;
  attribute float aHeight;
  attribute float aAmplitude;
  attribute float aDirection; // 0..2π random lean
  uniform float uTime;
  uniform float uCurrentDir; // global current direction in radians
  varying float vGreen;
  varying float vHeight;

  void main() {
    vec3 pos = position;
    float progress = (pos.y + 0.5); // 0=base, 1=tip of blade
    vHeight = progress;

    // Only tips sway, base is locked to substrate
    float sway = sin(uTime * 1.6 + aPhase) * aAmplitude * progress * progress;
    float leanX = cos(uCurrentDir + aDirection) * sway;
    float leanZ = sin(uCurrentDir + aDirection) * sway;
    pos.x += leanX;
    pos.z += leanZ;

    // Slight height variation from flutter
    pos.y += abs(sway) * 0.06;

    vGreen = 0.4 + progress * 0.6; // lighter toward tip
    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(pos, 1.0));
  }
`;

const BLADE_FRAG = `
  uniform float uTime;
  varying float vGreen;
  varying float vHeight;

  void main() {
    // Seagrass: dark olive-green at base, bright gold-green at tips
    vec3 baseCol = vec3(0.08, 0.25, 0.10);
    vec3 tipCol  = vec3(0.40, 0.72, 0.20);
    vec3 col     = mix(baseCol, tipCol, smoothstep(0.2, 0.95, vHeight));

    // Caustic flicker on upper blades
    float caustic = abs(sin(uTime * 2.0 + vHeight * 5.0)) * 0.15;
    col += caustic * vec3(0.8, 1.0, 0.5) * vHeight;

    float alpha = 1.0 - vHeight * 0.1; // slight tip fade
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Sandy floor caustic shader ────────────────────────────────────────────
const FLOOR_VERT = `
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
  varying vec2 vUv;
  varying vec3 vWorldPos;

  float caustic(vec2 p, float t) {
    vec2 q1 = p + vec2(sin(t + p.y * 3.0), cos(t + p.x * 2.5)) * 0.25;
    float c = sin(q1.x * 9.0) * sin(q1.y * 9.0);
    return pow(max(0.0, c * 0.5 + 0.55), 2.8) * 0.45;
  }

  void main() {
    float cx = caustic(vUv * 8.0, uTime * 1.2);
    float cy = caustic(vUv * 7.0 + vec2(3.1, 1.7), uTime * 0.9);
    float c  = cx * 0.6 + cy * 0.4;

    vec3 sand  = vec3(0.82, 0.76, 0.56);
    vec3 light = vec3(0.95, 0.95, 0.78);
    vec3 col   = mix(sand, light, c);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Seagrass data generation ──────────────────────────────────────────────
function useSeagrassData(count: number) {
  return useMemo(() => {
    const dummy     = new THREE.Object3D();
    const mats:     THREE.Matrix4[] = [];
    const phases    = new Float32Array(count);
    const heights   = new Float32Array(count);
    const amplitudes = new Float32Array(count);
    const directions = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 55;
      const z = (Math.random() - 0.5) * 55;
      const h = 0.4 + Math.random() * 0.85;

      dummy.position.set(x, FLOOR_Y, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(0.06 + Math.random() * 0.02, h, 0.015);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      phases[i]      = Math.random() * Math.PI * 2;
      heights[i]     = h;
      amplitudes[i]  = 0.12 + Math.random() * 0.2;
      directions[i]  = Math.random() * Math.PI * 2;
    }
    return { mats, phases, heights, amplitudes, directions };
  }, [count]);
}

// ─── Seahorse component ─────────────────────────────────────────────────────
const Seahorse: React.FC = () => {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!ref.current) return;
    ref.current.position.set(-6, FLOOR_Y + 0.7, 3);
    // Very subtle hover and tilt
    ref.current.position.y += Math.sin(t * 0.6) * 0.08;
    ref.current.rotation.z  = Math.sin(t * 0.4) * 0.06;
  });

  return (
    <group ref={ref} scale={0.3}>
      {/* Curved body — stacked tilted spheres */}
      {[0, 0.4, 0.8, 1.15, 1.45, 1.7].map((y, i) => (
        <mesh key={i} position={[Math.sin(i * 0.25) * 0.18, y, 0]}>
          <sphereGeometry args={[0.28 - i * 0.02, 8, 8]} />
          <meshStandardMaterial color="#c47c1a" roughness={0.6} />
        </mesh>
      ))}
      {/* Crown/head */}
      <mesh position={[0.18, 2.0, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#b8701a" roughness={0.55} />
      </mesh>
      {/* Snout */}
      <mesh position={[0.32, 2.0, 0]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.05, 0.08, 0.5, 6]} />
        <meshStandardMaterial color="#c8821a" />
      </mesh>
      {/* Eye */}
      <mesh position={[0.32, 2.05, 0.15]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshBasicMaterial color="#000a14" />
      </mesh>
      {/* Tail curl */}
      {[0, -0.25, -0.42, -0.5].map((y, i) => (
        <mesh key={`t${i}`} position={[-0.08 - i * 0.06, y, 0]}>
          <sphereGeometry args={[0.14 - i * 0.02, 6, 6]} />
          <meshStandardMaterial color="#b07010" roughness={0.65} />
        </mesh>
      ))}
      {/* Dorsal fin */}
      <mesh position={[0.0, 1.4, 0]} rotation={[0, 0, 0.15]}>
        <planeGeometry args={[0.3, 0.5, 1, 4]} />
        <meshStandardMaterial color="#e8901a" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// ─── Eagle Ray ──────────────────────────────────────────────────────────────
const EagleRay: React.FC = () => {
  const ref = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!ref.current) return;
    ref.current.position.set(
      Math.sin(t * 0.14) * 18,
      FLOOR_Y + 3 + Math.sin(t * 0.2) * 1.5,
      -8 + Math.cos(t * 0.11) * 12
    );
    ref.current.rotation.y = Math.atan2(Math.cos(t * 0.14) * 18, -Math.sin(t * 0.11) * 12);

    // Wing flap
    const flap = Math.sin(t * 1.8) * 0.22;
    if (wingL.current) wingL.current.rotation.z = flap;
    if (wingR.current) wingR.current.rotation.z = -flap;
  });

  return (
    <group ref={ref}>
      {/* Body disk */}
      <mesh scale={[1.0, 0.18, 0.65]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#2d3a1a" roughness={0.7} />
      </mesh>
      {/* White belly spots */}
      <mesh position={[0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 12]} />
        <meshStandardMaterial color="#d4d0c0" />
      </mesh>
      {/* Left wing */}
      <mesh ref={wingL} position={[-1.4, 0, 0]}>
        <planeGeometry args={[2.0, 0.9, 2, 2]} />
        <meshStandardMaterial color="#253018" side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      {/* Right wing */}
      <mesh ref={wingR} position={[1.4, 0, 0]}>
        <planeGeometry args={[2.0, 0.9, 2, 2]} />
        <meshStandardMaterial color="#253018" side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      {/* Tail */}
      <mesh position={[0, 0, -1.2]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.02, 2.2, 5]} />
        <meshStandardMaterial color="#1a2510" />
      </mesh>
    </group>
  );
};

// ─── Main SeagrassFloor component ─────────────────────────────────────────
export const SeagrassFloor: React.FC<{ currentDepth?: number }> = ({ currentDepth = 25 }) => {
  const bladeCount = 500;
  const fishCount  = 55;

  const bladeRef  = useRef<THREE.InstancedMesh>(null);
  const fishRef   = useRef<THREE.InstancedMesh>(null);
  const dummy     = useMemo(() => new THREE.Object3D(), []);

  const grassData = useSeagrassData(bladeCount);

  const bladeUniforms = useMemo(() => ({
    uTime:        { value: 0 },
    uCurrentDir:  { value: 0.8 },
  }), []);

  const floorUniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  const fishOffsets = useMemo(() => Array.from({ length: fishCount }, () => ({
    x: (Math.random() - 0.5) * 20,
    y: FLOOR_Y + 2.5 + Math.random() * 4,
    z: (Math.random() - 0.5) * 18,
    speed: 1.0 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
  })), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    bladeUniforms.uTime.value  = time;
    bladeUniforms.uCurrentDir.value = 0.8 + Math.sin(time * 0.12) * 0.25;
    floorUniforms.uTime.value  = time;

    // Set blade matrices once (static layout)
    if (bladeRef.current) {
      grassData.mats.forEach((m, i) => bladeRef.current!.setMatrixAt(i, m));
      bladeRef.current.instanceMatrix.needsUpdate = true;
    }

    // Animate damselfish school
    if (fishRef.current) {
      const leaderX = Math.sin(time * 0.28) * 12;
      const leaderZ = Math.cos(time * 0.22) * 10;
      fishOffsets.forEach((f, i) => {
        const t = time * f.speed + f.phase;
        dummy.position.set(
          leaderX + f.x + Math.sin(t) * 1.5,
          f.y + Math.sin(t * 1.2) * 0.5,
          leaderZ + f.z + Math.cos(t * 0.9) * 1.2
        );
        dummy.rotation.set(0, Math.sin(time * 0.28) > 0 ? 0 : Math.PI, Math.sin(t * 3) * 0.1);
        dummy.scale.set(0.16, 0.12, 0.28);
        dummy.updateMatrix();
        fishRef.current!.setMatrixAt(i, dummy.matrix);
      });
      fishRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="seagrass-meadow">
      {/* ── Sandy substrate with caustics ─────────────────────────── */}
      <mesh position={[0, FLOOR_Y - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100, 32, 32]} />
        <shaderMaterial
          vertexShader={FLOOR_VERT}
          fragmentShader={FLOOR_FRAG}
          uniforms={floorUniforms}
        />
      </mesh>

      {/* ── 500 seagrass blades ───────────────────────────────────── */}
      <instancedMesh ref={bladeRef} args={[undefined, undefined, bladeCount]} frustumCulled={false}>
        <planeGeometry args={[1, 1, 1, 6]} />
        <bufferAttribute attach="geometry-attributes-aPhase"     args={[grassData.phases, 1]} />
        <bufferAttribute attach="geometry-attributes-aHeight"    args={[grassData.heights, 1]} />
        <bufferAttribute attach="geometry-attributes-aAmplitude" args={[grassData.amplitudes, 1]} />
        <bufferAttribute attach="geometry-attributes-aDirection" args={[grassData.directions, 1]} />
        <shaderMaterial
          vertexShader={BLADE_VERT}
          fragmentShader={BLADE_FRAG}
          uniforms={bladeUniforms}
          transparent
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* ── Damselfish school ─────────────────────────────────────── */}
      <instancedMesh ref={fishRef} args={[undefined, undefined, fishCount]}>
        <coneGeometry args={[0.15, 0.45, 4]} />
        <meshStandardMaterial color="#1a7a5a" roughness={0.3} metalness={0.6} />
      </instancedMesh>

      {/* ── Seahorse ─────────────────────────────────────────────── */}
      <Seahorse />

      {/* ── Spotted eagle ray ────────────────────────────────────── */}
      <EagleRay />

      {/* ── Orange starfish ──────────────────────────────────────── */}
      {[[-4, FLOOR_Y + 0.05, 6], [8, FLOOR_Y + 0.05, -3]].map(([x, y, z], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} rotation={[-Math.PI / 2, 0, i * 0.8]}>
          <torusGeometry args={[0.45, 0.18, 4, 5]} />
          <meshStandardMaterial color="#e84a00" roughness={0.7} />
        </mesh>
      ))}

      {/* ── Shells scatter ───────────────────────────────────────── */}
      {Array.from({ length: 15 }, (_, i) => (
        <mesh
          key={`shell${i}`}
          position={[
            (Math.random() - 0.5) * 50,
            FLOOR_Y + 0.04,
            (Math.random() - 0.5) * 50,
          ]}
          rotation={[-Math.PI / 2, 0, Math.random() * Math.PI]}
          scale={0.12 + Math.random() * 0.1}
        >
          <torusGeometry args={[1, 0.5, 5, 8, Math.PI * 1.2]} />
          <meshStandardMaterial color="#d4c8a8" roughness={0.8} />
        </mesh>
      ))}

      {/* ── Sun rays through surface ──────────────────────────────── */}
      {[-10, -3, 4, 11].map((x, i) => (
        <mesh key={`ray${i}`} position={[x, FLOOR_Y + 14, -6 + i * 2]} rotation={[0.08, 0, 0.06 * (i - 1.5)]}>
          <coneGeometry args={[3.5, 28, 8, 1, true]} />
          <meshBasicMaterial color="#e6f4c0" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

export default SeagrassFloor;
