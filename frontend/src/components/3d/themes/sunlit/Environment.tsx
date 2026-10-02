import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SUNLIT_CONFIG } from './Config';
import { WATER_SURFACE_VERTEX, WATER_SURFACE_FRAGMENT } from './Shaders';

export const SunlitEnvironment: React.FC<{ currentDepth: number }> = ({ currentDepth }) => {
  const surfaceRef = useRef<THREE.Mesh>(null);
  const uniforms = useRef({
    uTime: { value: 0 },
    uSunColor: { value: new THREE.Color(SUNLIT_CONFIG.lighting.sunColor) },
  });

  useFrame((state) => {
    uniforms.current.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <group>
      {/* Directional sun rays shining down */}
      <directionalLight
        position={[15, 30, 10]}
        intensity={SUNLIT_CONFIG.lighting.sunIntensity}
        color={SUNLIT_CONFIG.lighting.sunColor}
      />
      <ambientLight
        intensity={SUNLIT_CONFIG.lighting.ambientIntensity}
        color={SUNLIT_CONFIG.lighting.ambientColor}
      />

      {/* Underside of water surface with Snell's window (positioned at Y = 2) */}
      <mesh ref={surfaceRef} position={[0, 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[140, 140, 32, 32]} />
        <shaderMaterial
          vertexShader={WATER_SURFACE_VERTEX}
          fragmentShader={WATER_SURFACE_FRAGMENT}
          uniforms={uniforms.current}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* God ray cones */}
      {[-8, 0, 8].map((x, i) => (
        <mesh key={i} position={[x, -15, -4]} rotation={[0.1, 0, 0.15 * (i - 1)]}>
          <coneGeometry args={[4.5, 35, 16, 1, true]} />
          <meshBasicMaterial
            color="#bae6fd"
            transparent
            opacity={0.06}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};
