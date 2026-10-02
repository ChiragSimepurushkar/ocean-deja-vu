/**
 * WhaleSilhouette.tsx — Open Ocean Theme
 *
 * Majestic Blue Whale silhouette cruising in the distance.
 * Features:
 * - Massive body silhouette.
 * - Vertex shader for realistic sine-wave swimming motion down the spine.
 * - Slow, deep cruise in the far distance, visible mostly as a dark silhouette.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const WHALE_VERT = `
  uniform float uTime;
  void main() {
    vec3 pos = position;
    // Swimming motion: sine wave down the Z axis (spine)
    // The head (positive Z) moves less than the tail (negative Z)
    float spine = clamp(-pos.z, 0.0, 6.0); // Assuming length ~6
    pos.x += sin(uTime * 1.5 - spine * 1.2) * 0.15 * spine;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WHALE_FRAG = `
  void main() {
    // Dark silhouette blue
    gl_FragColor = vec4(0.02, 0.1, 0.18, 0.75);
  }
`;

export const WhaleSilhouette: React.FC = () => {
  const whaleRef = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (!whaleRef.current) return;
    const time = state.clock.getElapsedTime();
    uniforms.uTime.value = time;
    
    // Slow majestic cruise deep in the fog distance
    whaleRef.current.position.set(
      -45 + Math.sin(time * 0.08) * 35,
      -35 + Math.sin(time * 0.12) * 4,
      -55 + Math.cos(time * 0.06) * 20
    );
    // Face the direction of travel
    whaleRef.current.rotation.y = time * 0.08 + Math.PI / 2;
  });

  return (
    <group ref={whaleRef} scale={7.0}>
      {/* Massive whale body silhouette */}
      <mesh scale={[1.4, 1.2, 5.5]}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial
          vertexShader={WHALE_VERT}
          fragmentShader={WHALE_FRAG}
          uniforms={uniforms}
          transparent
        />
      </mesh>
      
      {/* Pectoral fins */}
      <mesh position={[-1.2, -0.4, 1.5]} rotation={[0, -0.4, -0.3]}>
        <coneGeometry args={[0.3, 2.5, 4]} />
        <meshBasicMaterial color="#082f49" transparent opacity={0.75} />
      </mesh>
      <mesh position={[1.2, -0.4, 1.5]} rotation={[0, 0.4, 0.3]}>
        <coneGeometry args={[0.3, 2.5, 4]} />
        <meshBasicMaterial color="#082f49" transparent opacity={0.75} />
      </mesh>

      {/* Flukes / Tail */}
      <mesh position={[0, 0.0, -5.2]} rotation={[0, 0, 0]}>
        {/* Flattened wide tail */}
        <cylinderGeometry args={[0.1, 0.1, 3.5, 4]} />
        <meshBasicMaterial color="#082f49" transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 0, -5.3]} scale={[3.2, 0.1, 0.8]}>
         <boxGeometry />
         <meshBasicMaterial color="#082f49" transparent opacity={0.75} />
      </mesh>
    </group>
  );
};
