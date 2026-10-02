/**
 * VampireSquid.tsx — OMZ Theme
 *
 * Detailed Vampire Squid (Vampyroteuthis infernalis).
 * Features:
 * - Deep crimson webbed cloak (mantle) with vertex shader to simulate slow, pulsating swimming (medusoid swimming).
 * - Glowing photophores at the tips of the arms.
 * - Huge, opaque blue/red eyes (adapted to low light).
 * - Very slow, energy-conserving drifting behavior.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

const CLOAK_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;
    
    // Medusoid pulsation: the cloak expands and contracts slowly
    float pulse = sin(uTime * 1.5 - pos.y * 2.0);
    // Expand more at the bottom (y is negative)
    float expansion = smoothstep(0.0, -2.0, pos.y);
    
    pos.x += normal.x * pulse * expansion * 0.4;
    pos.z += normal.z * pulse * expansion * 0.4;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const CLOAK_FRAG = `
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    // Deep crimson/maroon color
    vec3 baseCol = vec3(0.4, 0.05, 0.1);
    
    // Velvety rim lighting
    float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
    rim = smoothstep(0.6, 1.0, rim);
    
    vec3 finalCol = mix(baseCol, vec3(0.7, 0.1, 0.2), rim * 0.5);
    
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

export const VampireSquid: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    uniforms.uTime.value = time;
    
    // Slow hovering drift conserving metabolic oxygen
    groupRef.current.position.set(
      Math.sin(time * 0.2) * 6,
      depthToY(700) + Math.sin(time * 0.3) * 2.0,
      Math.cos(time * 0.15) * 6
    );
    
    // Slowly orient in the direction of travel
    groupRef.current.rotation.y = Math.atan2(Math.cos(time * 0.2), -Math.sin(time * 0.15));
    // Gentle pitch/roll
    groupRef.current.rotation.z = Math.sin(time * 0.6) * 0.1;
    groupRef.current.rotation.x = Math.sin(time * 0.4) * 0.1;
  });

  return (
    <group ref={groupRef} scale={1.5}>
      {/* Crimson webbed cloak mantle */}
      <mesh position={[0, 0.5, 0]}>
        {/* Open at the bottom, pointed at the top */}
        <coneGeometry args={[1.2, 2.5, 16, 16, true]} />
        <shaderMaterial 
          vertexShader={CLOAK_VERT}
          fragmentShader={CLOAK_FRAG}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Main body inside the cloak */}
      <mesh position={[0, 0.8, 0]} scale={[0.6, 1.2, 0.6]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#30030a" roughness={0.8} />
      </mesh>

      {/* Huge opaque blue/red orb eyes */}
      <mesh position={[-0.45, 0.5, 0.4]} scale={0.3}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshPhysicalMaterial
          color="#0284c7"
          transmission={0.3}
          roughness={0.2}
          emissive="#0369a1"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh position={[0.45, 0.5, 0.4]} scale={0.3}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshPhysicalMaterial
          color="#0284c7"
          transmission={0.3}
          roughness={0.2}
          emissive="#0369a1"
          emissiveIntensity={0.6}
        />
      </mesh>
      
      {/* Bioluminescent arm-tip photophores */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 1.1;
        // Position them at the edge of the mantle
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        return (
          <mesh key={i} position={[x, -0.7, z]} scale={0.06}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color="#38bdf8" />
            <pointLight color="#38bdf8" intensity={0.5} distance={2} />
          </mesh>
        );
      })}
    </group>
  );
};
