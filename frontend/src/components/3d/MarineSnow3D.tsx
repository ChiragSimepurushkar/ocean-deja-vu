import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MarineSnow3DProps {
  currentDepth: number; // 0 to 1000m
  count?: number;
}

export const MarineSnow3D: React.FC<MarineSnow3DProps> = ({ currentDepth, count = 1200 }) => {
  const pointsRef = useRef<THREE.Points>(null);

  // Generate initial particle positions across depth range
  const { positions, velocities, originalOffsets } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const orig = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      // Spread across X: -30 to 30, Z: -25 to 15, Y: +10 down to -215
      const x = (Math.random() - 0.5) * 60;
      const y = 10 - Math.random() * 225;
      const z = (Math.random() - 0.5) * 45;

      pos[idx] = x;
      pos[idx + 1] = y;
      pos[idx + 2] = z;

      orig[idx] = x;
      orig[idx + 1] = y;
      orig[idx + 2] = z;

      // Drift velocities: gentle downward sink and horizontal current
      vel[idx] = (Math.random() - 0.5) * 0.08;
      vel[idx + 1] = -0.04 - Math.random() * 0.08;
      vel[idx + 2] = (Math.random() - 0.5) * 0.06;
    }

    return { positions: pos, velocities: vel, originalOffsets: orig };
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;
    const time = state.clock.getElapsedTime();

    // Map camera depth to approximate camera Y in 3D world space
    const cameraY = -(currentDepth / 1000) * 200;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      // Update positions with drift and subtle sine wave current oscillation
      array[idx] += velocities[idx] + Math.sin(time * 0.8 + originalOffsets[idx + 1] * 0.1) * 0.015;
      array[idx + 1] += velocities[idx + 1];
      array[idx + 2] += velocities[idx + 2] + Math.cos(time * 0.6 + originalOffsets[idx] * 0.1) * 0.01;

      // Keep particles recycling around the camera view envelope
      const distFromCamY = array[idx + 1] - cameraY;
      if (distFromCamY < -28) {
        array[idx + 1] = cameraY + 28;
      } else if (distFromCamY > 28) {
        array[idx + 1] = cameraY - 28;
      }

      // X/Z wrapping
      if (Math.abs(array[idx]) > 32) {
        array[idx] = -Math.sign(array[idx]) * 30;
      }
      if (Math.abs(array[idx + 2]) > 25) {
        array[idx + 2] = -Math.sign(array[idx + 2]) * 22;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={currentDepth > 300 ? 0.35 : 0.22}
        color={currentDepth > 400 ? '#a5f3fc' : '#e0f2fe'}
        transparent
        opacity={currentDepth > 300 ? 0.75 : 0.45}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};
