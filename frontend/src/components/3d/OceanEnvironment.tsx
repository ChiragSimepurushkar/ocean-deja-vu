import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { DiveConfig } from '../../utils/buildDiveConfig';
import { Instances, Instance } from '@react-three/drei';

interface OceanEnvironmentProps {
  currentDepth: number; // 0 to 1000m
  config: DiveConfig;
}

export const OceanEnvironment: React.FC<OceanEnvironmentProps> = ({ currentDepth, config }) => {
  const { scene } = useThree();
  const fogRef = useRef<THREE.FogExp2 | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const lightShaftsGroupRef = useRef<THREE.Group | null>(null);

  const noise2D = useMemo(() => createNoise2D(config.rand), [config.seed]);

  // Generate canyon walls
  const leftWallGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(300, 300, 64, 64);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = noise2D(x * 0.04, y * 0.04) * 8 + noise2D(x * 0.1, y * 0.1) * 2;
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, [noise2D]);

  const rightWallGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(300, 300, 64, 64);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = noise2D(x * 0.04 + 100, y * 0.04 + 100) * 8 + noise2D(x * 0.1 + 100, y * 0.1 + 100) * 2;
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, [noise2D]);

  // Generate instances (corals, vents)
  const instances = useMemo(() => {
    const items = [];
    const stepCount = 50;
    for (let i = 0; i < stepCount; i++) {
      const isLeft = config.rand() > 0.5;
      const x = isLeft ? -13 + config.rand() * 4 : 13 - config.rand() * 4;
      const z = -5 - config.rand() * 80;
      const y = -config.rand() * 200; // distribute along the walls vertically

      const isShallow = y > -30;
      const isAbyss = y < -130;
      
      const isCoral = isShallow && config.rand() > 0.5;
      const isVent = isAbyss && config.biome === 'abyssal' && config.rand() > 0.8;

      if (isCoral || isVent) {
        items.push({
          id: i,
          position: [x, y, z] as [number, number, number],
          rotation: [config.rand(), config.rand() * Math.PI, config.rand()] as [number, number, number],
          scale: 0.5 + config.rand() * 1.5,
          isCoral,
          isVent
        });
      }
    }
    return items;
  }, [config]);

  const floorY = -(config.seafloorDepth / 1000) * 200;

  useMemo(() => {
    const fog = new THREE.FogExp2(config.surfaceColor, 0.02);
    scene.fog = fog;
    scene.background = new THREE.Color(config.surfaceColor);
    fogRef.current = fog;
  }, [scene, config.surfaceColor]);

  useFrame((_, delta) => {
    const depthRatio = Math.min(1, currentDepth / 600);
    const targetColor = new THREE.Color(config.surfaceColor).lerp(new THREE.Color(config.deepColor), depthRatio);
    
    // Visibility multiplier
    let targetDensity = THREE.MathUtils.lerp(0.015, 0.05, depthRatio) * (1 / config.visibility);
    
    // OMZ darkening
    let targetAmbientInt = THREE.MathUtils.lerp(1.4, 0.1, depthRatio);
    if (config.omzTop && currentDepth >= config.omzTop && currentDepth <= config.omzTop + 800) {
      targetAmbientInt *= 0.3; // significantly darker in OMZ
    }
    
    // Sun logic
    let targetSunInt = config.isNight ? 0.2 : THREE.MathUtils.lerp(2.2, 0.0, Math.min(1, currentDepth / 250));
    if (config.monsoon && !config.isNight) targetSunInt *= 0.6; // dimmer during monsoon

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
      const shaftAlpha = config.isNight ? 0 : Math.max(0, 1 - currentDepth / (config.monsoon ? 60 : 95));
      lightShaftsGroupRef.current.visible = shaftAlpha > 0.01;
      lightShaftsGroupRef.current.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
          (child.material as THREE.MeshBasicMaterial).opacity = shaftAlpha * 0.28;
        }
      });
    }
  });

  return (
    <>
      <directionalLight ref={sunLightRef} position={[10, 25, 10]} color="#e0f2fe" intensity={2.2} />
      <ambientLight ref={ambientLightRef} intensity={1.2} color="#0d9488" />
      <pointLight position={[0, floorY + 10, 5]} color="#0284c7" intensity={0.6} distance={80} />

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
      </group>

      {/* Left Wall */}
      <mesh position={[-16, floorY / 2, -20]} rotation={[0, Math.PI / 2, 0]} geometry={leftWallGeo}>
        <meshStandardMaterial color={config.deepColor} roughness={0.9} flatShading />
      </mesh>
      
      {/* Right Wall */}
      <mesh position={[16, floorY / 2, -20]} rotation={[0, -Math.PI / 2, 0]} geometry={rightWallGeo}>
        <meshStandardMaterial color={config.deepColor} roughness={0.9} flatShading />
      </mesh>

      {/* Sea Floor */}
      <mesh position={[0, floorY, -20]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200, 24, 24]} />
        <meshStandardMaterial color={config.deepColor} roughness={0.97} metalness={0.03} flatShading />
      </mesh>

      <Instances limit={100}>
        <cylinderGeometry args={[0.35, 0.55, 2.2, 7]} />
        <meshStandardMaterial color="#1a3a4a" roughness={0.85} flatShading emissive="#0e4a5e" emissiveIntensity={0.08} />
        {instances.filter(i => i.isCoral).map((c, i) => (
          <Instance key={`coral-${i}`} position={c.position} rotation={c.rotation} scale={c.scale} />
        ))}
      </Instances>

      <Instances limit={50}>
        <cylinderGeometry args={[0.5, 1.2, 3.0, 6]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} flatShading />
        {instances.filter(i => i.isVent).map((v, i) => (
          <group key={`vent-${i}`} position={v.position} rotation={v.rotation} scale={v.scale}>
            <Instance />
            <mesh position={[0, 1.6, 0]}>
              <sphereGeometry args={[0.5, 8, 8]} />
              <meshBasicMaterial color="#2dd4bf" />
            </mesh>
            <pointLight position={[0, 1.6, 0]} color="#0d9488" intensity={1.4} distance={7} />
          </group>
        ))}
      </Instances>
    </>
  );
};