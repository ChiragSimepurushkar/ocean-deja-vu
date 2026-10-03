/**
 * PelagicFauna.tsx — Open Ocean Theme
 *
 * Fast-moving pelagic ecosystem.
 * Features:
 * - A large school of fast-swimming Tuna, using InstancedMesh with a custom vertex shader for tail beating.
 * - Cruising Oceanic Whitetip Shark.
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

// ─── Tuna School Shader ─────────────────────────────────────────────────────
const TUNA_VERT = `
  uniform float uTime;
  attribute float aPhase;
  attribute float aSpeed;
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;
    
    // Fast tail beating (swimming motion)
    // The fish is oriented along the Z axis
    float tail = clamp(-pos.z, 0.0, 5.0);
    pos.x += sin(uTime * aSpeed * 10.0 + aPhase) * 0.15 * tail;
    
    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(pos, 1.0));
  }
`;

const TUNA_FRAG = `
  varying vec3 vNormal;
  void main() {
    // Silver/blue countershading
    float top = max(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.0);
    float side = max(dot(vNormal, vec3(1.0, 0.0, 0.0)), 0.0) + max(dot(vNormal, vec3(-1.0, 0.0, 0.0)), 0.0);
    
    vec3 topCol = vec3(0.1, 0.2, 0.4); // Dark blue top
    vec3 sideCol = vec3(0.8, 0.85, 0.9); // Silver sides
    vec3 botCol = vec3(0.95, 0.95, 1.0); // White belly
    
    vec3 col = mix(botCol, sideCol, side);
    col = mix(col, topCol, top);
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const PelagicFauna: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  const schoolRef = useRef<THREE.InstancedMesh>(null);
  const sharkRef = useRef<THREE.Group>(null);
  const count = 80;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  const boidData = useMemo(() => {
    const data = [];
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      data.push({
        x: (Math.random() - 0.5) * 18,
        y: (Math.random() - 0.5) * 8,
        z: (Math.random() - 0.5) * 18,
        speed: 1.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
      phases[i] = data[i].phase;
      speeds[i] = data[i].speed;
    }
    return { data, phases, speeds };
  }, [count]);

  const schoolGeo = useMemo(() => {
    const geo = new THREE.ConeGeometry(0.3, 1.5, 6);
    // Rotate so it points along -Z
    geo.rotateX(Math.PI / 2);
    geo.setAttribute('aPhase', new THREE.BufferAttribute(boidData.phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(boidData.speeds, 1));
    return geo;
  }, [boidData]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    uniforms.uTime.value = time;

    // Fast-swimming tuna school circling the viewer
    if (schoolRef.current) {
      const leaderAngle = time * 0.4;
      const leaderRadius = 25;
      const leaderX = Math.sin(leaderAngle) * leaderRadius;
      const leaderZ = Math.cos(leaderAngle) * leaderRadius;
      
      boidData.data.forEach((b, i) => {
        const t = time * b.speed + b.phase;
        
        // Follow leader but drift slightly
        const px = leaderX + b.x + Math.sin(t * 0.5) * 2;
        const py = depthToY(40) + b.y + Math.sin(t * 0.8) * 1.5;
        const pz = leaderZ + b.z + Math.cos(t * 0.4) * 2;
        
        dummy.position.set(px, py, pz);
        // Face tangent to the circle path roughly
        dummy.rotation.set(
          Math.sin(t) * 0.1, // Pitch
          leaderAngle + Math.PI / 2 + Math.sin(t * 0.7) * 0.2, // Yaw
          Math.cos(t * 0.9) * 0.15 // Roll
        );
        dummy.updateMatrix();
        schoolRef.current!.setMatrixAt(i, dummy.matrix);
      });
      schoolRef.current.instanceMatrix.needsUpdate = true;
    }

    // Cruising oceanic whitetip shark
    if (sharkRef.current) {
      sharkRef.current.position.set(
        Math.cos(time * 0.2) * 28,
        depthToY(60) + Math.sin(time * 0.3) * 3,
        Math.sin(time * 0.15) * 22
      );
      // Face direction of travel
      sharkRef.current.rotation.y = Math.atan2(Math.cos(time * 0.15), -Math.sin(time * 0.2));
      // Slight banking
      sharkRef.current.rotation.z = Math.sin(time * 0.5) * 0.1;
    }
  });

  return (
    <group>
      <instancedMesh ref={schoolRef} args={[undefined, undefined, count]} geometry={schoolGeo}>
        <shaderMaterial
          vertexShader={TUNA_VERT}
          fragmentShader={TUNA_FRAG}
          uniforms={uniforms}
        />
      </instancedMesh>

      {/* Pelagic Shark (Oceanic Whitetip) */}
      <group ref={sharkRef} scale={1.8}>
        {/* Torpedo body */}
        <mesh scale={[0.8, 0.7, 3.2]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color="#475569" roughness={0.4} />
        </mesh>
        
        {/* Distinctive rounded dorsal fin with white tip */}
        <mesh position={[0, 0.9, 0.2]} rotation={[-0.3, 0, 0]}>
          <coneGeometry args={[0.25, 1.4, 4]} />
          {/* We'll just use a solid color for now, proper white tip needs a texture or shader */}
          <meshStandardMaterial color="#334155" />
        </mesh>
        
        {/* Large pectoral fins with white tips */}
        <mesh position={[-0.8, -0.2, 0.5]} rotation={[0, -0.2, -0.5]}>
          <coneGeometry args={[0.3, 2.5, 4]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        <mesh position={[0.8, -0.2, 0.5]} rotation={[0, 0.2, 0.5]}>
          <coneGeometry args={[0.3, 2.5, 4]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        
        {/* Tail fin */}
        <mesh position={[0, 0, -3.0]} rotation={[-1.2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.15, 1.8, 4]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>
    </group>
  );
};
