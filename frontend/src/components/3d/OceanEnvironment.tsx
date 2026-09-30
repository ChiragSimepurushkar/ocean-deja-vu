import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface OceanEnvironmentProps {
  currentDepth: number; // 0 to 1000m
}

export const OceanEnvironment: React.FC<OceanEnvironmentProps> = ({ currentDepth }) => {
  const { scene } = useThree();
  const fogRef = useRef<THREE.FogExp2 | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const lightShaftsGroupRef = useRef<THREE.Group | null>(null);

  // Initialize Fog on mount
  useMemo(() => {
    const initialColor = new THREE.Color('#088395');
    const fog = new THREE.FogExp2(initialColor, 0.02);
    scene.fog = fog;
    scene.background = initialColor;
    fogRef.current = fog;
  }, [scene]);

  // Dynamic Lighting & Fog interpolation based on current depth
  useFrame((_, delta) => {
    const depthM = currentDepth;
    let targetHex = '088395';
    let targetDensity = 0.018;
    let targetAmbientInt = 1.2;
    let targetSunInt = 2.0;

    if (depthM <= 60) {
      const t = depthM / 60;
      targetHex = new THREE.Color('#0e8388').lerp(new THREE.Color('#03506f'), t).getHexString();
      targetDensity = THREE.MathUtils.lerp(0.016, 0.024, t);
      targetAmbientInt = THREE.MathUtils.lerp(1.4, 0.9, t);
      targetSunInt = THREE.MathUtils.lerp(2.2, 1.2, t);
    } else if (depthM <= 150) {
      const t = (depthM - 60) / 90;
      targetHex = new THREE.Color('#03506f').lerp(new THREE.Color('#0a2647'), t).getHexString();
      targetDensity = THREE.MathUtils.lerp(0.024, 0.032, t);
      targetAmbientInt = THREE.MathUtils.lerp(0.9, 0.5, t);
      targetSunInt = THREE.MathUtils.lerp(1.2, 0.2, t);
    } else if (depthM <= 300) {
      const t = (depthM - 150) / 150;
      targetHex = new THREE.Color('#0a2647').lerp(new THREE.Color('#04101e'), t).getHexString();
      targetDensity = THREE.MathUtils.lerp(0.032, 0.042, t);
      targetAmbientInt = THREE.MathUtils.lerp(0.5, 0.25, t);
      targetSunInt = THREE.MathUtils.lerp(0.2, 0.0, t);
    } else if (depthM <= 600) {
      const t = (depthM - 300) / 300;
      targetHex = new THREE.Color('#04101e').lerp(new THREE.Color('#020710'), t).getHexString();
      targetDensity = THREE.MathUtils.lerp(0.042, 0.052, t);
      targetAmbientInt = THREE.MathUtils.lerp(0.25, 0.12, t);
      targetSunInt = 0;
    } else {
      const t = Math.min(1, (depthM - 600) / 400);
      targetHex = new THREE.Color('#020710').lerp(new THREE.Color('#010206'), t).getHexString();
      targetDensity = THREE.MathUtils.lerp(0.052, 0.065, t);
      targetAmbientInt = THREE.MathUtils.lerp(0.12, 0.06, t);
      targetSunInt = 0;
    }

    const targetColor = new THREE.Color(`#${targetHex}`);

    if (fogRef.current) {
      fogRef.current.color.lerp(targetColor, delta * 3.0);
      fogRef.current.density = THREE.MathUtils.damp(fogRef.current.density, targetDensity, 3.0, delta);
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(fogRef.current.color);
      }
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = THREE.MathUtils.damp(ambientLightRef.current.intensity, targetAmbientInt, 3.0, delta);
      ambientLightRef.current.color.lerp(targetColor.clone().addScalar(0.2), delta * 2.0);
    }
    if (sunLightRef.current) {
      sunLightRef.current.intensity = THREE.MathUtils.damp(sunLightRef.current.intensity, targetSunInt, 3.0, delta);
    }
    if (lightShaftsGroupRef.current) {
      const shaftAlpha = Math.max(0, 1 - depthM / 95);
      lightShaftsGroupRef.current.visible = shaftAlpha > 0.01;
      lightShaftsGroupRef.current.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
          (child.material as THREE.MeshBasicMaterial).opacity = shaftAlpha * 0.28;
        }
      });
    }
  });

  const rockFormations = useMemo(() => {
    const items: {
      id: string;
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
      color: string;
      isCoral: boolean;
      isVent: boolean;
    }[] = [];

    const stepCount = 70; // Optimized count to fix lag
    for (let i = 0; i < stepCount; i++) {
      // Y goes from +40 down to -220 using a larger multiplier to maintain full depth coverage
      const y = 40 - i * 3.8; 
      const isShallow = y > -30;
      const isMid = y > -80 && y <= -30;
      const isAbyss = y < -130;

      // Calculate wide, scattered X positions
      const spreadX = 20 + (i % 8) * 14; 
      const leftX = -spreadX - (i % 5);
      const rightX = spreadX + (i % 6);

      items.push({
        id: `rock-left-${i}`,
        position: [leftX, y, -4 - (i % 8) * 5],
        rotation: [(i * 0.3) % 0.8, (i * 0.5) % 3.14, (i * 0.2) % 0.6],
        scale: [12 + (i % 4) * 4, 15 + (i % 3) * 5, 10 + (i % 2) * 3],
        color: isShallow ? '#1e3848' : isAbyss ? '#0b1320' : '#14213d',
        isCoral: isShallow && i % 4 === 0,
        isVent: isAbyss && i % 5 === 0,
      });

      items.push({
        id: `rock-right-${i}`,
        position: [rightX, y - 4, -6 - (i % 7) * 5],
        rotation: [-(i * 0.25) % 0.7, (i * 0.7) % 3.14, -(i * 0.3) % 0.5],
        scale: [14 + (i % 3) * 4, 16 + (i % 2) * 5, 11 + (i % 4) * 3],
        color: isShallow ? '#193240' : isAbyss ? '#09101c' : '#101c33',
        isCoral: isShallow && i % 4 === 1,
        isVent: isAbyss && i % 6 === 1,
      });

      // Scatter some mid-water floating / scattered pillars too
      if (i % 4 === 0) {
        const xOff = ((i / 4) % 2 === 0 ? 1 : -1) * (5 + (i % 7) * 8);
        items.push({
          id: `rock-mid-${i}`,
          position: [xOff, y - 2, -25 - (i % 5) * 4],
          rotation: [(i * 0.4) % 1.2, (i * 0.6) % 3.14, (i * 0.15) % 0.4],
          scale: [6 + (i % 3) * 2, 8 + (i % 4) * 3, 5 + (i % 2) * 2],
          color: isShallow ? '#2a4a5e' : isAbyss ? '#0d1628' : isMid ? '#1a2e42' : '#182a3e',
          isCoral: (isShallow || isMid) && i % 3 === 0,
          isVent: isAbyss && i % 4 === 0,
        });
      }
    }
    return items;
  }, []);

  return (
    <>
      <directionalLight ref={sunLightRef} position={[10, 25, 10]} color="#e0f2fe" intensity={2.2} />
      <ambientLight ref={ambientLightRef} intensity={1.2} color="#0d9488" />
      <pointLight position={[0, -60, 5]} color="#0284c7" intensity={0.6} distance={80} />

      {/* Surface God-Ray Light Shafts - fade out by 100m */}
      <group ref={lightShaftsGroupRef} position={[0, 4, -5]}>
        {[-10, -3, 3, 9, 16].map((xOffset, idx) => (
          <mesh key={idx} position={[xOffset, -12, -idx * 2.5]} rotation={[0.12, 0, -0.10 * (idx - 2)]}>
            <cylinderGeometry args={[0.5, 6.0, 38, 10, 1, true]} />
            <meshBasicMaterial
              color="#67e8f9"
              transparent
              opacity={0.22}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
        {[-6, 6].map((xOffset, idx) => (
          <mesh key={`wide-${idx}`} position={[xOffset, -8, -idx * 4]} rotation={[0.08, 0, -0.06 * (idx === 0 ? -1 : 1)]}>
            <cylinderGeometry args={[1.5, 10, 30, 8, 1, true]} />
            <meshBasicMaterial
              color="#a5f3fc"
              transparent
              opacity={0.10}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Dense Canyon Walls, Ledges & Mid-Scene Rocks */}
      <group>
        {rockFormations.map((rock) => (
          <group key={rock.id} position={rock.position} rotation={rock.rotation} scale={rock.scale}>
            <mesh receiveShadow castShadow>
              <dodecahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color={rock.color} roughness={0.88} metalness={0.12} flatShading={true} />
            </mesh>

            {rock.isCoral && (
              <group position={[0.7, 0.6, 0.4]} scale={[0.3, 0.3, 0.3]}>
                <mesh position={[0, 0.5, 0]}>
                  <coneGeometry args={[1.2, 2.5, 5]} />
                  <meshStandardMaterial color="#f43f5e" roughness={0.7} flatShading emissive="#f43f5e" emissiveIntensity={0.2} />
                </mesh>
                <mesh position={[1.2, 0.3, 0]} rotation={[0, 0, -0.4]}>
                  <cylinderGeometry args={[0.4, 0.6, 1.8, 5]} />
                  <meshStandardMaterial color="#2dd4bf" roughness={0.7} flatShading emissive="#2dd4bf" emissiveIntensity={0.15} />
                </mesh>
                <mesh position={[-1.0, 0.2, 0.5]} rotation={[0.3, 0, 0.4]}>
                  <sphereGeometry args={[0.9, 6, 6]} />
                  <meshStandardMaterial color="#f59e0b" roughness={0.7} flatShading emissive="#f59e0b" emissiveIntensity={0.15} />
                </mesh>
                <mesh position={[0.5, 0.8, -0.8]} rotation={[0.2, 0, 0.2]}>
                  <cylinderGeometry args={[0.3, 0.5, 2.2, 5]} />
                  <meshStandardMaterial color="#a855f7" roughness={0.7} flatShading emissive="#a855f7" emissiveIntensity={0.15} />
                </mesh>
              </group>
            )}

            {/* Hydrothermal vents - ONLY abyssal zone, teal not orange (fixes artifact) */}
            {rock.isVent && (
              <group position={[0.5, 0.8, 0.2]} scale={[0.35, 0.55, 0.35]}>
                <mesh position={[0, 1.0, 0]}>
                  <cylinderGeometry args={[0.5, 1.2, 3.0, 6]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.9} flatShading />
                </mesh>
                <mesh position={[0, 2.6, 0]}>
                  <sphereGeometry args={[0.5, 8, 8]} />
                  <meshStandardMaterial color="#2dd4bf" emissive="#0d9488" emissiveIntensity={2.5} />
                </mesh>
              </group>
            )}
          </group>
        ))}
      </group>

      {/* Sea Floor */}
      <mesh position={[0, -212, -20]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200, 24, 24]} />
        <meshStandardMaterial color="#02050c" roughness={0.97} metalness={0.03} flatShading />
      </mesh>

      {/* Seafloor boulders */}
      {[-14, -5, 4, 13, -22, 19, -8, 8].map((x, i) => (
        <mesh key={`floor-rock-${i}`} position={[x, -211 + (i % 3) * 0.6, -16 - i * 3.5]} rotation={[i * 0.3, i * 0.5, i * 0.2]}>
          <dodecahedronGeometry args={[1.2 + (i % 3) * 0.5, 0]} />
          <meshStandardMaterial color="#040810" roughness={0.95} flatShading />
        </mesh>
      ))}
    </>
  );
};