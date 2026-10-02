/**
 * VortexField.tsx — Eddy Theme
 *
 * Visualizes the massive spinning vortex funnel of a mesoscale eddy.
 * Features:
 * - A translucent cylinder/funnel with a swirling vertex and fragment shader.
 * - Conveys rotational flow and sinking/upwelling depending on eddy type.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VORTEX_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    // Tapering the funnel based on depth
    float taper = mix(1.0, 0.4, (pos.y + 30.0) / 60.0);
    pos.x *= taper;
    pos.z *= taper;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const VORTEX_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  
  void main() {
    // Swirling flow lines
    // y represents vertical, x represents circumference
    float swirl = fract(vUv.x * 12.0 - vUv.y * 3.0 - uTime * 1.5);
    float streak = smoothstep(0.4, 0.6, swirl) * smoothstep(0.8, 0.6, swirl);
    
    vec3 col = vec3(0.0, 0.3, 0.6); // Deep blue ocean water
    
    // Fade out top and bottom
    float edge = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
    
    gl_FragColor = vec4(col, streak * 0.15 * edge);
  }
`;

export const EddyVortexField: React.FC = () => {
  const funnelRef = useRef<THREE.Mesh>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (!funnelRef.current) return;
    const time = state.clock.getElapsedTime();
    uniforms.uTime.value = time;
    funnelRef.current.rotation.y = time * 0.5;
  });

  return (
    <group position={[0, -40, 0]}>
      {/* Translucent vortex funnel indicator */}
      <mesh ref={funnelRef}>
        <cylinderGeometry args={[22, 22, 60, 32, 1, true]} />
        <shaderMaterial
          vertexShader={VORTEX_VERT}
          fragmentShader={VORTEX_FRAG}
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
