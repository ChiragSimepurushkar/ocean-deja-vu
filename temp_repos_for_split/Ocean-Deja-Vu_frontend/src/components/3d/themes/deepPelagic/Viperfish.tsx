/**
 * Viperfish.tsx — Deep Pelagic Theme (500–1000m)
 *
 * Chauliodus sloanii — the viperfish
 * Features:
 * - Elongated serpentine body with oversized fang teeth
 * - Vertex-shader spine undulation (full S-curves)
 * - Large fangs as extruded quad spikes, individually lit
 * - Photophore rows along belly (additive dot sprites)
 * - Lure light spine ray with blinking photophore at tip
 * - Ambush-style movement: still, then rapid lunge, then drift
 * - Anglerfish companion with pulsing lure (bait-and-wait behaviour)
 * - Sparse deep flash particles (disturbed bioluminescence)
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

// ─── Viperfish body shader (S-curve spine undulation) ─────────────────────
const VIPER_BODY_VERT = `
  uniform float uTime;
  uniform float uLunge; // 0 = still, 1 = full lunge
  varying vec3 vNormal;
  varying float vZ;

  void main() {
    vec3 pos = position;
    vZ = pos.z;
    // Body length along Z. Undulate harder during lunge.
    float undulateAmp = 0.18 + uLunge * 0.45;
    float tailFac = clamp((pos.z - 0.5) * 0.8, 0.0, 1.0); // stronger at tail
    pos.x += sin(uTime * 6.0 + pos.z * 4.5) * undulateAmp * tailFac;
    pos.y += cos(uTime * 4.5 + pos.z * 3.0) * undulateAmp * 0.3 * tailFac;

    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const VIPER_BODY_FRAG = `
  uniform float uTime;
  varying vec3 vNormal;
  varying float vZ;

  void main() {
    // Dark iridescent blue-black sides
    float n = dot(vNormal, vec3(0.0, 0.0, 1.0));
    vec3 darkBody = vec3(0.02, 0.04, 0.10);
    vec3 sheen    = vec3(0.05, 0.30, 0.55);
    float s = pow(abs(n), 8.0);
    vec3 col = darkBody + sheen * s;

    // Bioluminescent belly stripe
    float belly = dot(vNormal, vec3(0.0, -1.0, 0.0));
    float bellyGlow = pow(max(0.0, belly), 3.0);
    col += vec3(0.05, 0.60, 0.50) * bellyGlow * 1.8;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Fang geometry generator ───────────────────────────────────────────────
function createFangGeometry(length: number, width: number): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(width, length, 4, 1);
  geo.rotateX(Math.PI); // Point downward
  return geo;
}

// ─── Anglerfish lure ───────────────────────────────────────────────────────
const LURE_VERT = `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LURE_FRAG = `
  uniform float uTime;
  void main() {
    float pulse = pow(sin(uTime * 3.5) * 0.5 + 0.5, 2.0);
    vec3 col = mix(vec3(0.05, 0.85, 0.45), vec3(0.95, 1.0, 0.3), pulse);
    gl_FragColor = vec4(col * (1.5 + pulse * 4.0), 1.0);
  }
`;

// ─── Photophore sprite GLSL ────────────────────────────────────────────────
const PHOT_VERT = `
  attribute float aPhase;
  varying float vPhase;
  void main() {
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
  }
`;

const PHOT_FRAG = `
  uniform float uTime;
  varying float vPhase;
  void main() {
    float p = sin(uTime * 2.0 + vPhase) * 0.5 + 0.5;
    p = pow(p, 3.0);
    vec3 col = mix(vec3(0.0, 0.6, 0.9), vec3(0.0, 1.0, 0.6), p);
    gl_FragColor = vec4(col * (1.0 + p * 3.0), p * 0.9 + 0.3);
  }
`;

// ─── Anglerfish companion ──────────────────────────────────────────────────
const AnglerFish: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
  const groupRef = useRef<THREE.Group>(null);
  const lureRef  = useRef<THREE.Mesh>(null);
  const lureUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    lureUniforms.uTime.value = t;
    if (!groupRef.current) return;
    // Slow hover then slight drift
    groupRef.current.position.set(
      position.x + Math.sin(t * 0.15) * 2,
      position.y + Math.sin(t * 0.2) * 1.5,
      position.z + Math.cos(t * 0.12) * 1.5
    );
    groupRef.current.rotation.y = t * 0.05;
  });

  return (
    <group ref={groupRef}>
      {/* Body — fat oblate sphere */}
      <mesh scale={[1.2, 0.75, 1.0]}>
        <sphereGeometry args={[0.9, 12, 10]} />
        <meshStandardMaterial color="#0d0d12" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Lower jaw */}
      <mesh position={[0, -0.45, 0.55]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[0.8, 0.18, 0.45]} />
        <meshStandardMaterial color="#0a0a10" />
      </mesh>
      {/* Fang row on jaw */}
      {[-0.25, -0.08, 0.08, 0.25].map((x, i) => (
        <mesh key={i} position={[x, -0.52, 0.65]} rotation={[0.45, 0, (i - 1.5) * 0.1]}>
          <coneGeometry args={[0.04, 0.35, 4]} />
          <meshBasicMaterial color="#e8e0d0" />
        </mesh>
      ))}
      {/* Lure spine ray */}
      <mesh position={[0, 0.9, 0.2]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.01, 1.2, 4]} />
        <meshBasicMaterial color="#1a0a00" />
      </mesh>
      {/* Lure bulb */}
      <mesh ref={lureRef} position={[0, 1.5, 0.45]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <shaderMaterial
          vertexShader={LURE_VERT}
          fragmentShader={LURE_FRAG}
          uniforms={lureUniforms}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight position={[0, 1.5, 0.45]} color="#44ff88" intensity={4.0} distance={6} />
      {/* Deep eyes */}
      {[-0.28, 0.28].map((x, i) => (
        <mesh key={i} position={[x, 0.15, 0.78]}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
      ))}
    </group>
  );
};

// ─── Main Viperfish Component ─────────────────────────────────────────────
export const DeepViperfish: React.FC<{ currentDepth?: number }> = ({ currentDepth = 750 }) => {
  const depthY = depthToY(currentDepth);

  const viperGroupRef = useRef<THREE.Group>(null);
  const photRef       = useRef<THREE.InstancedMesh>(null);
  const dummy         = useMemo(() => new THREE.Object3D(), []);

  const bodyUniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uLunge: { value: 0 },
  }), []);

  const photCount = 60;
  const photData  = useMemo(() => ({
    phases:    new Float32Array(Array.from({ length: photCount }, () => Math.random() * Math.PI * 2)),
    positions: Array.from({ length: photCount }, (_, i) => ({
      x: (Math.random() - 0.5) * 0.25,
      y: -0.38,
      z: -1.5 + (i / photCount) * 3.0,
    })),
  }), []);

  // Lunge state
  const lungeRef   = useRef({ t: 0, phase: 0 });
  const fangGeo    = useMemo(() => createFangGeometry(0.55, 0.035), []);
  const fangGeoSm  = useMemo(() => createFangGeometry(0.3, 0.025), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    bodyUniforms.uTime.value = time;

    // Lunge cycle: wait ~5s, lunge ~0.7s, drift back
    const cycle = (time % 6.0);
    const lunge = cycle > 5.0 ? Math.pow(Math.sin((cycle - 5.0) * Math.PI / 0.7), 2.0) : 0.0;
    bodyUniforms.uLunge.value = lunge;

    if (viperGroupRef.current) {
      const lungeForward = lunge * 5.0;
      viperGroupRef.current.position.set(
        Math.sin(time * 0.11) * 6 - 2,
        depthY + Math.sin(time * 0.09) * 3,
        -5 + Math.cos(time * 0.08) * 4 + lungeForward
      );
      viperGroupRef.current.rotation.y = Math.sin(time * 0.11) > 0 ? 0.1 : Math.PI - 0.1;
    }

    // Photophore instances along belly
    if (photRef.current) {
      photData.positions.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        const s = 0.04 + Math.sin(time * 2.0 + photData.phases[i]) * 0.015;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        photRef.current!.setMatrixAt(i, dummy.matrix);
      });
      photRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const anglerPos = useMemo(() => new THREE.Vector3(8, depthY - 2, -12), [depthY]);

  return (
    <group name="deep-viperfish">
      {/* ── Viperfish body ───────────────────────────────────────────── */}
      <group ref={viperGroupRef}>
        {/* Long slender body */}
        <mesh>
          <cylinderGeometry args={[0.12, 0.03, 4.5, 10, 8]} />
          <shaderMaterial
            vertexShader={VIPER_BODY_VERT}
            fragmentShader={VIPER_BODY_FRAG}
            uniforms={bodyUniforms}
          />
        </mesh>

        {/* Oversized head sphere */}
        <mesh position={[0, 2.0, 0]}>
          <sphereGeometry args={[0.35, 12, 10]} />
          <meshStandardMaterial color="#030608" roughness={0.85} />
        </mesh>

        {/* Giant protruding fang row — upper jaw */}
        {[-0.18, -0.06, 0.06, 0.18].map((x, i) => (
          <mesh key={`fu${i}`} geometry={fangGeo} position={[x, 1.8, 0.15]}>
            <meshBasicMaterial color="#ddd8cc" />
          </mesh>
        ))}
        {/* Lower jaw fangs */}
        {[-0.14, 0.0, 0.14].map((x, i) => (
          <mesh key={`fl${i}`} geometry={fangGeoSm} position={[x, 1.65, 0.22]} rotation={[0.3, 0, 0]}>
            <meshBasicMaterial color="#c8c4ba" />
          </mesh>
        ))}

        {/* Eyes — large flat discs */}
        {[-0.22, 0.22].map((x, i) => (
          <mesh key={`eye${i}`} position={[x, 2.1, 0.25]}>
            <circleGeometry args={[0.14, 12]} />
            <meshBasicMaterial color="#001830" side={THREE.DoubleSide} />
          </mesh>
        ))}

        {/* Photophore belly row */}
        <instancedMesh ref={photRef} args={[undefined, undefined, photCount]} position={[0, 2, 0]}>
          <sphereGeometry args={[1, 4, 4]} />
          <bufferAttribute attach="geometry-attributes-aPhase" args={[photData.phases, 1]} />
          <shaderMaterial
            vertexShader={PHOT_VERT}
            fragmentShader={PHOT_FRAG}
            uniforms={{ uTime: { value: 0 } }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </instancedMesh>

        {/* Subtle body glow */}
        <pointLight color="#003366" intensity={1.5} distance={5} position={[0, 0, 0]} />
      </group>

      {/* ── Anglerfish companion ─────────────────────────────────────── */}
      <AnglerFish position={anglerPos} />
    </group>
  );
};
