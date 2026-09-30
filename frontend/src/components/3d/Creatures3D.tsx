import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Clone } from '@react-three/drei';
import * as THREE from 'three';
import { MarineSpecies } from '../../types';
import { MARINE_SPECIES_CATALOG } from '../../data/oceanData';

// Pre-load the real fish model
useGLTF.preload('/fish.glb');

import { DiveConfig } from '../../utils/buildDiveConfig';

interface Creatures3DProps {
  currentDepth: number;
  onDiscoverSpecies: (species: MarineSpecies) => void;
  discoveredSpeciesIds: string[];
  config: DiveConfig;
}

// ─── Shared scan reticle ─────────────────────────────────────────────────────
const ScanReticle: React.FC<{ radius: number; color: string }> = ({ radius, color }) => (
  <mesh>
    <ringGeometry args={[radius, radius + 0.12, 28]} />
    <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} />
  </mesh>
);

// ─── Real GLTF Fish (tuna / shark / generic fish) ────────────────────────────
const RealFish: React.FC<{
  position: [number, number, number];
  speed: number;
  scale?: number;
  color?: string;
  species: MarineSpecies;
  onDiscover: (s: MarineSpecies) => void;
  isDiscovered: boolean;
}> = ({ position, speed, scale = 1, color, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { scene } = useGLTF('/fish.glb');

  // Clone scene so each instance is independent
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    // Apply a tint color if provided
    if (color) {
      clone.traverse((obj: any) => {
        if (obj.isMesh && obj.material) {
          const mat = obj.material.clone();
          mat.color = new THREE.Color(color);
          mat.emissive = new THREE.Color(color).multiplyScalar(0.05);
          obj.material = mat;
        }
      });
    }
    return clone;
  }, [scene, color]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime() * speed;
    const x = position[0] + Math.sin(time * 0.3) * 18;
    const z = position[2] + Math.cos(time * 0.25) * 4;
    const y = position[1] + Math.sin(time * 0.6) * 0.6;
    const prevX = groupRef.current.position.x;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      x - prevX >= 0 ? Math.PI / 2 : -Math.PI / 2,
      4, delta
    );
    groupRef.current.rotation.z = Math.sin(time * 1.5) * 0.07;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}
    >
      <primitive object={clonedScene} />
      {hovered && <ScanReticle radius={1.4} color="#38bdf8" />}
    </group>
  );
};

// ─── Instanced Fish School (uses real fish.glb) ───────────────────────────────
const FishSchool: React.FC<{
  centerPosition: [number, number, number];
  count?: number;
  color?: string;
}> = ({ centerPosition, count = 22, color = '#94a3b8' }) => {
  const { scene } = useGLTF('/fish.glb');
  const refs = useRef<(THREE.Group | null)[]>([]);
  const offsets = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 8,
    y: (Math.random() - 0.5) * 4,
    z: (Math.random() - 0.5) * 8,
    speed: 0.7 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
  })), [count]);

  const tintedScenes = useMemo(() => offsets.map(() => {
    const clone = scene.clone(true);
    clone.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        const mat = obj.material.clone();
        mat.color = new THREE.Color(color);
        mat.emissive = new THREE.Color(color).multiplyScalar(0.04);
        obj.material = mat;
      }
    });
    return clone;
  }), [scene, color, offsets]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    offsets.forEach((f, i) => {
      const ref = refs.current[i];
      if (!ref) return;
      const t = time * f.speed + f.phase;
      ref.position.set(
        centerPosition[0] + f.x + Math.sin(t * 0.6) * 5,
        centerPosition[1] + f.y + Math.sin(t * 1.2) * 0.8,
        centerPosition[2] + f.z + Math.cos(t * 0.6) * 5,
      );
      ref.rotation.set(0, t * 0.6 + Math.PI / 2, Math.sin(t * 2) * 0.15);
    });
  });

  return (
    <group>
      {tintedScenes.map((s, i) => (
        <group
          key={i}
          ref={el => { refs.current[i] = el; }}
          scale={0.32}
        >
          <primitive object={s} />
        </group>
      ))}
    </group>
  );
};

// ─── Manta Ray (primitive — elegant flat body) ────────────────────────────────
const MantaRay: React.FC<{
  position: [number, number, number]; speed: number; scale?: number;
  species: MarineSpecies; onDiscover: (s: MarineSpecies) => void; isDiscovered: boolean;
}> = ({ position, speed, scale = 1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftWingRef  = useRef<THREE.Group>(null);
  const rightWingRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    groupRef.current.position.set(
      position[0] + Math.sin(t * 0.25) * 16,
      position[1] + Math.sin(t * 0.4) * 1.5,
      position[2] + Math.cos(t * 0.18) * 12
    );
    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      Math.atan2(Math.cos(t * 0.18), Math.sin(t * 0.25)) + Math.PI / 2,
      2, delta
    );
    groupRef.current.rotation.z = Math.sin(t * 0.7) * 0.15;
    const flap = Math.sin(t * 1.8);
    if (leftWingRef.current)  leftWingRef.current.rotation.z  =  flap * 0.28;
    if (rightWingRef.current) rightWingRef.current.rotation.z = -flap * 0.28;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Body disc */}
      <mesh castShadow receiveShadow scale={[1.6, 0.22, 2.0]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={hovered ? '#0ea5e9' : '#0c1a2e'} roughness={0.4} metalness={0.35} />
      </mesh>
      {/* Belly (lighter) */}
      <mesh position={[0, -0.1, 0]} scale={[1.3, 0.08, 1.5]}>
        <sphereGeometry args={[0.9, 10, 8]} />
        <meshStandardMaterial color="#e8f4fd" roughness={0.6} />
      </mesh>
      {/* Left wing */}
      <group ref={leftWingRef} position={[-1.2, 0, 0]}>
        <mesh scale={[1.9, 0.08, 1.5]} rotation={[0, 0.15, 0]}>
          <coneGeometry args={[1, 2.2, 5]} />
          <meshStandardMaterial color={hovered ? '#1d4ed8' : '#0f1f3d'} roughness={0.4} />
        </mesh>
      </group>
      {/* Right wing */}
      <group ref={rightWingRef} position={[1.2, 0, 0]}>
        <mesh scale={[1.9, 0.08, 1.5]} rotation={[0, -0.15, 0]}>
          <coneGeometry args={[1, 2.2, 5]} />
          <meshStandardMaterial color={hovered ? '#1d4ed8' : '#0f1f3d'} roughness={0.4} />
        </mesh>
      </group>
      {/* Cephalic fins (horns) */}
      <mesh position={[-0.45, 0.04, 1.7]} rotation={[0.35, -0.2, 0]}>
        <coneGeometry args={[0.12, 0.55, 4]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.45, 0.04, 1.7]} rotation={[0.35, 0.2, 0]}>
        <coneGeometry args={[0.12, 0.55, 4]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* Tail whip */}
      <mesh position={[0, 0, -2.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.08, 3.2, 4]} />
        <meshStandardMaterial color="#0a1628" />
      </mesh>
      {hovered && <ScanReticle radius={3.2} color="#06b6d4" />}
    </group>
  );
};

// ─── Sea Turtle ───────────────────────────────────────────────────────────────
const SeaTurtle: React.FC<{
  position: [number, number, number]; speed: number; scale?: number;
  species: MarineSpecies; onDiscover: (s: MarineSpecies) => void; isDiscovered: boolean;
}> = ({ position, speed, scale = 1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    const x = position[0] + Math.sin(t * 0.2) * 12;
    const y = position[1] + Math.sin(t * 0.35) * 1.2;
    const z = position[2] + Math.cos(t * 0.15) * 8;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      Math.atan2(Math.cos(t * 0.15), Math.sin(t * 0.2)) + Math.PI / 2,
      2, delta
    );
    groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.08;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Carapace shell */}
      <mesh castShadow receiveShadow scale={[1.3, 0.42, 1.65]}>
        <sphereGeometry args={[0.9, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={hovered ? '#1a9068' : '#0d6952'} roughness={0.75} metalness={0.1} flatShading />
      </mesh>
      {/* Shell ridge pattern */}
      <mesh position={[0, 0.37, 0]} scale={[0.55, 0.07, 0.68]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#064e3b" roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.08, 1.12]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color="#0e4233" roughness={0.8} />
      </mesh>
      {/* Flippers (4) */}
      {[
        { pos: [-0.95, 0, 0.3] as [number,number,number],   rot: [0.1, 0.3, -0.4] as [number,number,number],  scale: [0.78, 0.08, 0.5] as [number,number,number] },
        { pos: [ 0.95, 0, 0.3] as [number,number,number],   rot: [0.1,-0.3,  0.4] as [number,number,number],  scale: [0.78, 0.08, 0.5] as [number,number,number] },
        { pos: [-0.8,  0,-0.7] as [number,number,number],   rot: [0.1,-0.5, -0.3] as [number,number,number],  scale: [0.6,  0.07, 0.4] as [number,number,number] },
        { pos: [ 0.8,  0,-0.7] as [number,number,number],   rot: [0.1, 0.5,  0.3] as [number,number,number],  scale: [0.6,  0.07, 0.4] as [number,number,number] },
      ].map((f, i) => (
        <mesh key={i} position={f.pos} rotation={new THREE.Euler(...f.rot)} scale={f.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#0d5c45" roughness={0.7} />
        </mesh>
      ))}
      {hovered && <ScanReticle radius={1.4} color="#14b8a6" />}
    </group>
  );
};

// ─── Bioluminescent Jellyfish ─────────────────────────────────────────────────
const BioluminescentJellyfish: React.FC<{
  position: [number, number, number]; speed: number; scale?: number;
  species: MarineSpecies; onDiscover: (s: MarineSpecies) => void; isDiscovered: boolean;
}> = ({ position, speed, scale = 1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const bellRef  = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    const pulse = (Math.sin(t * 2.2) + 1) / 2;
    groupRef.current.position.set(
      position[0] + Math.sin(t * 0.3) * 2.5,
      position[1] + Math.sin(t * 0.5) * 1.5 + pulse * 0.4,
      position[2] + Math.cos(t * 0.25) * 2.5
    );
    if (bellRef.current) bellRef.current.scale.set(1 - pulse * 0.18, 1 + pulse * 0.25, 1 - pulse * 0.18);
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Bell */}
      <mesh ref={bellRef} castShadow>
        <sphereGeometry args={[1, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          roughness={0.08}
          transmission={0.88}
          thickness={0.5}
          transparent
          opacity={0.72}
          emissive="#0369a1"
          emissiveIntensity={hovered ? 1.0 : 0.55}
        />
      </mesh>
      {/* Inner bell rings */}
      <mesh position={[0, 0.18, 0]}>
        <torusGeometry args={[0.33, 0.06, 8, 18]} />
        <meshBasicMaterial color="#67e8f9" />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <torusGeometry args={[0.19, 0.045, 8, 14]} />
        <meshBasicMaterial color="#a7f3d0" />
      </mesh>
      {/* Trailing tentacles */}
      {[-0.42, -0.15, 0.15, 0.42].map((x, i) => (
        <mesh key={i} position={[x, -1.3, i % 2 === 0 ? 0.18 : -0.18]}>
          <cylinderGeometry args={[0.018, 0.035, 2.6, 4]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.6} />
        </mesh>
      ))}
      <pointLight position={[0, 0.2, 0]} color="#38bdf8" intensity={hovered ? 2.2 : 1.4} distance={5} />
      {hovered && <ScanReticle radius={1.4} color="#38bdf8" />}
    </group>
  );
};

// ─── Thresher Shark ───────────────────────────────────────────────────────────
const ThresherShark: React.FC<{
  position: [number, number, number]; speed: number; scale?: number;
  species: MarineSpecies; onDiscover: (s: MarineSpecies) => void; isDiscovered: boolean;
}> = ({ position, speed, scale = 1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef  = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    const x = position[0] + Math.sin(t * 0.18) * 22;
    const y = position[1] + Math.sin(t * 0.25) * 2;
    const z = position[2] + Math.cos(t * 0.14) * 14;
    const prevX = groupRef.current.position.x;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      x - prevX >= 0 ? Math.PI / 2 : -Math.PI / 2,
      3, delta
    );
    groupRef.current.rotation.z = Math.sin(t * 1.0) * 0.06;
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(t * 3.5) * 0.25;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Streamlined torpedo body */}
      <mesh castShadow receiveShadow scale={[0.72, 0.6, 2.3]}>
        <sphereGeometry args={[0.9, 12, 8]} />
        <meshStandardMaterial color={hovered ? '#475569' : '#1a2a3f'} roughness={0.45} metalness={0.25} flatShading />
      </mesh>
      {/* Counter-shading belly */}
      <mesh scale={[0.65, 0.35, 2.0]} position={[0, -0.28, 0]}>
        <sphereGeometry args={[0.85, 10, 7]} />
        <meshStandardMaterial color="#d4e8f0" roughness={0.6} />
      </mesh>
      {/* Dorsal fin */}
      <mesh position={[0, 0.85, 0.2]} rotation={[-0.3, 0, 0]}>
        <coneGeometry args={[0.16, 1.05, 4]} />
        <meshStandardMaterial color="#0f1f30" flatShading />
      </mesh>
      {/* Pectoral fins */}
      <mesh position={[-0.9, 0, 0.4]} rotation={[0.1, 0, -0.5]} scale={[1.2, 0.05, 0.55]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#182438" flatShading />
      </mesh>
      <mesh position={[ 0.9, 0, 0.4]} rotation={[0.1, 0,  0.5]} scale={[1.2, 0.05, 0.55]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#182438" flatShading />
      </mesh>
      {/* Big bigeye */}
      <mesh position={[-0.37, 0.35, 1.5]}><sphereGeometry args={[0.2, 8, 8]} /><meshBasicMaterial color="#0ea5e9" /></mesh>
      <mesh position={[ 0.37, 0.35, 1.5]}><sphereGeometry args={[0.2, 8, 8]} /><meshBasicMaterial color="#0ea5e9" /></mesh>
      {/* Long thresher tail */}
      <group ref={tailRef} position={[0, 0, -2.0]}>
        <mesh position={[0, 1.0, -0.5]} rotation={[-0.4, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.11, 2.8, 5]} />
          <meshStandardMaterial color="#0f1f2e" flatShading />
        </mesh>
      </group>
      {hovered && <ScanReticle radius={2.0} color="#64748b" />}
    </group>
  );
};

// ─── Glass Squid ──────────────────────────────────────────────────────────────
const GlassSquid: React.FC<{
  position: [number, number, number]; speed: number; scale?: number;
  species: MarineSpecies; onDiscover: (s: MarineSpecies) => void; isDiscovered: boolean;
}> = ({ position, speed, scale = 1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    groupRef.current.position.set(
      position[0] + Math.sin(t * 0.4) * 8,
      position[1] + Math.cos(t * 0.6) * 2,
      position[2] + Math.sin(t * 0.35) * 6
    );
    groupRef.current.rotation.y = t * 0.28;
    groupRef.current.rotation.z = Math.sin(t * 1.2) * 0.12;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Transparent mantle */}
      <mesh castShadow scale={[0.68, 1.65, 0.68]}>
        <sphereGeometry args={[0.62, 12, 12]} />
        <meshPhysicalMaterial
          color="#bae6fd"
          roughness={0.04}
          transmission={0.92}
          thickness={0.25}
          transparent
          opacity={0.48}
          emissive="#60a5fa"
          emissiveIntensity={hovered ? 0.5 : 0.28}
        />
      </mesh>
      {/* Photophore eyes */}
      <mesh position={[-0.27, -0.2, 0.52]}><sphereGeometry args={[0.1, 6, 6]} /><meshBasicMaterial color="#60a5fa" /></mesh>
      <mesh position={[ 0.27, -0.2, 0.52]}><sphereGeometry args={[0.1, 6, 6]} /><meshBasicMaterial color="#60a5fa" /></mesh>
      <pointLight position={[0, -0.2, 0.52]} color="#60a5fa" intensity={0.8} distance={4} />
      {/* Fins */}
      <mesh position={[-0.52, 0.3, 0]} rotation={[0, 0, -0.5]} scale={[0.58, 0.05, 0.38]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial color="#bae6fd" transparent opacity={0.5} transmission={0.5} />
      </mesh>
      <mesh position={[ 0.52, 0.3, 0]} rotation={[0, 0,  0.5]} scale={[0.58, 0.05, 0.38]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial color="#bae6fd" transparent opacity={0.5} transmission={0.5} />
      </mesh>
      {/* Tentacles */}
      {[-0.24, -0.08, 0.08, 0.24].map((x, i) => (
        <mesh key={i} position={[x, -0.88, 0]}>
          <cylinderGeometry args={[0.022, 0.038, 1.55, 4]} />
          <meshBasicMaterial color="#93c5fd" transparent opacity={0.52} />
        </mesh>
      ))}
      {hovered && <ScanReticle radius={0.88} color="#60a5fa" />}
    </group>
  );
};

// ─── Giant Siphonophore ───────────────────────────────────────────────────────
const Siphonophore: React.FC<{
  position: [number, number, number]; speed: number; scale?: number;
  species: MarineSpecies; onDiscover: (s: MarineSpecies) => void; isDiscovered: boolean;
}> = ({ position, speed, scale = 1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const segments = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    y: -i * 0.75, phase: i * 0.42,
  })), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    groupRef.current.position.set(
      position[0] + Math.sin(t * 0.15) * 10,
      position[1] + Math.cos(t * 0.12) * 3,
      position[2] + Math.cos(t * 0.18) * 8
    );
    groupRef.current.rotation.y = t * 0.08;
    groupRef.current.children.forEach((child, i) => {
      child.position.x = Math.sin(t * 0.8 + i * 0.35) * 0.38;
    });
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {segments.map((seg, i) => (
        <mesh key={i} position={[0, seg.y, 0]}>
          <sphereGeometry args={[0.2 - i * 0.004, 8, 8]} />
          <meshPhysicalMaterial
            color={i % 2 === 0 ? '#38bdf8' : '#67e8f9'}
            transparent opacity={0.72}
            transmission={0.28}
            emissive={i % 3 === 0 ? '#0284c7' : '#22d3ee'}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
      <pointLight position={[0, -4, 0]} color="#22d3ee" intensity={1.2} distance={8} />
      {hovered && <ScanReticle radius={1.0} color="#22d3ee" />}
    </group>
  );
};

// ─── Anglerfish ───────────────────────────────────────────────────────────────
const Anglerfish3D: React.FC<{
  position: [number, number, number]; speed: number; scale?: number;
  species: MarineSpecies; onDiscover: (s: MarineSpecies) => void; isDiscovered: boolean;
}> = ({ position, speed, scale = 1, species, onDiscover }) => {
  const groupRef    = useRef<THREE.Group>(null);
  const lureLightRef = useRef<THREE.PointLight>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    groupRef.current.position.set(
      position[0] + Math.cos(t * 0.4) * 2.5,
      position[1] + Math.sin(t * 0.7) * 0.4,
      position[2] + Math.sin(t * 0.5) * 1.5
    );
    groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.3 + Math.PI / 4;
    groupRef.current.rotation.z = Math.sin(t * 0.8) * 0.05;
    if (lureLightRef.current) lureLightRef.current.intensity = 2.2 + Math.sin(t * 8) * 0.9;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Globe body */}
      <mesh castShadow scale={[1.1, 0.95, 1.32]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color={hovered ? '#334155' : '#080e1c'} roughness={0.92} metalness={0.08} flatShading />
      </mesh>
      {/* Jutting lower jaw */}
      <mesh position={[0, -0.42, 0.62]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[0.95, 0.32, 1.05]} />
        <meshStandardMaterial color="#06101e" roughness={0.92} flatShading />
      </mesh>
      {/* Teeth */}
      {[-0.34, -0.12, 0.12, 0.34].map((x, i) => (
        <mesh key={i} position={[x, -0.16, 1.05]} rotation={[-0.28, 0, 0]}>
          <coneGeometry args={[0.038, 0.3, 3]} />
          <meshBasicMaterial color="#dde8ef" />
        </mesh>
      ))}
      {/* Illicium (lure rod) */}
      <mesh position={[0, 0.92, 0.62]} rotation={[-0.8, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.048, 1.25, 5]} />
        <meshStandardMaterial color="#1a2a3a" />
      </mesh>
      {/* Glowing lure bulb */}
      <mesh position={[0, 1.48, 1.12]}>
        <sphereGeometry args={[0.17, 14, 14]} />
        <meshBasicMaterial color="#22d3ee" />
      </mesh>
      <pointLight ref={lureLightRef} position={[0, 1.48, 1.12]} color="#22d3ee" intensity={2.5} distance={7} />
      {hovered && <ScanReticle radius={1.8} color="#22d3ee" />}
    </group>
  );
};

// ─── Viperfish ────────────────────────────────────────────────────────────────
const Viperfish: React.FC<{
  position: [number, number, number]; speed: number; scale?: number;
  species: MarineSpecies; onDiscover: (s: MarineSpecies) => void; isDiscovered: boolean;
}> = ({ position, speed, scale = 1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    const x = position[0] + Math.sin(t * 0.22) * 14;
    const y = position[1] + Math.cos(t * 0.3) * 1.5;
    const z = position[2] + Math.cos(t * 0.18) * 8;
    const prevX = groupRef.current.position.x;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      x - prevX >= 0 ? Math.PI / 2 : -Math.PI / 2,
      4, delta
    );
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Elongated sleek body */}
      <mesh castShadow scale={[0.48, 0.48, 2.6]}>
        <sphereGeometry args={[0.62, 8, 8]} />
        <meshStandardMaterial color={hovered ? '#334155' : '#0d1625'} roughness={0.85} flatShading />
      </mesh>
      {/* Fang teeth — needle-like, protrude outside jaw */}
      {[-0.17, -0.06, 0.06, 0.17].map((x, i) => (
        <mesh key={i} position={[x, -0.24, 1.45]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.024, 0.44, 3]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
      ))}
      {/* Photophore belly row */}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((z, i) => (
        <mesh key={i} position={[0, -0.31, z]}>
          <sphereGeometry args={[0.055, 5, 5]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      ))}
      <pointLight position={[0, -0.3, 0]} color="#38bdf8" intensity={0.48} distance={3} />
      {hovered && <ScanReticle radius={0.75} color="#38bdf8" />}
    </group>
  );
};

export const Creatures3D: React.FC<Creatures3DProps> = ({
  currentDepth, onDiscoverSpecies, discoveredSpeciesIds, config
}) => {
  const speciesList = useMemo(() => MARINE_SPECIES_CATALOG, []);

  const getSpecies = (id: string): MarineSpecies =>
    speciesList.find(s => s.id === id) || {
      id, name: 'Unknown Oceanic Specimen', scientificName: 'Sp. bathypelagia',
      depthRange: '0-1000m', minDepth: 0, maxDepth: 1000, rarity: 'Rare' as const,
      points: 50, description: 'Deep ocean creature.', color: '#06b6d4', type: 'fish',
    };

  const isDisc = (id: string) => discoveredSpeciesIds.includes(id);

  return (
    <group>
      {/* ── SURFACE / REEF ZONE (0-100m | Y: 0 to -20) ── */}
      {/* Only spawn surface reef creatures if atoll/shelf or event triggered */}
      {(config.biome === 'atoll' || config.biome === 'shelf') && (
        <>
          <RealFish position={[ 3,  -4, -7]} speed={1.2} scale={1.1}  color="#1a6fa0" species={getSpecies('yellowfin-tuna')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('yellowfin-tuna')} />
          <RealFish position={[-6, -10, -9]} speed={0.9} scale={0.95} color="#1a6fa0" species={getSpecies('yellowfin-tuna')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('yellowfin-tuna')} />
          <MantaRay position={[0, -18, -8]} speed={0.7} scale={1.3} species={getSpecies('reef-manta')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('reef-manta')} />
          <SeaTurtle position={[-5, -12, -6]} speed={0.55} scale={1.0} species={getSpecies('hawksbill-turtle')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('hawksbill-turtle')} />
        </>
      )}

      {/* ── Dynamic config events ── */}
      {config.events.map((ev, i) => {
        const y = -(ev.atDepth / 1000) * 200;
        // only render if nearby
        if (Math.abs(currentDepth - ev.atDepth) > 150) return null;

        if (ev.type === 'whaleShark') {
          return <MantaRay key={i} position={[0, y, -10]} speed={0.4} scale={2.5} species={getSpecies('whale-shark')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('whale-shark')} />;
        }
        if (ev.type === 'squidSchool') {
          return <GlassSquid key={i} position={[-2, y, -8]} speed={0.8} scale={1.5} species={getSpecies('glass-squid')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('glass-squid')} />;
        }
        if (ev.type === 'bloom') {
          return <BioluminescentJellyfish key={i} position={[3, y, -6]} speed={0.6} scale={1.8} species={getSpecies('bioluminescent-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('bioluminescent-jelly')} />;
        }
        return null;
      })}

      {/* ── THERMOCLINE BAND (100-250m | Y: -20 to -50) ── */}
      <BioluminescentJellyfish position={[ 4, -25, -7]} speed={0.8}  scale={1.0} species={getSpecies('comb-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('comb-jelly')} />
      <BioluminescentJellyfish position={[-7, -32, -9]} speed={0.65} scale={1.3} species={getSpecies('comb-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('comb-jelly')} />
      <BioluminescentJellyfish position={[ 2, -42, -6]} speed={0.72} scale={0.9} species={getSpecies('bioluminescent-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('bioluminescent-jelly')} />

      <ThresherShark position={[5, -38, -8]} speed={0.8} scale={1.4} species={getSpecies('bigeye-thresher')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('bigeye-thresher')} />

      {/* ── MESOPELAGIC TWILIGHT (250-500m | Y: -50 to -100) ── */}
      <GlassSquid position={[ 3, -62, -8]} speed={0.9}  scale={1.2} species={getSpecies('glass-squid')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('glass-squid')} />
      <GlassSquid position={[-6, -78, -6]} speed={0.75} scale={1.0} species={getSpecies('glass-squid')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('glass-squid')} />

      <Siphonophore position={[-4, -92, -9]} speed={0.4} scale={1.3} species={getSpecies('deep-siphonophore')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('deep-siphonophore')} />

      {/* ── OXYGEN MINIMUM ZONE (500-700m | Y: -100 to -140) ── */}
      {!(config.omzTop && currentDepth > config.omzTop) && (
        <Viperfish    position={[ 4, -115, -7]} speed={0.7}  scale={1.1} species={getSpecies('viperfish')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('viperfish')} />
      )}

      {/* ── ABYSSAL MIDNIGHT ZONE (700-1000m | Y: -140 to -200) ── */}
      {(config.biome === 'abyssal' || config.biome === 'seamount') && (
        <>
          <Anglerfish3D position={[ 3, -150, -6]} speed={0.55} scale={1.2} species={getSpecies('deep-sea-angler')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('deep-sea-angler')} />
          <Anglerfish3D position={[-5, -168, -8]} speed={0.5}  scale={1.4} species={getSpecies('anglerfish')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('anglerfish')} />
          <Viperfish    position={[-4, -158, -7]} speed={0.62} scale={1.25} species={getSpecies('viperfish')} onDiscover={onDiscoverSpecies} isDiscovered={isDisc('viperfish')} />
        </>
      )}
    </group>
  );
};