/**
 * BaitBall.tsx — Monsoon Bloom Theme
 *
 * Dense spherical aggregation of small pelagic fish feeding on the bloom.
 * Features:
 * - InstancedMesh with a custom vertex shader for tail beating.
 * - Complex swirling sphere math for the schooling behavior.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const FISH_VERT = `
  uniform float uTime;
  attribute float aPhase;
  attribute float aSpeed;
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;
    
    // Fast tail beating
    float tail = clamp(-pos.z, 0.0, 2.0);
    pos.x += sin(uTime * aSpeed * 12.0 + aPhase) * 0.25 * tail;
    
    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(pos, 1.0));
  }
`;

const FISH_FRAG = `
  varying vec3 vNormal;
  void main() {
    // Silver sides, green back
    float top = max(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.0);
    float side = max(dot(vNormal, vec3(1.0, 0.0, 0.0)), 0.0) + max(dot(vNormal, vec3(-1.0, 0.0, 0.0)), 0.0);
    
    vec3 topCol = vec3(0.2, 0.5, 0.4); // Greenish back (algae rich water)
    vec3 sideCol = vec3(0.8, 0.9, 0.85); // Silver/greenish sides
    vec3 botCol = vec3(0.9, 0.95, 0.9); // Pale belly
    
    vec3 col = mix(botCol, sideCol, side);
    col = mix(col, topCol, top);
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const PlanktonBaitBall: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 350; // Dense ball
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  const fishOffsets = useMemo(() => {
    const data = [];
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 6.5; // Radius of bait ball
      data.push({
        radius: r,
        theta,
        phi,
        speed: 1.5 + Math.random() * 1.0,
        phase: Math.random() * Math.PI * 2,
      });
      phases[i] = data[i].phase;
      speeds[i] = data[i].speed;
    }
    return { data, phases, speeds };
  }, [count]);

  const schoolGeo = useMemo(() => {
    const geo = new THREE.ConeGeometry(0.12, 0.7, 5);
    geo.rotateX(Math.PI / 2); // Point along -Z
    geo.setAttribute('aPhase', new THREE.BufferAttribute(fishOffsets.phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(fishOffsets.speeds, 1));
    return geo;
  }, [fishOffsets]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    uniforms.uTime.value = time;
    
    const centerX = 0;
    const centerY = -18;
    const centerZ = -8;

    fishOffsets.data.forEach((f, i) => {
      // Rotate around the Y axis over time
      const angle = f.theta + time * f.speed * 0.5;
      
      const x = centerX + f.radius * Math.sin(f.phi) * Math.cos(angle);
      // Add slight vertical bobbing
      const y = centerY + f.radius * Math.cos(f.phi) + Math.sin(time * 1.5 + i) * 0.5;
      const z = centerZ + f.radius * Math.sin(f.phi) * Math.sin(angle);

      dummy.position.set(x, y, z);
      
      // Face tangent to rotation
      dummy.rotation.set(
        Math.sin(time * 2.0 + i) * 0.1, // Pitch wobble
        -angle + Math.PI / 2,           // Tangent yaw
        Math.sin(time * 3.0 + i) * 0.2  // Roll wobble
      );
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} geometry={schoolGeo}>
      <shaderMaterial
        vertexShader={FISH_VERT}
        fragmentShader={FISH_FRAG}
        uniforms={uniforms}
      />
    </instancedMesh>
  );
};
