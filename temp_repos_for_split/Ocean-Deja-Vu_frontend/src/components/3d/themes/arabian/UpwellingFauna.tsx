/**
 * UpwellingFauna.tsx — Arabian Sea Upwelling Theme
 *
 * Huge school of sardines feeding on the upwelled nutrients.
 * Features:
 * - InstancedMesh with vertex shader for rapid tail beating.
 * - Thousands of small fish schooling tightly in the cold nutrient-rich water.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SARDINE_VERT = `
  uniform float uTime;
  attribute float aPhase;
  attribute float aSpeed;
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;
    
    // Fast tail beating (swimming motion)
    float tail = clamp(-pos.z, 0.0, 2.0);
    pos.x += sin(uTime * aSpeed * 15.0 + aPhase) * 0.2 * tail;
    
    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(pos, 1.0));
  }
`;

const SARDINE_FRAG = `
  varying vec3 vNormal;
  void main() {
    // Silver sides, dark back
    float top = max(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.0);
    float side = max(dot(vNormal, vec3(1.0, 0.0, 0.0)), 0.0) + max(dot(vNormal, vec3(-1.0, 0.0, 0.0)), 0.0);
    
    vec3 topCol = vec3(0.1, 0.3, 0.4); // Dark blue-green top
    vec3 sideCol = vec3(0.85, 0.9, 0.95); // Bright silver
    vec3 botCol = vec3(0.95, 0.95, 1.0); // White belly
    
    vec3 col = mix(botCol, sideCol, side);
    col = mix(col, topCol, top);
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const UpwellingFauna: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 300; // Larger school of smaller fish
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  const boidData = useMemo(() => {
    const data = [];
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      data.push({
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 12,
        z: (Math.random() - 0.5) * 20,
        speed: 1.0 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      });
      phases[i] = data[i].phase;
      speeds[i] = data[i].speed;
    }
    return { data, phases, speeds };
  }, [count]);

  const schoolGeo = useMemo(() => {
    const geo = new THREE.ConeGeometry(0.1, 0.6, 5);
    geo.rotateX(Math.PI / 2); // Point along -Z
    geo.setAttribute('aPhase', new THREE.BufferAttribute(boidData.phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(boidData.speeds, 1));
    return geo;
  }, [boidData]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    uniforms.uTime.value = time;
    
    if (meshRef.current) {
      // Swirling tornado-like baitball pattern
      boidData.data.forEach((f, i) => {
        const t = time * f.speed + f.phase;
        
        const radius = 5 + Math.sin(f.y * 0.5) * 2;
        const angle = time * 0.5 * f.speed + f.phase;
        
        dummy.position.set(
          Math.cos(angle) * radius + Math.sin(t * 1.5) * 0.5,
          -15 + f.y + Math.cos(t * 0.8) * 0.5,
          Math.sin(angle) * radius + Math.cos(t * 1.5) * 0.5
        );
        
        // Face tangent to the circle
        dummy.rotation.set(
          Math.sin(t * 2.0) * 0.1,
          -(angle + Math.PI / 2),
          Math.cos(t * 2.0) * 0.2
        );
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} geometry={schoolGeo}>
      <shaderMaterial
        vertexShader={SARDINE_VERT}
        fragmentShader={SARDINE_FRAG}
        uniforms={uniforms}
      />
    </instancedMesh>
  );
};
