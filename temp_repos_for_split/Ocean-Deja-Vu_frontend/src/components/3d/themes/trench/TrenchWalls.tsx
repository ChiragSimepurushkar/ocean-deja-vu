/**
 * TrenchWalls.tsx — Deep Ocean Trench Theme (3000–6000m)
 *
 * Dramatic vertical hadal canyon — the deepest place on Earth.
 * Features:
 * - Two towering noise-displaced rock walls creating a narrow V-canyon
 * - Terraced ledges with encrusted filter feeders (pink/white stalked)
 * - Overhanging rock shelves casting deep shadow
 * - Narrow slit of faint blue light visible far above (the open ocean)
 * - Noise-roughened trench floor with fine sediment
 * - Hadal amphipods (giant for their kind, ~5cm) scattered on floor
 * - Snailfish (supaichiensis) — translucent, slow-drifting
 * - Hadal sea cucumbers — pale elongated
 * - Light comes only from flashlight — absolute darkness beyond reach
 * - Mineral seep veins on walls (faint emissive blue-green streaks)
 * - Pressure sensation: claustrophobic narrowing perspective
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TRENCH_CONFIG } from './Config';
import { createNoise2D } from 'simplex-noise';

// ─── Wall surface shader ────────────────────────────────────────────────────
const WALL_VERT = `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WALL_FRAG = `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    // Dark basalt with subtle layered strata
    vec3 base = vec3(0.04, 0.05, 0.08);
    float strata = sin(vWorldPos.y * 1.5) * 0.02 + sin(vWorldPos.y * 4.2) * 0.01;
    vec3 col = base + strata;

    // Mineral seep veins: faint emissive blue-green streaks
    float vein = smoothstep(0.49, 0.5, sin(vWorldPos.y * 8.0 + vWorldPos.x * 2.5));
    vein *= smoothstep(0.48, 0.5, sin(vWorldPos.z * 5.0 + vWorldPos.y * 1.5));
    col += vec3(0.02, 0.08, 0.12) * vein * 2.5;

    // Rough grain texture
    float grain = hash(floor(vWorldPos.xz * 30.0)) * 0.015;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Snailfish shader (translucent pale) ───────────────────────────────────
const SNAILFISH_FRAG = `
  varying vec3 vNormal;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
    vec3 col = vec3(0.72, 0.68, 0.78) * (0.2 + rim * 0.6);
    float alpha = 0.35 + rim * 0.4;
    gl_FragColor = vec4(col, alpha);
  }
`;

const SNAILFISH_VERT = `
  uniform float uTime;
  varying vec3 vNormal;
  void main() {
    vec3 pos = position;
    // Gentle body undulation
    float tail = clamp((pos.z + 0.5), 0.0, 1.0);
    pos.x += sin(uTime * 2.0 + pos.z * 3.0) * 0.08 * tail;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// ─── Wall geometry with noise displacement ─────────────────────────────────
function createTrenchWall(
  width: number, height: number,
  xOffset: number, facing: number,
  noise2D: (x: number, y: number) => number
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, 24, 40);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Roughen the surface with noise-based ledges and overhangs
    const n1 = noise2D(x * 0.1, y * 0.05) * 4.0;
    const n2 = noise2D(x * 0.3, y * 0.15) * 1.5;
    // Terrace effect: step function on vertical axis
    const terrace = Math.floor(y * 0.08) * 0.5;
    const overhang = Math.max(0, noise2D(x * 0.2, y * 0.04)) * 2.5;
    pos.setZ(i, n1 + n2 + terrace * 0.3 + overhang * facing);
  }
  geo.computeVertexNormals();
  return geo;
}

// ─── Stalked filter feeder on ledge ────────────────────────────────────────
const LedgeFeeder: React.FC<{ position: [number, number, number] }> = ({ position: pos }) => (
  <group position={pos}>
    {/* Stalk */}
    <mesh>
      <cylinderGeometry args={[0.02, 0.03, 0.35, 4]} />
      <meshStandardMaterial color="#c4b8a8" roughness={0.8} />
    </mesh>
    {/* Crown (filter fan) */}
    <mesh position={[0, 0.2, 0]}>
      <sphereGeometry args={[0.08, 6, 6, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
      <meshStandardMaterial color="#e8a0b0" roughness={0.6} transparent opacity={0.75} side={THREE.DoubleSide} />
    </mesh>
  </group>
);

// ─── Hadal Snailfish ────────────────────────────────────────────────────────
const HadalSnailfish: React.FC<{ startPos: [number, number, number] }> = ({ startPos }) => {
  const ref = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    uniforms.uTime.value = t;
    if (!ref.current) return;
    ref.current.position.set(
      startPos[0] + Math.sin(t * 0.08) * 3,
      startPos[1] + Math.sin(t * 0.12) * 0.8,
      startPos[2] + Math.cos(t * 0.06) * 4
    );
    ref.current.rotation.y = Math.atan2(Math.cos(t * 0.08), -Math.sin(t * 0.06));
  });

  return (
    <group ref={ref} scale={0.6}>
      <mesh scale={[0.4, 0.18, 1.2]}>
        <sphereGeometry args={[1, 10, 8]} />
        <shaderMaterial
          vertexShader={SNAILFISH_VERT}
          fragmentShader={SNAILFISH_FRAG}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Pectoral fin */}
      <mesh position={[0, -0.05, -0.3]} rotation={[0.2, 0, 0.6]}>
        <planeGeometry args={[0.35, 0.2, 2, 2]} />
        <meshStandardMaterial color="#b0a8c0" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Eye */}
      <mesh position={[0.12, 0.06, 0.8]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshBasicMaterial color="#001020" />
      </mesh>
    </group>
  );
};

// ─── Main TrenchWalls ───────────────────────────────────────────────────────
export const TrenchWalls: React.FC = () => {
  const floorY  = TRENCH_CONFIG.floorY;
  const noise2D = useMemo(() => createNoise2D(), []);

  const westWall = useMemo(() => createTrenchWall(160, 120, -22, -1, noise2D), [noise2D]);
  const eastWall = useMemo(() => createTrenchWall(160, 120,  22,  1, noise2D), [noise2D]);

  const wallUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const amphiCount = 15;
  const amphiRef   = useRef<THREE.InstancedMesh>(null);
  const dummy      = useMemo(() => new THREE.Object3D(), []);

  const amphiData = useMemo(() => Array.from({ length: amphiCount }, () => ({
    x: (Math.random() - 0.5) * 25,
    z: (Math.random() - 0.5) * 80,
    speed: 0.15 + Math.random() * 0.2,
    phase: Math.random() * Math.PI * 2,
  })), []);

  // Ledge feeder positions — scattered on wall surfaces
  const feederPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 30; i++) {
      const side = i % 2 === 0 ? -17 : 17;
      const y = floorY + 10 + Math.random() * 80;
      const z = (Math.random() - 0.5) * 100;
      positions.push([side + (Math.random() - 0.5) * 2, y, z]);
    }
    return positions;
  }, [floorY]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    wallUniforms.uTime.value = time;

    if (amphiRef.current) {
      amphiData.forEach((a, i) => {
        const t = time * a.speed + a.phase;
        dummy.position.set(
          a.x + Math.sin(t * 0.3) * 0.5,
          floorY + 0.06,
          a.z + Math.cos(t * 0.25) * 0.6
        );
        dummy.scale.setScalar(0.12); // Giant hadal amphipods (~5cm scaled)
        dummy.rotation.set(0, t * 0.3, 0);
        dummy.updateMatrix();
        amphiRef.current!.setMatrixAt(i, dummy.matrix);
      });
      amphiRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="trench-walls">
      {/* ── Narrow trench floor ──────────────────────────────────── */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[35, 160, 12, 32]} />
        <meshStandardMaterial color="#040608" roughness={0.96} />
      </mesh>

      {/* ── West canyon wall ──────────────────────────────────────── */}
      <mesh
        geometry={westWall}
        position={[-22, floorY + 60, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <shaderMaterial
          vertexShader={WALL_VERT}
          fragmentShader={WALL_FRAG}
          uniforms={wallUniforms}
        />
      </mesh>

      {/* ── East canyon wall ──────────────────────────────────────── */}
      <mesh
        geometry={eastWall}
        position={[22, floorY + 60, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <shaderMaterial
          vertexShader={WALL_VERT}
          fragmentShader={WALL_FRAG}
          uniforms={wallUniforms}
        />
      </mesh>

      {/* ── Overhanging rock ledges ───────────────────────────────── */}
      {[-30, 0, 30, 60].map((z, i) => (
        <group key={`ledge${i}`}>
          <mesh position={[-16, floorY + 20 + i * 18, z]} scale={[6, 1.5, 10]}>
            <boxGeometry />
            <meshStandardMaterial color="#060a12" roughness={0.95} />
          </mesh>
          <mesh position={[16, floorY + 30 + i * 15, z + 5]} scale={[5, 1.8, 8]}>
            <boxGeometry />
            <meshStandardMaterial color="#050910" roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* ── Stalked filter feeders on ledges ──────────────────────── */}
      {feederPositions.map((p, i) => <LedgeFeeder key={`f${i}`} position={p} />)}

      {/* ── Hadal snailfish ──────────────────────────────────────── */}
      <HadalSnailfish startPos={[2, floorY + 3, -10]} />
      <HadalSnailfish startPos={[-5, floorY + 5, 20]} />

      {/* ── Hadal amphipods ──────────────────────────────────────── */}
      <instancedMesh ref={amphiRef} args={[undefined, undefined, amphiCount]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshStandardMaterial color="#c8c0b0" roughness={0.85} />
      </instancedMesh>

      {/* ── Hadal sea cucumbers ──────────────────────────────────── */}
      {[[-4, 15], [3, -20], [-2, 40]].map(([x, z], i) => (
        <mesh key={`cuc${i}`} position={[x, floorY + 0.08, z]} rotation={[0, i * 1.5, 0]}>
          <capsuleGeometry args={[0.08, 0.4, 6, 8]} />
          <meshStandardMaterial color="#c4b8a0" roughness={0.9} transparent opacity={0.75} />
        </mesh>
      ))}

      {/* ── Distant blue slit of light above (open ocean sky) ────── */}
      <mesh position={[0, floorY + 120, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 160]} />
        <meshBasicMaterial color="#0c4a6e" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
