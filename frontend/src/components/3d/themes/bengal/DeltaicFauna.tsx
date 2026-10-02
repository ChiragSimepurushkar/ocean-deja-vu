/**
 * DeltaicFauna.tsx — Bay of Bengal Plume Theme
 *
 * Estuarine species adapted to turbid, mixed-salinity environments.
 * Features:
 * - Irrawaddy Dolphin with swimming animation vertex shader.
 * - Estuarine Eagle Ray with "flying" wing flap vertex shader.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const DOLPHIN_VERT = `
  uniform float uTime;
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;
    // Up-and-down tail pumping (unlike fish which are side-to-side)
    float tail = clamp(-pos.z, 0.0, 3.0);
    pos.y += sin(uTime * 3.0 - tail * 1.5) * 0.15 * tail;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const RAY_VERT = `
  uniform float uTime;
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;
    // Wing flapping (up and down on the X axis)
    float wing = abs(pos.x);
    pos.y += sin(uTime * 2.0 - pos.z * 1.5) * 0.3 * wing;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const DEFAULT_FRAG = `
  varying vec3 vNormal;
  uniform vec3 uColor;
  void main() {
    float light = max(dot(vNormal, vec3(0.0, 1.0, 0.5)), 0.2);
    gl_FragColor = vec4(uColor * light, 1.0);
  }
`;

export const DeltaicFauna: React.FC = () => {
  const dolphinRef = useRef<THREE.Group>(null);
  const rayRef = useRef<THREE.Group>(null);

  const dolphinUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#475569") }
  }), []);

  const rayUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#1e293b") }
  }), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    dolphinUniforms.uTime.value = time;
    rayUniforms.uTime.value = time;

    // Dolphin breaching the halocline repeatedly
    if (dolphinRef.current) {
      const angle = time * 0.25;
      dolphinRef.current.position.set(
        Math.sin(angle) * 16,
        -15 + Math.sin(time * 0.8) * 2.5, // Porpoising motion
        Math.cos(angle) * 12
      );
      dolphinRef.current.rotation.y = angle + Math.PI / 2;
      // Pitch matching the up/down motion
      dolphinRef.current.rotation.x = Math.cos(time * 0.8) * 0.3;
    }

    if (rayRef.current) {
      const angle = time * 0.2;
      rayRef.current.position.set(
        Math.cos(angle) * 14,
        -28 + Math.sin(time * 0.4) * 0.8,
        Math.sin(angle) * 12
      );
      rayRef.current.rotation.y = -angle; // Opposite direction
      // Banking
      rayRef.current.rotation.z = Math.sin(time * 0.4) * 0.2 - 0.2; // Constant bank due to circle
    }
  });

  return (
    <group>
      {/* Irrawaddy / Indo-Pacific Dolphin */}
      <group ref={dolphinRef} scale={1.2}>
        {/* Rounded head / body */}
        <mesh scale={[0.6, 0.5, 2.0]}>
          <sphereGeometry args={[1, 16, 16]} />
          <shaderMaterial
            vertexShader={DOLPHIN_VERT}
            fragmentShader={DEFAULT_FRAG}
            uniforms={dolphinUniforms}
          />
        </mesh>
        {/* Dorsal fin (very small on Irrawaddy dolphins) */}
        <mesh position={[0, 0.45, 0.2]} rotation={[-0.4, 0, 0]}>
          <coneGeometry args={[0.1, 0.4, 4]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {/* Pectoral flippers */}
        <mesh position={[-0.5, -0.2, 0.8]} rotation={[0, -0.2, -0.3]}>
          <coneGeometry args={[0.15, 0.8, 4]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        <mesh position={[0.5, -0.2, 0.8]} rotation={[0, 0.2, 0.3]}>
          <coneGeometry args={[0.15, 0.8, 4]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        {/* Horizontal Flukes */}
        <mesh position={[0, 0, -2.0]} rotation={[-0.2, 0, 0]}>
           <cylinderGeometry args={[0.05, 0.05, 1.2, 4]} />
           <meshStandardMaterial color="#475569" />
        </mesh>
      </group>

      {/* Estuarine Eagle Ray */}
      <group ref={rayRef} scale={1.2}>
        <mesh scale={[1.8, 0.1, 1.2]}>
          <sphereGeometry args={[1, 16, 16]} />
          <shaderMaterial
            vertexShader={RAY_VERT}
            fragmentShader={DEFAULT_FRAG}
            uniforms={rayUniforms}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Long whip tail */}
        <mesh position={[0, 0, -1.8]} rotation={[-Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.05, 2.5, 4]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>
    </group>
  );
};
