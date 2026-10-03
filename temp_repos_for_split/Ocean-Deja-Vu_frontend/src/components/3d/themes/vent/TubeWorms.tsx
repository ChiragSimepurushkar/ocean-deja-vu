/**
 * TubeWorms.tsx — Hydrothermal Vent Theme
 *
 * Riftia pachyptila — giant tube worms
 * Features:
 * - White chitinous tube shaft (elongated tapered cylinders, 1-2m tall)
 * - Bright red/crimson feathery crown (plume) at top — vertex-shader sway
 * - Instanced: 80 worms in dense clusters around vent bases
 * - Sway driven by vent current (upwelling flow uniform)
 * - Two color morphs: deep crimson (hemoglobin-rich), pale pink (young)
 * - Vent shrimp swarm: 40 translucent bright-white shrimp climbing tubes
 * - White hairy bacterial mat coverage at base (instanced disc planes)
 * - Vent crab: 2 dark stalked-eye crabs patrolling at floor level
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VENT_CONFIG } from './Config';
import { depthToY } from '../../core/depthScale';

// ─── Tube worm tube shaft — white chitin ─────────────────────────────────
const TUBE_VERT = `
  uniform float uTime;
  uniform float uFlow; // upwelling flow strength
  attribute float aPhase;
  attribute float aHeight;
  varying float vY;

  void main() {
    vec3 pos = position;
    vY = (pos.y + 0.5);
    // Sway from vent thermal current — stronger at tip
    float sway = sin(uTime * 1.8 + aPhase) * uFlow * 0.08 * vY;
    pos.x += sway;
    pos.z += cos(uTime * 1.4 + aPhase + 0.5) * uFlow * 0.05 * vY;

    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(pos, 1.0));
  }
`;

const TUBE_FRAG = `
  varying float vY;
  void main() {
    // Tube: bright chalk white, slightly warm at base (sulphur stain)
    vec3 base  = vec3(0.92, 0.90, 0.86);
    vec3 stain = vec3(0.82, 0.76, 0.55); // yellow sulphur tinge
    vec3 col   = mix(stain, base, smoothstep(0.0, 0.25, vY));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Crown plume shader — crimson feathery fan ────────────────────────────
const CROWN_VERT = `
  uniform float uTime;
  uniform float uFlow;
  attribute float aPhase;
  varying float vR;
  void main() {
    vec3 pos = position;
    // Radial feather sway
    vec2 center = vec2(0.0);
    vec2 dir = pos.xz - center;
    float r = length(dir);
    vR = r;
    float sway = sin(uTime * 2.2 + aPhase + r * 3.0) * uFlow * 0.12 * r;
    pos.x += sway;
    pos.z += cos(uTime * 1.9 + aPhase + r * 2.5) * uFlow * 0.08 * r;
    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(pos, 1.0));
  }
`;

const CROWN_FRAG = `
  varying float vR;
  void main() {
    // Deep crimson at center, pale pink at feather tips
    vec3 center = vec3(0.72, 0.04, 0.04);
    vec3 tip    = vec3(0.95, 0.50, 0.55);
    vec3 col = mix(center, tip, smoothstep(0.0, 0.8, vR));
    float alpha = 0.9 - vR * 0.3;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Shrimp shader — translucent white ───────────────────────────────────
const SHRIMP_VERT = `
  uniform float uTime;
  attribute float aPhase;
  attribute float aTubeX;
  attribute float aTubeZ;
  varying float vPhase;
  void main() {
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
  }
`;

const SHRIMP_FRAG = `
  uniform float uTime;
  varying float vPhase;
  void main() {
    float shimmer = sin(uTime * 4.0 + vPhase) * 0.3 + 0.7;
    vec3 col = vec3(0.88, 0.85, 0.82) * shimmer;
    gl_FragColor = vec4(col, 0.72);
  }
`;

// ─── Main TubeWorms component ─────────────────────────────────────────────
export const TubeWorms: React.FC<{ ventFlow?: number }> = ({ ventFlow = 1.0 }) => {
  const floorYNum = typeof VENT_CONFIG.floorY === 'number' ? VENT_CONFIG.floorY : depthToY(3000);

  const wormCount   = 80;
  const shrimpCount = 40;
  const matCount    = 35; // bacterial mat discs

  const tubeRef   = useRef<THREE.InstancedMesh>(null);
  const crownRef  = useRef<THREE.InstancedMesh>(null);
  const shrimpRef = useRef<THREE.InstancedMesh>(null);
  const matRef    = useRef<THREE.InstancedMesh>(null);
  const dummy     = useMemo(() => new THREE.Object3D(), []);

  const tubeUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFlow: { value: ventFlow },
  }), [ventFlow]);

  const crownUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFlow: { value: ventFlow },
  }), [ventFlow]);

  const shrimpUniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  // Generate worm layout: dense clusters around 3 vent positions
  const ventCenters = useMemo(() => [
    new THREE.Vector2(0, 0), new THREE.Vector2(-5.5, 3), new THREE.Vector2(4.8, -4.5)
  ], []);

  const wormData = useMemo(() => {
    const mats:   THREE.Matrix4[] = [];
    const phases  = new Float32Array(wormCount);
    const heights = new Float32Array(wormCount);
    const cMats:  THREE.Matrix4[] = [];
    const cPhases = new Float32Array(wormCount);

    for (let i = 0; i < wormCount; i++) {
      const vc = ventCenters[i % ventCenters.length];
      const spread = 2.0 + Math.random() * 2.5;
      const angle  = Math.random() * Math.PI * 2;
      const x      = vc.x + Math.cos(angle) * spread;
      const z      = vc.y + Math.sin(angle) * spread;
      const h      = 0.8 + Math.random() * 1.4;

      dummy.position.set(x, floorYNum, z);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.15,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.12
      );
      dummy.scale.set(0.12 + Math.random() * 0.06, h, 0.12 + Math.random() * 0.06);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
      phases[i]  = Math.random() * Math.PI * 2;
      heights[i] = h;

      // Crown at tip
      dummy.position.set(x, floorYNum + h, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.25 + Math.random() * 0.12);
      dummy.updateMatrix();
      cMats.push(dummy.matrix.clone());
      cPhases[i] = phases[i];
    }
    return { mats, phases, heights, cMats, cPhases };
  }, [wormCount, floorYNum, ventCenters, dummy]);

  const shrimpData = useMemo(() => {
    const mats   = [] as THREE.Matrix4[];
    const phases = new Float32Array(shrimpCount);
    for (let i = 0; i < shrimpCount; i++) {
      const vc  = ventCenters[i % ventCenters.length];
      const a   = Math.random() * Math.PI * 2;
      const r   = 0.5 + Math.random() * 1.5;
      dummy.position.set(
        vc.x + Math.cos(a) * r,
        floorYNum + 0.4 + Math.random() * 1.2,
        vc.y + Math.sin(a) * r
      );
      dummy.scale.setScalar(0.08 + Math.random() * 0.04);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { mats, phases };
  }, [shrimpCount, floorYNum, ventCenters, dummy]);

  const matData = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < matCount; i++) {
      const vc  = ventCenters[i % ventCenters.length];
      const a   = Math.random() * Math.PI * 2;
      const r   = Math.random() * 3.5;
      dummy.position.set(
        vc.x + Math.cos(a) * r,
        floorYNum + 0.02,
        vc.y + Math.sin(a) * r
      );
      dummy.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
      dummy.scale.setScalar(0.6 + Math.random() * 0.8);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return { mats };
  }, [matCount, floorYNum, ventCenters, dummy]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    tubeUniforms.uTime.value   = time;
    tubeUniforms.uFlow.value   = ventFlow;
    crownUniforms.uTime.value  = time;
    crownUniforms.uFlow.value  = ventFlow;
    shrimpUniforms.uTime.value = time;

    if (tubeRef.current) {
      wormData.mats.forEach((m, i) => tubeRef.current!.setMatrixAt(i, m));
      tubeRef.current.instanceMatrix.needsUpdate = true;
    }
    if (crownRef.current) {
      wormData.cMats.forEach((m, i) => crownRef.current!.setMatrixAt(i, m));
      crownRef.current.instanceMatrix.needsUpdate = true;
    }
    if (shrimpRef.current) {
      shrimpData.mats.forEach((baseMat, i) => {
        const t = time * 1.2 + shrimpData.phases[i];
        // Shrimp shimmy up the tubes
        const e = baseMat.elements;
        dummy.position.set(e[12], e[13] + Math.sin(t) * 0.15, e[14]);
        dummy.scale.setScalar(0.09);
        dummy.rotation.set(0, t * 0.5, 0);
        dummy.updateMatrix();
        shrimpRef.current!.setMatrixAt(i, dummy.matrix);
      });
      shrimpRef.current.instanceMatrix.needsUpdate = true;
    }
    if (matRef.current) {
      matData.mats.forEach((m, i) => matRef.current!.setMatrixAt(i, m));
      matRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="tube-worms">
      {/* ── Tube shafts ───────────────────────────────────────────── */}
      <instancedMesh ref={tubeRef} args={[undefined, undefined, wormCount]}>
        <cylinderGeometry args={[1, 1, 1, 8, 5]} />
        <bufferAttribute attach="geometry-attributes-aPhase"  args={[wormData.phases, 1]} />
        <bufferAttribute attach="geometry-attributes-aHeight" args={[wormData.heights, 1]} />
        <shaderMaterial
          vertexShader={TUBE_VERT}
          fragmentShader={TUBE_FRAG}
          uniforms={tubeUniforms}
        />
      </instancedMesh>

      {/* ── Crown plumes (flat disc fans) ─────────────────────────── */}
      <instancedMesh ref={crownRef} args={[undefined, undefined, wormCount]}>
        <circleGeometry args={[1, 16]} />
        <bufferAttribute attach="geometry-attributes-aPhase" args={[wormData.cPhases, 1]} />
        <shaderMaterial
          vertexShader={CROWN_VERT}
          fragmentShader={CROWN_FRAG}
          uniforms={crownUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* ── Vent shrimp ──────────────────────────────────────────── */}
      <instancedMesh ref={shrimpRef} args={[undefined, undefined, shrimpCount]}>
        <sphereGeometry args={[1, 6, 4]} />
        <bufferAttribute attach="geometry-attributes-aPhase" args={[shrimpData.phases, 1]} />
        <shaderMaterial
          vertexShader={SHRIMP_VERT}
          fragmentShader={SHRIMP_FRAG}
          uniforms={shrimpUniforms}
          transparent
        />
      </instancedMesh>

      {/* ── Bacterial mats — pale hairy disc planes ───────────────── */}
      <instancedMesh ref={matRef} args={[undefined, undefined, matCount]}>
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial color="#d4d0c8" transparent opacity={0.65} side={THREE.DoubleSide} />
      </instancedMesh>

      {/* ── Vent crabs ───────────────────────────────────────────── */}
      {[[-2, 0], [3, -3]].map(([x, z], i) => (
        <group key={i} position={[x, floorYNum + 0.15, z as number]}>
          {/* Carapace */}
          <mesh scale={[0.55, 0.25, 0.4]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#1a1208" roughness={0.9} />
          </mesh>
          {/* Stalked eyes */}
          {[-0.3, 0.3].map((ex, j) => (
            <group key={j} position={[ex, 0.2, 0.25]}>
              <mesh scale={[0.06, 0.15, 0.06]}>
                <cylinderGeometry args={[1, 1, 1, 4]} />
                <meshStandardMaterial color="#0a0805" />
              </mesh>
              <mesh position={[0, 0.15, 0]}>
                <sphereGeometry args={[0.07, 6, 6]} />
                <meshBasicMaterial color="#001420" />
              </mesh>
            </group>
          ))}
          {/* Claws (simplified) */}
          {[-0.5, 0.5].map((cx, k) => (
            <mesh key={k} position={[cx, 0, 0.4]} rotation={[0, cx > 0 ? 0.3 : -0.3, 0]}>
              <boxGeometry args={[0.12, 0.1, 0.22]} />
              <meshStandardMaterial color="#150e05" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
