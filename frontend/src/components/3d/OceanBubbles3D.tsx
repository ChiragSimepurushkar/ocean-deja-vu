/**
 * OceanBubbles3D — rising bubble particle system for the upper 0–100 m
 *
 * Behaviour vs MarineSnow3D:
 *   • Bubbles rise upward (accelerating buoyancy), snow sinks
 *   • Side-to-side wobble inversely proportional to bubble size (small = more wobble)
 *   • Bubbles shrink + fade as they approach the surface (pop)
 *   • Only rendered below 100 m by convention — Ocean3DScene gates this
 */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface OceanBubbles3DProps {
  currentDepth: number;
  count?: number;
}

// Camera's world-Y at a given depth (linear 0-1000m → 0 to -200 world units)
const depthToY = (d: number) => -(d / 1000) * 200;

export const OceanBubbles3D: React.FC<OceanBubbles3DProps> = ({
  currentDepth,
  count = 600,
}) => {
  const pointsRef = useRef<THREE.Points>(null);

  // Static per-particle data: size, wobble freq, phase, home column position
  const { positions, sizes, phases, wobbleAmps, velocities, originalY } = useMemo(() => {
    const pos  = new Float32Array(count * 3);
    const sz   = new Float32Array(count);
    const ph   = new Float32Array(count);
    const wobA = new Float32Array(count);
    const vel  = new Float32Array(count); // rise speed
    const origY = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 36;
      // Bubbles live in 0-100m world band (Y: 0 to -20)
      const y = -Math.random() * 20;
      const z = (Math.random() - 0.5) * 30;

      pos[i * 3]     = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      origY[i]        = y;

      // Size distribution: mostly small, occasional large
      sz[i] = Math.random() < 0.85
        ? 0.08 + Math.random() * 0.18        // small
        : 0.28 + Math.random() * 0.22;       // occasional large

      // Small bubbles wobble more
      wobA[i] = THREE.MathUtils.lerp(0.18, 0.04, sz[i] / 0.5);

      // Rise speed: larger bubbles rise faster
      vel[i] = 0.04 + sz[i] * 0.12;

      ph[i]  = Math.random() * Math.PI * 2;
    }

    return { positions: pos, sizes: sz, phases: ph, wobbleAmps: wobA, velocities: vel, originalY: origY };
  }, [count]);

  // We drive this as a custom points material to get rim highlight
  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.28,
      sizeAttenuation: true,
      color: new THREE.Color('#bae6fd'),
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: false,
    });
  }, []);

  useFrame((state, _delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const time = state.clock.getElapsedTime();

    const camY = depthToY(currentDepth);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      // Rise with acceleration (buoyancy curve)
      arr[idx + 1] += velocities[i] * (1 + (camY - arr[idx + 1]) * 0.002);

      // Side-to-side wobble — frequency tied to size (small = faster wobble)
      const wobFreq = THREE.MathUtils.lerp(2.8, 1.2, sizes[i] / 0.5);
      arr[idx]     += Math.sin(time * wobFreq + phases[i]) * wobbleAmps[i] * 0.06;
      arr[idx + 2] += Math.cos(time * wobFreq * 0.7 + phases[i] + 1) * wobbleAmps[i] * 0.04;

      // Pop: when bubble reaches near surface (Y > camY + 16), recycle it below
      if (arr[idx + 1] > camY + 18) {
        // Respawn at bottom of the bubble column
        arr[idx]     = (Math.random() - 0.5) * 36;
        arr[idx + 1] = camY - 20 + Math.random() * 4; // just below bottom
        arr[idx + 2] = (Math.random() - 0.5) * 30;
      }

      // X/Z wrapping
      if (Math.abs(arr[idx]) > 20)     arr[idx]     = -Math.sign(arr[idx]) * 18;
      if (Math.abs(arr[idx + 2]) > 17) arr[idx + 2] = -Math.sign(arr[idx + 2]) * 15;
    }

    posAttr.needsUpdate = true;

    // Opacity fades with depth — bubbles invisible below 120m, bright near surface
    material.opacity = THREE.MathUtils.clamp(
      THREE.MathUtils.mapLinear(currentDepth, 0, 100, 0.7, 0.0),
      0, 0.7
    );
  });

  // Only render within the bubble zone (0-120m)
  if (currentDepth > 120) return null;

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
    </points>
  );
};
