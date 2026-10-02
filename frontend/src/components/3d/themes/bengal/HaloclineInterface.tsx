/**
 * HaloclineInterface.tsx — Bay of Bengal Plume Theme
 *
 * Visualizes the boundary layer between the turbid freshwater river runoff 
 * and the denser, clearer oceanic saltwater below.
 * 
 * Features:
 * - Undulating halocline density sheet with a vertex shader.
 * - Fragment shader creates a refractive, blurry, mixing pattern at the interface.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BENGAL_PLUME_CONFIG } from './Config';

const HALOCLINE_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Internal wave: slow, large undulating motion
    float waveX = sin(pos.x * 0.1 + uTime * 0.4) * 0.8;
    float waveY = cos(pos.y * 0.15 + uTime * 0.3) * 0.6;
    pos.z += waveX + waveY;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const HALOCLINE_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  
  // Simple noise for mixing/turbidity
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  
  void main() {
    // Flowing mixing lines
    float mixX = sin(vUv.x * 30.0 + uTime) * cos(vUv.y * 25.0 + uTime * 0.8);
    float noise = hash(floor(vUv * 50.0 + uTime));
    
    // Gradient from turbid greenish-brown to ocean blue-green
    vec3 turbid = vec3(0.5, 0.5, 0.3);
    vec3 oceanic = vec3(0.1, 0.4, 0.4);
    
    vec3 col = mix(oceanic, turbid, mixX * 0.5 + 0.5);
    
    // Add some noise for suspended sediment
    col += noise * 0.05;
    
    // Edge fade
    float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x) *
                 smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
                 
    gl_FragColor = vec4(col, 0.3 * edge);
  }
`;

export const HaloclineInterface: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    uniforms.uTime.value = time;
    meshRef.current.position.y = BENGAL_PLUME_CONFIG.haloclineY;
  });

  return (
    <group>
      {/* Semi-transparent undulating halocline density sheet */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120, 40, 40]} />
        <shaderMaterial
          vertexShader={HALOCLINE_VERT}
          fragmentShader={HALOCLINE_FRAG}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};
