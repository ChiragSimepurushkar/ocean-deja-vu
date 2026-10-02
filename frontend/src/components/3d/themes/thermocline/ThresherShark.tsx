/**
 * ThresherShark.tsx — Thermocline Theme
 *
 * Detailed Pelagic Thresher Shark (Alopias pelagicus).
 * Features:
 * - Torpedo body.
 * - Huge bigeye adaptation for hunting in the twilight pycnocline.
 * - Long whip-like scythe caudal tail with a vertex shader to swing back and forth.
 * - Swimming animation along a curved path.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { THERMOCLINE_CONFIG } from './Config';

const TAIL_VERT = `
  uniform float uTime;
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;
    
    // The tail is a cylinder extending along the y-axis (locally)
    // We want it to swing left/right (x-axis) based on how far up it is (y)
    float tailLength = clamp(pos.y, 0.0, 3.2); // Assuming length ~ 3.2
    
    // Whip motion: sine wave that increases in amplitude down the tail
    float swing = sin(uTime * 4.0 - tailLength * 1.5) * 0.3 * tailLength;
    pos.x += swing;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const TAIL_FRAG = `
  varying vec3 vNormal;
  void main() {
    // Dark slate grey top, slightly lighter bottom
    float light = max(dot(vNormal, vec3(0.0, 1.0, 0.5)), 0.2);
    vec3 col = mix(vec3(0.05, 0.08, 0.12), vec3(0.15, 0.2, 0.28), light);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const ThermoclineThresherShark: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const seamY = THERMOCLINE_CONFIG.seamY;

  const tailUniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    tailUniforms.uTime.value = time;
    
    // Wide circling path
    const radius = 18;
    const speed = 0.3;
    const angle = time * speed;
    
    groupRef.current.position.set(
      Math.sin(angle) * radius,
      seamY - 5 + Math.sin(time * 0.2) * 2.5,
      Math.cos(angle) * radius * 0.7
    );
    
    // Face tangent to the path
    groupRef.current.rotation.y = angle + Math.PI / 2;
    // Slight banking
    groupRef.current.rotation.z = Math.sin(time * 0.5) * 0.1;
    // Pitch slightly up/down based on vertical movement
    groupRef.current.rotation.x = Math.cos(time * 0.2) * 0.05;
  });

  return (
    <group ref={groupRef} scale={1.5}>
      {/* Torpedo body */}
      <mesh scale={[0.65, 0.55, 2.2]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </mesh>
      
      {/* Pectoral fins */}
      <mesh position={[-0.8, -0.2, 0.5]} rotation={[0, -0.2, -0.4]}>
        <coneGeometry args={[0.2, 1.5, 4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </mesh>
      <mesh position={[0.8, -0.2, 0.5]} rotation={[0, 0.2, 0.4]}>
        <coneGeometry args={[0.2, 1.5, 4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </mesh>
      
      {/* Dorsal fin */}
      <mesh position={[0, 0.7, 0.2]} rotation={[0.4, 0, 0]}>
        <coneGeometry args={[0.15, 0.8, 4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </mesh>

      {/* Huge bigeye adaptation for twilight pycnocline */}
      <mesh position={[-0.45, 0.1, 1.4]} scale={0.18}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.8} />
      </mesh>
      <mesh position={[0.45, 0.1, 1.4]} scale={0.18}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.8} />
      </mesh>
      
      {/* Long whip-like scythe caudal tail with swinging shader */}
      {/* Positioned at the back of the body, extending backwards and slightly upwards */}
      <mesh position={[0, 0, -2.1]} rotation={[-1.2, 0, 0]}>
        {/* We need the geometry to extend along +Y in its local space so the shader's clamp(pos.y) works */}
        <cylinderGeometry args={[0.04, 0.15, 4.0, 8, 16]} />
        <shaderMaterial
          vertexShader={TAIL_VERT}
          fragmentShader={TAIL_FRAG}
          uniforms={tailUniforms}
        />
      </mesh>
      
      {/* Lower caudal lobe (small) */}
      <mesh position={[0, -0.3, -2.2]} rotation={[0.6, 0, 0]}>
        <coneGeometry args={[0.1, 0.5, 4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </mesh>
    </group>
  );
};
