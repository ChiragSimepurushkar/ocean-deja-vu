/**
 * WhaleShark.tsx — Monsoon Bloom Theme
 *
 * Detailed Whale Shark (Rhincodon typus).
 * Features:
 * - Flattened wide head & spindle body.
 * - Broad transverse filter-feeding mouth.
 * - Vertex shader for realistic side-to-side swimming motion down the spine.
 * - White spotted skin pattern using a fragment shader overlay.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const WHALESHARK_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  
  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Side-to-side swimming motion
    // Assuming length ~4, tail is at -z
    float spine = clamp(-pos.z, 0.0, 4.0);
    pos.x += sin(uTime * 1.5 - spine * 1.8) * 0.15 * spine;
    
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WHALESHARK_FRAG = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  
  // Simple 3D hash for spots
  float hash3D(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  void main() {
    // Base color: dark blue-grey back, pale belly
    vec3 backCol = vec3(0.15, 0.20, 0.25);
    vec3 bellyCol = vec3(0.9, 0.9, 0.85);
    
    // Y-based gradient for countershading
    float belly = smoothstep(0.4, 0.6, vUv.y); 
    vec3 col = mix(backCol, bellyCol, belly);
    
    // White spots on the back
    float spots = 0.0;
    // Only put spots on the top and sides, not the belly
    if (belly < 0.5) {
      // Cell noise approach
      vec3 fp = floor(vWorldPos * 6.0);
      float h = hash3D(fp);
      if (h > 0.9) {
        vec3 rp = fract(vWorldPos * 6.0);
        float d = length(rp - vec3(0.5));
        spots = smoothstep(0.3, 0.1, d);
      }
      
      // Horizontal stripes (checkerboard effect of spots)
      float stripes = smoothstep(0.8, 1.0, sin(vWorldPos.z * 15.0));
      float vStripes = smoothstep(0.8, 1.0, sin(vWorldPos.y * 15.0));
      spots += (stripes * vStripes * 0.5) * smoothstep(0.5, 0.0, belly);
    }
    
    col = mix(col, vec3(0.95, 0.95, 0.9), clamp(spots, 0.0, 1.0));
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const FilterFeedingWhaleShark: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    uniforms.uTime.value = time;
    
    // Gentle cruising through dense plankton soup
    groupRef.current.position.set(
      Math.sin(time * 0.15) * 20,
      -25 + Math.sin(time * 0.2) * 2.5,
      -15 + Math.cos(time * 0.12) * 10
    );
    groupRef.current.rotation.y = time * 0.15 + Math.PI / 2;
    groupRef.current.rotation.z = Math.sin(time * 0.8) * 0.05; // Gentle roll
  });

  return (
    <group ref={groupRef} scale={3.5}>
      {/* Flattened wide head & spindle body */}
      <mesh scale={[1.2, 0.7, 3.8]}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial
          vertexShader={WHALESHARK_VERT}
          fragmentShader={WHALESHARK_FRAG}
          uniforms={uniforms}
        />
      </mesh>
      
      {/* Broad transverse filter-feeding mouth */}
      <mesh position={[0, -0.1, 3.6]} scale={[1.1, 0.3, 0.4]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      
      {/* Pectoral fins */}
      <mesh position={[-1.0, -0.3, 1.5]} rotation={[0, -0.2, -0.2]}>
        <coneGeometry args={[0.2, 1.5, 4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[1.0, -0.3, 1.5]} rotation={[0, 0.2, 0.2]}>
        <coneGeometry args={[0.2, 1.5, 4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      
      {/* Large dorsal fin */}
      <mesh position={[0, 0.9, -0.8]} rotation={[-0.4, 0, 0]}>
        <coneGeometry args={[0.25, 1.4, 4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      
      {/* Tail fin (caudal fin, heterocercal - top lobe longer) */}
      <mesh position={[0, 0.5, -3.8]} rotation={[-1.2, 0, 0]}>
        <coneGeometry args={[0.15, 2.0, 4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, -0.3, -3.8]} rotation={[0.8, 0, 0]}>
        <coneGeometry args={[0.1, 1.2, 4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
};
