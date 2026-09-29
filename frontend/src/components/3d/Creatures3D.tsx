import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MarineSpecies } from '../../types';
import { MARINE_SPECIES_CATALOG } from '../../data/oceanData';

interface Creatures3DProps {
  currentDepth: number;
  onDiscoverSpecies: (species: MarineSpecies) => void;
  discoveredSpeciesIds: string[];
}

// ─── Shared scan reticle ────────────────────────────────────────────────────
const ScanReticle: React.FC<{ radius: number; color: string }> = ({ radius, color }) => (
  <mesh>
    <ringGeometry args={[radius, radius + 0.12, 28]} />
    <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} />
  </mesh>
);

// ─── 1. Yellowfin Tuna ───────────────────────────────────────────────────────
const TunaFish: React.FC<{ position: [number,number,number]; speed: number; scale?: number; species: MarineSpecies; onDiscover: (s: MarineSpecies)=>void; isDiscovered: boolean }> = ({ position, speed, scale=1, species, onDiscover, isDiscovered }) => {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef  = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime() * speed;
    const x = position[0] + Math.sin(time * 0.3) * 18;
    const z = position[2] + Math.cos(time * 0.25) * 4;
    const y = position[1] + Math.sin(time * 0.6) * 0.6;
    const prevX = groupRef.current.position.x;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, x - prevX >= 0 ? Math.PI/2 : -Math.PI/2, 4, delta);
    groupRef.current.rotation.z = Math.sin(time * 1.5) * 0.08;
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(time * 4.5) * 0.35;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[0.45, 1.4, 8, 16]} />
        <meshStandardMaterial color={hovered ? '#38bdf8' : '#0284c7'} roughness={0.25} metalness={0.65} />
      </mesh>
      <mesh position={[0, 0.42, 0.1]} rotation={[-0.4,0,0]}>
        <coneGeometry args={[0.2, 0.6, 4]} />
        <meshStandardMaterial color="#facc15" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[-0.45,-0.05,0.3]} rotation={[0.2,0,-0.6]}><boxGeometry args={[0.45,0.04,0.2]} /><meshStandardMaterial color="#38bdf8" roughness={0.3} /></mesh>
      <mesh position={[0.45,-0.05,0.3]} rotation={[0.2,0,0.6]}><boxGeometry args={[0.45,0.04,0.2]} /><meshStandardMaterial color="#38bdf8" roughness={0.3} /></mesh>
      <group ref={tailRef} position={[0,0,-0.9]}>
        <mesh position={[0,0,-0.2]}><coneGeometry args={[0.2,0.5,5]} /><meshStandardMaterial color="#0369a1" roughness={0.3} /></mesh>
        <mesh position={[0,0,-0.45]} rotation={[Math.PI/2,0,0]}><coneGeometry args={[0.5,0.1,3]} /><meshStandardMaterial color="#eab308" roughness={0.3} /></mesh>
      </group>
      {hovered && <ScanReticle radius={1.1} color="#38bdf8" />}
    </group>
  );
};

// ─── 2. Manta Ray ──────────────────────────────────────────────────────────
const MantaRay: React.FC<{ position: [number,number,number]; speed: number; scale?: number; species: MarineSpecies; onDiscover: (s: MarineSpecies)=>void; isDiscovered: boolean }> = ({ position, speed, scale=1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftWingRef  = useRef<THREE.Group>(null);
  const rightWingRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    groupRef.current.position.set(position[0]+Math.sin(t*0.25)*16, position[1]+Math.sin(t*0.4)*1.5, position[2]+Math.cos(t*0.18)*12);
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, Math.atan2(Math.cos(t*0.18),Math.sin(t*0.25))+Math.PI/2, 2, delta);
    groupRef.current.rotation.z = Math.sin(t*0.7)*0.15;
    const flap = Math.sin(t*1.8);
    if (leftWingRef.current)  leftWingRef.current.rotation.z  =  flap * 0.28;
    if (rightWingRef.current) rightWingRef.current.rotation.z = -flap * 0.28;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      <mesh castShadow receiveShadow scale={[1.6,0.28,1.8]}><sphereGeometry args={[1,12,12]} /><meshStandardMaterial color={hovered?'#0ea5e9':'#0f172a'} roughness={0.4} metalness={0.3} /></mesh>
      <mesh position={[0,-0.12,0]} scale={[1.4,0.1,1.6]}><sphereGeometry args={[0.9,10,10]} /><meshStandardMaterial color="#f8fafc" roughness={0.5} /></mesh>
      <mesh position={[-0.5,0.05,1.7]} rotation={[0.4,-0.2,0]}><coneGeometry args={[0.15,0.6,5]} /><meshStandardMaterial color="#0f172a" /></mesh>
      <mesh position={[0.5,0.05,1.7]} rotation={[0.4,0.2,0]}><coneGeometry args={[0.15,0.6,5]} /><meshStandardMaterial color="#0f172a" /></mesh>
      <group ref={leftWingRef} position={[-1.2,0,0]}><mesh position={[-1.5,0,0]} scale={[1.8,0.1,1.4]} rotation={[0,0.2,0]}><coneGeometry args={[1,2,4]} /><meshStandardMaterial color={hovered?'#38bdf8':'#1e293b'} roughness={0.4} /></mesh></group>
      <group ref={rightWingRef} position={[1.2,0,0]}><mesh position={[1.5,0,0]} scale={[1.8,0.1,1.4]} rotation={[0,-0.2,0]}><coneGeometry args={[1,2,4]} /><meshStandardMaterial color={hovered?'#38bdf8':'#1e293b'} roughness={0.4} /></mesh></group>
      <mesh position={[0,0,-2.2]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.03,0.08,2.8,4]} /><meshStandardMaterial color="#0f172a" /></mesh>
      {hovered && <ScanReticle radius={3.2} color="#06b6d4" />}
    </group>
  );
};

// ─── 3. Hawksbill Sea Turtle ────────────────────────────────────────────────
const SeaTurtle: React.FC<{ position: [number,number,number]; speed: number; scale?: number; species: MarineSpecies; onDiscover: (s: MarineSpecies)=>void; isDiscovered: boolean }> = ({ position, speed, scale=1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    const x = position[0] + Math.sin(t * 0.2) * 12;
    const y = position[1] + Math.sin(t * 0.35) * 1.2;
    const z = position[2] + Math.cos(t * 0.15) * 8;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, Math.atan2(Math.cos(t*0.15), Math.sin(t*0.2)) + Math.PI/2, 2, delta);
    groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.08;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Shell */}
      <mesh castShadow receiveShadow scale={[1.3, 0.4, 1.6]}>
        <sphereGeometry args={[0.9, 10, 8, 0, Math.PI*2, 0, Math.PI*0.6]} />
        <meshStandardMaterial color={hovered ? '#14b8a6' : '#0d7a6e'} roughness={0.7} metalness={0.1} flatShading />
      </mesh>
      {/* Shell plates pattern */}
      <mesh position={[0, 0.36, 0]} scale={[0.6, 0.08, 0.7]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#065f52" roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.1, 1.1]}><sphereGeometry args={[0.32, 8, 8]} /><meshStandardMaterial color="#0f4c3a" roughness={0.8} /></mesh>
      {/* Flippers */}
      <mesh position={[-0.95, 0, 0.3]} rotation={[0.1, 0.3, -0.4]} scale={[0.8, 0.08, 0.5]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#0d6b56" roughness={0.7} /></mesh>
      <mesh position={[0.95, 0, 0.3]} rotation={[0.1, -0.3, 0.4]} scale={[0.8, 0.08, 0.5]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#0d6b56" roughness={0.7} /></mesh>
      <mesh position={[-0.8, 0, -0.7]} rotation={[0.1, -0.5, -0.3]} scale={[0.6, 0.07, 0.4]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#0d6b56" roughness={0.7} /></mesh>
      <mesh position={[0.8, 0, -0.7]} rotation={[0.1, 0.5, 0.3]} scale={[0.6, 0.07, 0.4]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#0d6b56" roughness={0.7} /></mesh>
      {hovered && <ScanReticle radius={1.4} color="#14b8a6" />}
    </group>
  );
};

// ─── 4. Bioluminescent Jellyfish ────────────────────────────────────────────
const BioluminescentJellyfish: React.FC<{ position: [number,number,number]; speed: number; scale?: number; species: MarineSpecies; onDiscover: (s: MarineSpecies)=>void; isDiscovered: boolean }> = ({ position, speed, scale=1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const bellRef  = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    const pulse = (Math.sin(t * 2.2) + 1) / 2;
    groupRef.current.position.set(position[0]+Math.sin(t*0.3)*2, position[1]+Math.sin(t*0.5)*1.5+pulse*0.4, position[2]+Math.cos(t*0.25)*2);
    if (bellRef.current) bellRef.current.scale.set(1 - pulse*0.18, 1 + pulse*0.25, 1 - pulse*0.18);
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      <mesh ref={bellRef} castShadow>
        <sphereGeometry args={[1, 16, 16, 0, Math.PI*2, 0, Math.PI*0.55]} />
        <meshPhysicalMaterial color="#38bdf8" roughness={0.1} transmission={0.85} thickness={0.6} transparent opacity={0.78} emissive="#0284c7" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0,0.2,0]}><torusGeometry args={[0.35,0.08,8,16]} /><meshBasicMaterial color="#67e8f9" /></mesh>
      <mesh position={[0,0.4,0]}><torusGeometry args={[0.2,0.06,8,16]} /><meshBasicMaterial color="#a7f3d0" /></mesh>
      {[-0.4,-0.15,0.15,0.4].map((x,i) => (
        <mesh key={i} position={[x,-1.2,i%2===0?0.2:-0.2]}><cylinderGeometry args={[0.02,0.04,2.4,4]} /><meshBasicMaterial color="#7dd3fc" transparent opacity={0.65} /></mesh>
      ))}
      <pointLight position={[0,0.2,0]} color="#38bdf8" intensity={1.5} distance={5} />
      {hovered && <ScanReticle radius={1.4} color="#38bdf8" />}
    </group>
  );
};

// ─── 5. Fish School (instanced, very efficient) ─────────────────────────────
const FishSchool: React.FC<{ centerPosition: [number,number,number]; count?: number; color?: string }> = ({ centerPosition, count=28, color='#94a3b8' }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy  = useMemo(() => new THREE.Object3D(), []);
  const offsets = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random()-0.5)*7, y: (Math.random()-0.5)*3.5, z: (Math.random()-0.5)*7,
    speed: 0.8+Math.random()*0.4, phase: Math.random()*Math.PI*2
  })), [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    offsets.forEach((f, i) => {
      const t = time*f.speed+f.phase;
      dummy.position.set(centerPosition[0]+f.x+Math.sin(t*0.6)*5, centerPosition[1]+f.y+Math.sin(t*1.2)*0.8, centerPosition[2]+f.z+Math.cos(t*0.6)*5);
      dummy.rotation.set(0, t*0.6+Math.PI/2, Math.sin(t*2)*0.15);
      dummy.scale.set(0.35, 0.15, 0.55);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow>
      <coneGeometry args={[0.3, 1, 4]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.6} />
    </instancedMesh>
  );
};

// ─── 6. Bigeye Thresher Shark ───────────────────────────────────────────────
const ThresherShark: React.FC<{ position: [number,number,number]; speed: number; scale?: number; species: MarineSpecies; onDiscover: (s: MarineSpecies)=>void; isDiscovered: boolean }> = ({ position, speed, scale=1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef  = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    const x = position[0] + Math.sin(t*0.18)*22;
    const y = position[1] + Math.sin(t*0.25)*2;
    const z = position[2] + Math.cos(t*0.14)*14;
    const prevX = groupRef.current.position.x;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, x-prevX>=0 ? Math.PI/2 : -Math.PI/2, 3, delta);
    groupRef.current.rotation.z = Math.sin(t*1.0)*0.06;
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(t*3.5)*0.25;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Streamlined body */}
      <mesh castShadow receiveShadow scale={[0.7, 0.6, 2.2]}>
        <sphereGeometry args={[0.9, 10, 8]} />
        <meshStandardMaterial color={hovered?'#475569':'#1e293b'} roughness={0.5} metalness={0.2} flatShading />
      </mesh>
      {/* Dorsal fin */}
      <mesh position={[0,0.85,0.2]} rotation={[-0.3,0,0]}><coneGeometry args={[0.18,1.1,4]} /><meshStandardMaterial color="#0f172a" flatShading /></mesh>
      {/* Pectoral fins */}
      <mesh position={[-0.9,0,0.4]} rotation={[0.1,0,-0.5]} scale={[1.2,0.06,0.55]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#1e293b" flatShading /></mesh>
      <mesh position={[0.9,0,0.4]} rotation={[0.1,0,0.5]} scale={[1.2,0.06,0.55]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#1e293b" flatShading /></mesh>
      {/* Big upward-pointing eyes */}
      <mesh position={[-0.38,0.35,1.5]}><sphereGeometry args={[0.22,8,8]} /><meshBasicMaterial color="#0ea5e9" /></mesh>
      <mesh position={[0.38,0.35,1.5]}><sphereGeometry args={[0.22,8,8]} /><meshBasicMaterial color="#0ea5e9" /></mesh>
      {/* Long thresher tail (signature feature) */}
      <group ref={tailRef} position={[0,0,-2.0]}>
        <mesh position={[0,1.0,-0.5]} rotation={[-0.4,0,0]}><cylinderGeometry args={[0.06,0.12,2.8,5]} /><meshStandardMaterial color="#0f172a" flatShading /></mesh>
      </group>
      {hovered && <ScanReticle radius={2.0} color="#64748b" />}
    </group>
  );
};

// ─── 7. Glass Squid ─────────────────────────────────────────────────────────
const GlassSquid: React.FC<{ position: [number,number,number]; speed: number; scale?: number; species: MarineSpecies; onDiscover: (s: MarineSpecies)=>void; isDiscovered: boolean }> = ({ position, speed, scale=1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    groupRef.current.position.set(position[0]+Math.sin(t*0.4)*8, position[1]+Math.cos(t*0.6)*2, position[2]+Math.sin(t*0.35)*6);
    groupRef.current.rotation.y = t*0.3;
    groupRef.current.rotation.z = Math.sin(t*1.2)*0.12;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Transparent mantle */}
      <mesh castShadow scale={[0.7, 1.6, 0.7]}>
        <sphereGeometry args={[0.65, 10, 10]} />
        <meshPhysicalMaterial color="#bae6fd" roughness={0.05} transmission={0.9} thickness={0.3} transparent opacity={0.5} emissive="#60a5fa" emissiveIntensity={0.3} />
      </mesh>
      {/* Photophores under eyes */}
      <mesh position={[-0.28,-0.2,0.55]}><sphereGeometry args={[0.1,6,6]} /><meshBasicMaterial color="#60a5fa" /></mesh>
      <mesh position={[0.28,-0.2,0.55]}><sphereGeometry args={[0.1,6,6]} /><meshBasicMaterial color="#60a5fa" /></mesh>
      <pointLight position={[0,-0.2,0.55]} color="#60a5fa" intensity={0.8} distance={4} />
      {/* Fins */}
      <mesh position={[-0.55,0.3,0]} rotation={[0,0,-0.5]} scale={[0.6,0.06,0.4]}><boxGeometry args={[1,1,1]} /><meshPhysicalMaterial color="#bae6fd" transparent opacity={0.55} transmission={0.5} /></mesh>
      <mesh position={[0.55,0.3,0]} rotation={[0,0,0.5]} scale={[0.6,0.06,0.4]}><boxGeometry args={[1,1,1]} /><meshPhysicalMaterial color="#bae6fd" transparent opacity={0.55} transmission={0.5} /></mesh>
      {/* Tentacles */}
      {[-0.25,-0.08,0.08,0.25].map((x,i) => (
        <mesh key={i} position={[x,-0.9,0]}><cylinderGeometry args={[0.025,0.04,1.6,4]} /><meshBasicMaterial color="#93c5fd" transparent opacity={0.55} /></mesh>
      ))}
      {hovered && <ScanReticle radius={0.9} color="#60a5fa" />}
    </group>
  );
};

// ─── 8. Giant Siphonophore ──────────────────────────────────────────────────
const Siphonophore: React.FC<{ position: [number,number,number]; speed: number; scale?: number; species: MarineSpecies; onDiscover: (s: MarineSpecies)=>void; isDiscovered: boolean }> = ({ position, speed, scale=1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const segments = useMemo(() => Array.from({length:18}, (_,i) => ({ y: -i*0.8, phase: i*0.4 })), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    groupRef.current.position.set(position[0]+Math.sin(t*0.15)*10, position[1]+Math.cos(t*0.12)*3, position[2]+Math.cos(t*0.18)*8);
    groupRef.current.rotation.y = t * 0.08;
    groupRef.current.children.forEach((child, i) => {
      child.position.x = Math.sin(t*0.8 + i*0.35) * 0.35;
    });
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {segments.map((seg, i) => (
        <mesh key={i} position={[0, seg.y, 0]}>
          <sphereGeometry args={[0.2 - i*0.005, 8, 8]} />
          <meshPhysicalMaterial
            color={i%2===0?'#38bdf8':'#67e8f9'}
            transparent opacity={0.7} transmission={0.3}
            emissive={i%3===0?'#0284c7':'#22d3ee'} emissiveIntensity={0.5}
          />
        </mesh>
      ))}
      <pointLight position={[0,-4,0]} color="#22d3ee" intensity={1.2} distance={8} />
      {hovered && <ScanReticle radius={1.0} color="#22d3ee" />}
    </group>
  );
};

// ─── 9. Anglerfish ──────────────────────────────────────────────────────────
const Anglerfish3D: React.FC<{ position: [number,number,number]; speed: number; scale?: number; species: MarineSpecies; onDiscover: (s: MarineSpecies)=>void; isDiscovered: boolean }> = ({ position, speed, scale=1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const lureLightRef = useRef<THREE.PointLight>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    groupRef.current.position.set(position[0]+Math.cos(t*0.4)*2.5, position[1]+Math.sin(t*0.7)*0.4, position[2]+Math.sin(t*0.5)*1.5);
    groupRef.current.rotation.y = Math.sin(t*0.4)*0.3 + Math.PI/4;
    groupRef.current.rotation.z = Math.sin(t*0.8)*0.05;
    if (lureLightRef.current) lureLightRef.current.intensity = 2.0 + Math.sin(t*8)*0.8;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      <mesh castShadow scale={[1.1,0.95,1.3]}><sphereGeometry args={[1,10,10]} /><meshStandardMaterial color={hovered?'#475569':'#0f172a'} roughness={0.9} metalness={0.1} flatShading /></mesh>
      <mesh position={[0,-0.4,0.6]} rotation={[0.3,0,0]}><boxGeometry args={[1.0,0.35,1.1]} /><meshStandardMaterial color="#0b1120" roughness={0.9} flatShading /></mesh>
      {[-0.35,-0.15,0.05,0.25].map((x,i) => (
        <mesh key={i} position={[x,-0.15,1.05]} rotation={[-0.3,0,0]}><coneGeometry args={[0.04,0.3,3]} /><meshBasicMaterial color="#e2e8f0" /></mesh>
      ))}
      <mesh position={[0,0.9,0.6]} rotation={[-0.8,0,0]}><cylinderGeometry args={[0.03,0.05,1.2,5]} /><meshStandardMaterial color="#1e293b" /></mesh>
      <mesh position={[0,1.45,1.1]}><sphereGeometry args={[0.18,12,12]} /><meshBasicMaterial color="#22d3ee" /></mesh>
      <pointLight ref={lureLightRef} position={[0,1.45,1.1]} color="#22d3ee" intensity={2.5} distance={7} />
      {hovered && <ScanReticle radius={1.8} color="#22d3ee" />}
    </group>
  );
};

// ─── 10. Viperfish ──────────────────────────────────────────────────────────
const Viperfish: React.FC<{ position: [number,number,number]; speed: number; scale?: number; species: MarineSpecies; onDiscover: (s: MarineSpecies)=>void; isDiscovered: boolean }> = ({ position, speed, scale=1, species, onDiscover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    const x = position[0] + Math.sin(t*0.22)*14;
    const y = position[1] + Math.cos(t*0.3)*1.5;
    const z = position[2] + Math.cos(t*0.18)*8;
    const prevX = groupRef.current.position.x;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, x-prevX>=0?Math.PI/2:-Math.PI/2, 4, delta);
  });

  return (
    <group ref={groupRef} position={position} scale={scale}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onDiscover(species); }}>
      {/* Slender dark body */}
      <mesh castShadow scale={[0.5, 0.5, 2.5]}><sphereGeometry args={[0.65, 8, 8]} /><meshStandardMaterial color={hovered?'#334155':'#0f172a'} roughness={0.85} flatShading /></mesh>
      {/* Fang teeth (needle-like, extended outside mouth) */}
      {[-0.18,-0.06,0.06,0.18].map((x,i) => (
        <mesh key={i} position={[x,-0.25,1.45]} rotation={[0.5,0,0]}><coneGeometry args={[0.025,0.45,3]} /><meshBasicMaterial color="#e2e8f0" /></mesh>
      ))}
      {/* Photophore belly row */}
      {[-0.8,-0.4,0,0.4,0.8].map((z,i) => (
        <mesh key={i} position={[0,-0.32,z]}><sphereGeometry args={[0.06,5,5]} /><meshBasicMaterial color="#38bdf8" /></mesh>
      ))}
      <pointLight position={[0,-0.3,0]} color="#38bdf8" intensity={0.5} distance={3} />
      {hovered && <ScanReticle radius={0.8} color="#38bdf8" />}
    </group>
  );
};

// ─── Main Export ─────────────────────────────────────────────────────────────
export const Creatures3D: React.FC<Creatures3DProps> = ({ currentDepth, onDiscoverSpecies, discoveredSpeciesIds }) => {
  const speciesList = useMemo(() => MARINE_SPECIES_CATALOG, []);

  const getSpecies = (id: string): MarineSpecies =>
    speciesList.find(s => s.id === id) || {
      id, name: 'Unknown Oceanic Specimen', scientificName: 'Sp. bathypelagia',
      depthRange: '0-1000m', minDepth: 0, maxDepth: 1000, rarity: 'Rare' as const,
      points: 50, description: 'Deep ocean creature.', color: '#06b6d4', type: 'fish',
    };

  // World Y positions (Y=0 is surface, Y=-200 is 1000m)
  // Band 0-100m:  Y 0 to -20
  // Band 100-250m: Y -20 to -50
  // Band 250-500m: Y -50 to -100
  // Band 500-700m: Y -100 to -140
  // Band 700-1000m: Y -140 to -200

  return (
    <group>
      {/* ── SURFACE / REEF ZONE (0-100m | Y: 0 to -20) ── */}
      <TunaFish position={[3, -4, -7]} speed={1.2} scale={1.1} species={getSpecies('yellowfin-tuna')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('yellowfin-tuna')} />
      <TunaFish position={[-6, -10, -9]} speed={0.9} scale={0.95} species={getSpecies('yellowfin-tuna')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('yellowfin-tuna')} />
      <TunaFish position={[8, -7, -5]} speed={1.05} scale={0.85} species={getSpecies('yellowfin-tuna')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('yellowfin-tuna')} />

      <FishSchool centerPosition={[-4, -6, -12]} count={32} color="#94a3b8" />
      <FishSchool centerPosition={[6, -14, -10]} count={22} color="#7dd3fc" />

      <MantaRay position={[0, -18, -8]} speed={0.7} scale={1.3} species={getSpecies('reef-manta')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('reef-manta')} />

      <SeaTurtle position={[-5, -12, -6]} speed={0.55} scale={1.0} species={getSpecies('hawksbill-turtle')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('hawksbill-turtle')} />
      <SeaTurtle position={[7, -8, -10]} speed={0.48} scale={0.85} species={getSpecies('hawksbill-turtle')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('hawksbill-turtle')} />

      {/* ── THERMOCLINE BAND (100-250m | Y: -20 to -50) ── */}
      <BioluminescentJellyfish position={[4, -25, -7]} speed={0.8} scale={1.0} species={getSpecies('comb-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('comb-jelly')} />
      <BioluminescentJellyfish position={[-7, -32, -9]} speed={0.65} scale={1.3} species={getSpecies('comb-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('comb-jelly')} />
      <BioluminescentJellyfish position={[2, -42, -6]} speed={0.72} scale={0.9} species={getSpecies('bioluminescent-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('bioluminescent-jelly')} />

      <ThresherShark position={[5, -38, -8]} speed={0.8} scale={1.4} species={getSpecies('bigeye-thresher')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('bigeye-thresher')} />

      <FishSchool centerPosition={[-3, -30, -11]} count={18} color="#bae6fd" />

      {/* ── MESOPELAGIC TWILIGHT (250-500m | Y: -50 to -100) ── */}
      <BioluminescentJellyfish position={[-5, -58, -10]} speed={0.6} scale={1.5} species={getSpecies('bioluminescent-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('bioluminescent-jelly')} />
      <BioluminescentJellyfish position={[6, -70, -7]} speed={0.75} scale={1.1} species={getSpecies('bioluminescent-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('bioluminescent-jelly')} />
      <BioluminescentJellyfish position={[-2, -85, -9]} speed={0.5} scale={1.4} species={getSpecies('comb-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('comb-jelly')} />

      <GlassSquid position={[3, -62, -8]} speed={0.9} scale={1.2} species={getSpecies('glass-squid')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('glass-squid')} />
      <GlassSquid position={[-6, -78, -6]} speed={0.75} scale={1.0} species={getSpecies('glass-squid')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('glass-squid')} />

      <Siphonophore position={[-4, -92, -9]} speed={0.4} scale={1.3} species={getSpecies('deep-siphonophore')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('deep-siphonophore')} />

      {/* ── OXYGEN MINIMUM ZONE (500-700m | Y: -100 to -140) ── */}
      <BioluminescentJellyfish position={[5, -108, -7]} speed={0.55} scale={1.6} species={getSpecies('bioluminescent-jelly')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('bioluminescent-jelly')} />
      <Siphonophore position={[3, -120, -8]} speed={0.35} scale={1.5} species={getSpecies('deep-siphonophore')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('deep-siphonophore')} />
      <GlassSquid position={[-5, -130, -6]} speed={0.65} scale={1.3} species={getSpecies('glass-squid')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('glass-squid')} />
      <Viperfish position={[4, -115, -7]} speed={0.7} scale={1.1} species={getSpecies('viperfish')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('viperfish')} />

      {/* ── ABYSSAL MIDNIGHT ZONE (700-1000m | Y: -140 to -200) ── */}
      <Anglerfish3D position={[3, -150, -6]} speed={0.55} scale={1.2} species={getSpecies('deep-sea-angler')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('deep-sea-angler')} />
      <Anglerfish3D position={[-5, -168, -8]} speed={0.5} scale={1.4} species={getSpecies('anglerfish')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('anglerfish')} />
      <Anglerfish3D position={[2, -190, -7]} speed={0.45} scale={1.0} species={getSpecies('anglerfish')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('anglerfish')} />
      <Viperfish position={[-4, -158, -7]} speed={0.62} scale={1.25} species={getSpecies('viperfish')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('viperfish')} />
      <Viperfish position={[6, -178, -5]} speed={0.55} scale={1.1} species={getSpecies('viperfish')} onDiscover={onDiscoverSpecies} isDiscovered={discoveredSpeciesIds.includes('viperfish')} />
    </group>
  );
};