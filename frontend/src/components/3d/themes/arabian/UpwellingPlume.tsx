/**
 * UpwellingPlume.tsx — Arabian Sea Upwelling Theme
 *
 * Visualizes the massive vertical nutrient conveyor belt.
 * Features:
 * - A massive vertical cylinder shader simulating rushing cold water.
 * - Heavy marine snow (nutrient detritus) rising from the depths.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PLUME_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    // Slight wavy distortion of the plume column
    pos.x += sin(pos.y * 0.1 + uTime) * 1.5;
    pos.z += cos(pos.y * 0.08 + uTime * 0.8) * 1.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const PLUME_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  
  // 2D Noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  void main() {
    // Vertical flow
    float flow = fract(vUv.y * 10.0 - uTime * 2.0);
    float noise = hash(vec2(vUv.x * 20.0, floor(vUv.y * 10.0 - uTime * 2.0)));
    
    // Streaks
    float streak = smoothstep(0.4, 0.6, flow) * smoothstep(0.8, 0.6, flow);
    streak *= smoothstep(0.8, 1.0, noise);
    
    // Fade out at top and bottom of cylinder
    float edgeFade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
    
    vec3 col = vec3(0.4, 0.8, 0.9); // Cold blue-green
    float alpha = streak * 0.4 * edgeFade;
    
    gl_FragColor = vec4(col, alpha);
  }
`;

const DETRITUS_VERT = `
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  
  uniform float uTime;
  varying float vAlpha;
  
  void main() {
    vec3 pos = position;
    float t = uTime * aSpeed + aPhase;
    
    // Rising rapidly
    pos.y += mod(t * 15.0, 60.0);
    // Spiraling upward
    pos.x += sin(t * 2.0) * 2.0;
    pos.z += cos(t * 2.0) * 2.0;
    
    // Fade at top
    float h = mod(t * 15.0, 60.0);
    vAlpha = smoothstep(60.0, 50.0, h) * smoothstep(0.0, 10.0, h);
    
    gl_PointSize = aSize * 3.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const DETRITUS_FRAG = `
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    vec3 col = vec3(0.6, 0.8, 0.7); // Greenish detritus
    gl_FragColor = vec4(col, (1.0 - r) * vAlpha * 0.8);
  }
`;

export const UpwellingPlume: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const plumeUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const detritusUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const detritusCount = 1000;
  const { detGeo } = useMemo(() => {
    const pos = new Float32Array(detritusCount * 3);
    const phases = new Float32Array(detritusCount);
    const speeds = new Float32Array(detritusCount);
    const sizes = new Float32Array(detritusCount);
    
    for (let i = 0; i < detritusCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 12;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = -30; // Start at bottom of column
      pos[i * 3 + 2] = Math.sin(angle) * radius;
      
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.5 + Math.random() * 0.8;
      sizes[i] = 0.5 + Math.random() * 2.0;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return { detGeo: geo };
  }, [detritusCount]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    plumeUniforms.uTime.value = time;
    detritusUniforms.uTime.value = time;
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.05;
    }
  });

  return (
    <group position={[0, -28, 0]}>
      {/* Upwelling cold water thermal plume pillar */}
      <mesh ref={meshRef}>
        <cylinderGeometry args={[14, 10, 60, 24, 1, true]} />
        <shaderMaterial
          vertexShader={PLUME_VERT}
          fragmentShader={PLUME_FRAG}
          uniforms={plumeUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Massive nutrient detritus rising */}
      <points geometry={detGeo}>
        <shaderMaterial
          vertexShader={DETRITUS_VERT}
          fragmentShader={DETRITUS_FRAG}
          uniforms={detritusUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};
