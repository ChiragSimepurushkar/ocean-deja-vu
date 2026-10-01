import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { DiveConfig } from '../../utils/buildDiveConfig';

interface MarineSnow3DProps {
  currentDepth: number; // 0 to 1000m
  count?: number;
  config: DiveConfig;
}

export const MarineSnow3D: React.FC<MarineSnow3DProps> = ({ currentDepth, count = 1200, config }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const r = 16;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
  }, []);

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
        map={texture}
        size={currentDepth > 300 ? 0.35 : 0.22}
        color={currentDepth > 400 ? '#a5f3fc' : '#e0f2fe'}
        transparent
        opacity={(currentDepth > 300 ? 0.75 : 0.45) * (1 / config.visibility)}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        alphaTest={0.01}
      />
    </points>
  );
};
