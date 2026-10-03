/**
 * OceanBubbles3D — rising bubble particle system for the upper 0–100 m
 * Uses a canvas-drawn circular sprite so particles look round, not square.
 */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface OceanBubbles3DProps {
  currentDepth: number;
  count?: number;
}

/** Build a circular sprite texture on a canvas so PointsMaterial renders circles */
function makeCircleTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = size / 2;

  // Outer bright rim (hollow bubble look)
  const grad = ctx.createRadialGradient(r, r, r * 0.55, r, r, r * 0.98);
  grad.addColorStop(0, 'rgba(186,230,253,0.0)');   // transparent centre
  grad.addColorStop(0.6, 'rgba(186,230,253,0.0)');
  grad.addColorStop(0.80, 'rgba(224,242,254,0.45)'); // faint body
  grad.addColorStop(0.90, 'rgba(255,255,255,0.85)'); // bright rim
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');  // anti-alias edge

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.99, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight (top-left glint)
  const spec = ctx.createRadialGradient(r * 0.62, r * 0.38, 0, r * 0.62, r * 0.38, r * 0.22);
  spec.addColorStop(0, 'rgba(255,255,255,0.72)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(r * 0.62, r * 0.38, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

export const OceanBubbles3D: React.FC<OceanBubbles3DProps> = ({
  currentDepth,
  count = 500,
}) => {
  const pointsRef = useRef<THREE.Points>(null);

  const texture = useMemo(() => makeCircleTexture(64), []);

  const { positions, sizes, phases, wobbleAmps, velocities } = useMemo(() => {
    const pos  = new Float32Array(count * 3);
    const sz   = new Float32Array(count);
    const ph   = new Float32Array(count);
    const wobA = new Float32Array(count);
    const vel  = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 34;
      pos[i * 3 + 1] = -Math.random() * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 28;

      // Size: mostly small, occasional large
      sz[i] = Math.random() < 0.85
        ? 0.09 + Math.random() * 0.18
        : 0.28 + Math.random() * 0.24;

      // Small = more wobble
      wobA[i] = Math.max(0.03, 0.20 - sz[i] * 0.3);
      vel[i]  = 0.038 + sz[i] * 0.11;
      ph[i]   = Math.random() * Math.PI * 2;
    }
    return { positions: pos, sizes: sz, phases: ph, wobbleAmps: wobA, velocities: vel };
  }, [count]);

  const material = useMemo(() => new THREE.PointsMaterial({
    map: texture,
    alphaTest: 0.01,
    transparent: true,
    opacity: 0.7,
    size: 0.55,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: false,
    color: new THREE.Color('#bae6fd'),
  }), [texture]);

  useFrame((state, _delta) => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const time = state.clock.getElapsedTime();

    // Camera Y = depthToY(currentDepth)
    const camY = -(currentDepth / 1000) * 200;
    const ceiling = camY + 18;
    const floor   = camY - 22;

    for (let i = 0; i < count; i++) {
      const ix = i * 3, iy = ix + 1, iz = ix + 2;

      // Accelerating rise (buoyancy)
      arr[iy] += velocities[i];

      // Side wobble — smaller = faster wobble, inversely proportional to size
      const wobFreq = 2.5 - sizes[i] * 2.0;
      arr[ix] += Math.sin(time * wobFreq + phases[i]) * wobbleAmps[i] * 0.055;
      arr[iz] += Math.cos(time * wobFreq * 0.72 + phases[i] + 1.3) * wobbleAmps[i] * 0.038;

      // Pop at surface — respawn just below camera
      if (arr[iy] > ceiling) {
        arr[ix] = (Math.random() - 0.5) * 34;
        arr[iy] = floor + Math.random() * 3;
        arr[iz] = (Math.random() - 0.5) * 28;
      }

      // X/Z wrapping
      if (arr[ix] >  19) arr[ix] = -17;
      if (arr[ix] < -19) arr[ix] =  17;
      if (arr[iz] >  16) arr[iz] = -14;
      if (arr[iz] < -16) arr[iz] =  14;
    }
    pos.needsUpdate = true;

    // Fade out as depth increases past 80m
    material.opacity = Math.max(0, Math.min(0.72, 1 - currentDepth / 90));
  });

  if (currentDepth > 110) return null;

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
    </points>
  );
};
