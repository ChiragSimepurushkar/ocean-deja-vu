/**
 * HypoxicMedusa.tsx — OMZ Theme
 *
 * Detailed Hypoxic Medusa (Deep-sea jellyfish adapted to low oxygen).
 * Features:
 * - Dark scarlet red crown bell (opaque to hide bioluminescent prey in stomach).
 * - Pulsating bell vertex shader.
 * - Hypertrophied trailing tentacles for capturing marine snow/detritus.
 * - Very slow movement.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { depthToY } from '../../core/depthScale';

const BELL_VERT = `
  uniform float uTime;
  varying vec3 vNormal;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;
    
    // Slow, rhythmic pulsing of the bell
    // Expansion is stronger at the rim (where y is lower)
    float pulse = sin(uTime * 1.2);
    float rimWeight = smoothstep(0.5, 0.0, pos.y + 0.5); // 0 at top, 1 at bottom edge
    
    pos.x += normal.x * pulse * rimWeight * 0.2;
    pos.z += normal.z * pulse * rimWeight * 0.2;
    // Slight vertical contraction during pulse
    pos.y += pulse * 0.05 * (1.0 - rimWeight);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const BELL_FRAG = `
  varying vec3 vNormal;

  void main() {
    // Dark scarlet red (hides glowing prey)
    vec3 col = vec3(0.3, 0.02, 0.1);
    
    // Specular highlight for a gelatinous look
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(viewDir + vec3(0.0, 1.0, 1.0)); // Fake light from above
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 32.0);
    
    col += vec3(0.5, 0.2, 0.3) * spec * 0.5;
    
    gl_FragColor = vec4(col, 0.95);
  }
`;

const TENTACLE_VERT = `
  uniform float uTime;
  attribute float aPhase;
  
  void main() {
    vec3 pos = position;
    
    // Tentacles wave slowly
    float len = clamp(-pos.y, 0.0, 5.0); // How far down the tentacle
    pos.x += sin(uTime * 0.5 + aPhase + len * 0.5) * 0.2 * len;
    pos.z += cos(uTime * 0.4 + aPhase + len * 0.4) * 0.2 * len;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const TENTACLE_FRAG = `
  void main() {
    // Deep crimson color
    gl_FragColor = vec4(0.7, 0.05, 0.15, 0.6);
  }
`;

export const HypoxicMedusa: React.FC = () => {
  const medusaRef = useRef<THREE.Group>(null);

  const bellUniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  const tentacleUniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  // Geometry for a single long trailing tentacle
  const tentacleGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.04, 0.01, 8.0, 5, 20);
    // Offset so origin is at the top
    geo.translate(0, -4.0, 0);
    
    // Add phases for wavy animation
    const posAttr = geo.attributes.position;
    const phases = new Float32Array(posAttr.count);
    for (let i = 0; i < posAttr.count; i++) {
      phases[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    return geo;
  }, []);

  useFrame((state) => {
    if (!medusaRef.current) return;
    const time = state.clock.getElapsedTime();
    bellUniforms.uTime.value = time;
    tentacleUniforms.uTime.value = time;

    medusaRef.current.position.set(
      Math.cos(time * 0.15) * 12,
      depthToY(800) + Math.sin(time * 0.3) * 3,
      Math.sin(time * 0.2) * 10
    );
    
    // Gentle rocking
    medusaRef.current.rotation.x = Math.sin(time * 0.5) * 0.1;
    medusaRef.current.rotation.z = Math.cos(time * 0.4) * 0.1;
    medusaRef.current.rotation.y = time * 0.05;
  });

  return (
    <group ref={medusaRef} scale={1.8}>
      {/* Dark scarlet red crown bell */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <shaderMaterial 
          vertexShader={BELL_VERT}
          fragmentShader={BELL_FRAG}
          uniforms={bellUniforms}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Oral arms (fluffy bits underneath) */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.3, 0.6, 0.8, 8, 4, true]} />
        <meshStandardMaterial color="#880a22" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Hypertrophied trailing tentacles */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 0.8;
        return (
          <mesh 
            key={i} 
            geometry={tentacleGeo} 
            position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}
          >
            <shaderMaterial
              vertexShader={TENTACLE_VERT}
              fragmentShader={TENTACLE_FRAG}
              uniforms={tentacleUniforms}
              transparent
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};
