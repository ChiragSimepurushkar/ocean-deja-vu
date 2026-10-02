/**
 * CombJelly.tsx — Thermocline Theme
 *
 * Detailed Comb Jelly (Ctenophore).
 * Features:
 * - Translucent lobate ellipsoid bell with refraction/transmission.
 * - 8 iridescent ciliated comb rows with a scrolling rainbow shader.
 * - Slowly drifts and rotates in the current.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { THERMOCLINE_CONFIG } from './Config';

const COMB_ROW_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const COMB_ROW_FRAG = `
  uniform float uTime;
  varying vec2 vUv;

  // Simple cosine-based rainbow palette
  vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b * cos( 6.28318 * (c * t + d) );
  }

  void main() {
    // Scroll the rainbow down the row
    float t = vUv.y * 3.0 - uTime * 2.5;
    
    // Create the "flashing" comb plates effect (bands)
    float bands = step(0.5, fract(vUv.y * 20.0));
    
    // Rainbow palette
    vec3 col = palette(
      t, 
      vec3(0.5, 0.5, 0.5), 
      vec3(0.5, 0.5, 0.5), 
      vec3(1.0, 1.0, 1.0), 
      vec3(0.0, 0.33, 0.67)
    );
    
    gl_FragColor = vec4(col * bands, bands * 0.8);
  }
`;

export const CombJelly: React.FC = () => {
  const jellyRef = useRef<THREE.Group>(null);
  const seamY = THERMOCLINE_CONFIG.seamY;

  const combUniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (!jellyRef.current) return;
    const time = state.clock.getElapsedTime();
    combUniforms.uTime.value = time;
    
    jellyRef.current.position.set(
      Math.sin(time * 0.4) * 8,
      seamY + Math.sin(time * 0.6) * 3,
      Math.cos(time * 0.3) * 6
    );
    
    // Slow, tumbling drift
    jellyRef.current.rotation.y = time * 0.2;
    jellyRef.current.rotation.z = Math.sin(time * 1.2) * 0.2;
    jellyRef.current.rotation.x = Math.cos(time * 0.8) * 0.2;
  });

  return (
    <group ref={jellyRef} scale={1.2}>
      {/* Translucent lobate ellipsoid bell */}
      <mesh scale={[0.8, 1.3, 0.8]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhysicalMaterial
          color="#1e3a8a"
          roughness={0.05}
          transmission={0.9}
          thickness={0.5}
          transparent
          opacity={0.3}
          emissive="#0c4a6e"
          emissiveIntensity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Internal "gut" / lobes */}
      <mesh scale={[0.4, 0.8, 0.4]} position={[0, 0.2, 0]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.5}
          transparent
          opacity={0.6}
          roughness={0.2}
        />
      </mesh>
      
      {/* 8 iridescent ciliated comb rows */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.82, 0, Math.sin(angle) * 0.82]}
            rotation={[0, -angle, 0]}
            scale={[0.06, 2.4, 0.02]}
          >
            {/* Flattened cylinder matching the curve somewhat by intersecting */}
            <cylinderGeometry args={[1, 1, 1, 4]} />
            <shaderMaterial
              vertexShader={COMB_ROW_VERT}
              fragmentShader={COMB_ROW_FRAG}
              uniforms={combUniforms}
              transparent
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
};
