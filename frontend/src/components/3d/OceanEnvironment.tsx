/**
 * OceanEnvironment.tsx — 20-biome deep ocean 3D environment
 *
 * Each biome has completely distinct:
 *   • fog color + density
 *   • wall + floor color + emissive
 *   • ambient / sun light color + intensity
 *   • god-ray color + opacity
 *   • vent lights (vent/seep/nightBloom only)
 *   • background color
 */
import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { DiveConfig, Biome } from '../../utils/buildDiveConfig';
import { Instances, Instance } from '@react-three/drei';

interface OceanEnvironmentProps {
  currentDepth: number;
  config: DiveConfig;
}

// ─── Per-biome visual presets ──────────────────────────────────────────────
const BIOME_ENV: Record<Biome, {
  fogColor:       string;
  wallColor:      string;
  wallEmissive:   string;
  floorColor:     string;
  floorEmissive:  string;
  ambientColor:   string;
  ambientInt:     number;
  sunColor:       string;
  sunInt:         number;
  rayColor:       string;
  rayOpacity:     number;
  bgColor:        string;
}> = {
  // 1. Sunlit Surface — bright turquoise, strong rays
  sunlit:       { fogColor:'#2dd4bf', wallColor:'#0e4a5e', wallEmissive:'#0d3040', floorColor:'#083344', floorEmissive:'#052028', ambientColor:'#7fffd4', ambientInt:1.6, sunColor:'#fffde0', sunInt:2.8, rayColor:'#67e8f9', rayOpacity:0.38, bgColor:'#1af0d0' },
  // 2. Coral Reef — warm teal, vivid walls
  reef:         { fogColor:'#22d3ee', wallColor:'#0c5a4a', wallEmissive:'#0e6050', floorColor:'#1a2e1a', floorEmissive:'#0a2510', ambientColor:'#aef6f6', ambientInt:1.5, sunColor:'#fff9c4', sunInt:2.5, rayColor:'#5eead4', rayOpacity:0.35, bgColor:'#0fd8e4' },
  // 3. Seagrass — green-blue, lush
  seagrass:     { fogColor:'#2dd4bf', wallColor:'#064e3b', wallEmissive:'#0a5c44', floorColor:'#052e16', floorEmissive:'#0a3a1a', ambientColor:'#6ee7b7', ambientInt:1.4, sunColor:'#e0ffe0', sunInt:2.2, rayColor:'#34d399', rayOpacity:0.28, bgColor:'#1ad4b0' },
  // 4. Open Ocean — clear blue, classic
  openOcean:    { fogColor:'#0ea5e9', wallColor:'#0c3461', wallEmissive:'#082040', floorColor:'#071a38', floorEmissive:'#060f20', ambientColor:'#bae6fd', ambientInt:1.4, sunColor:'#e0f2fe', sunInt:2.4, rayColor:'#38bdf8', rayOpacity:0.30, bgColor:'#0ea0e0' },
  // 5. Monsoon Bloom — green haze
  monsoonBloom: { fogColor:'#4ade80', wallColor:'#134e4a', wallEmissive:'#155e40', floorColor:'#052e16', floorEmissive:'#0a3a1a', ambientColor:'#86efac', ambientInt:1.1, sunColor:'#d9f99d', sunInt:1.6, rayColor:'#4ade80', rayOpacity:0.20, bgColor:'#3ac870' },
  // 6. Arabian Sea Upwelling — blue-green nutrient rich
  arabian:      { fogColor:'#38bdf8', wallColor:'#0c4a6e', wallEmissive:'#0a3855', floorColor:'#061928', floorEmissive:'#040e18', ambientColor:'#93c5fd', ambientInt:1.2, sunColor:'#e0f2fe', sunInt:1.8, rayColor:'#38bdf8', rayOpacity:0.25, bgColor:'#28a8e8' },
  // 7. Bay of Bengal — slight green tint, freshwater influence
  bengal:       { fogColor:'#2dd4bf', wallColor:'#115e59', wallEmissive:'#0e4a44', floorColor:'#042f2e', floorEmissive:'#031c1c', ambientColor:'#99f6e4', ambientInt:1.2, sunColor:'#ecfdf5', sunInt:1.9, rayColor:'#2dd4bf', rayOpacity:0.22, bgColor:'#1ac4b0' },
  // 8. Thermocline — blue→indigo seam
  thermocline:  { fogColor:'#0ea5e9', wallColor:'#1e3a8a', wallEmissive:'#1a2a6a', floorColor:'#0c1a5e', floorEmissive:'#080f38', ambientColor:'#a5b4fc', ambientInt:1.0, sunColor:'#c7d2fe', sunInt:1.4, rayColor:'#818cf8', rayOpacity:0.18, bgColor:'#0a8ad4' },
  // 9. OMZ — dark, indigo, almost no life
  omz:          { fogColor:'#1e293b', wallColor:'#0f172a', wallEmissive:'#0a0f1e', floorColor:'#050810', floorEmissive:'#020408', ambientColor:'#334155', ambientInt:0.5, sunColor:'#475569', sunInt:0.3, rayColor:'#334155', rayOpacity:0.06, bgColor:'#111827' },
  // 10. Mesopelagic — twilight cobalt
  mesopelagic:  { fogColor:'#0c4a6e', wallColor:'#0a2240', wallEmissive:'#081830', floorColor:'#040c1c', floorEmissive:'#020608', ambientColor:'#60a5fa', ambientInt:0.6, sunColor:'#1e40af', sunInt:0.5, rayColor:'#3b82f6', rayOpacity:0.10, bgColor:'#083560' },
  // 11. Deep Pelagic — near black, clear
  deepPelagic:  { fogColor:'#0f172a', wallColor:'#080e1c', wallEmissive:'#050810', floorColor:'#020408', floorEmissive:'#010204', ambientColor:'#1e3a5f', ambientInt:0.4, sunColor:'#0f2040', sunInt:0.0, rayColor:'#1e3a8a', rayOpacity:0.05, bgColor:'#090e1a' },
  // 12. Abyssal — black, bioluminescent glow
  abyssal:      { fogColor:'#020617', wallColor:'#030712', wallEmissive:'#06126a', floorColor:'#010308', floorEmissive:'#040a20', ambientColor:'#1e3a5f', ambientInt:0.2, sunColor:'#000000', sunInt:0.0, rayColor:'#1e3a8a', rayOpacity:0.02, bgColor:'#010308' },
  // 13. Deep Trench — deepest black
  trench:       { fogColor:'#0a0a0f', wallColor:'#050508', wallEmissive:'#06060a', floorColor:'#030305', floorEmissive:'#040406', ambientColor:'#111827', ambientInt:0.15, sunColor:'#000000', sunInt:0.0, rayColor:'#111827', rayOpacity:0.01, bgColor:'#050508' },
  // 14. Hydrothermal Vent — BLACK + amber/orange glow
  vent:         { fogColor:'#1c0a00', wallColor:'#1a0800', wallEmissive:'#7c2d12', floorColor:'#0f0400', floorEmissive:'#92400e', ambientColor:'#f97316', ambientInt:0.5, sunColor:'#fb923c', sunInt:0.3, rayColor:'#f97316', rayOpacity:0.12, bgColor:'#0f0400' },
  // 15. Cold Seep — black + teal bioluminescent
  seep:         { fogColor:'#040d0a', wallColor:'#031a0c', wallEmissive:'#0d4429', floorColor:'#021008', floorEmissive:'#134e2e', ambientColor:'#2dd4bf', ambientInt:0.4, sunColor:'#000000', sunInt:0.0, rayColor:'#2dd4bf', rayOpacity:0.08, bgColor:'#020a06' },
  // 16. Cyclone — grey-green turbulent
  cyclone:      { fogColor:'#5b6b6b', wallColor:'#374151', wallEmissive:'#1f2937', floorColor:'#111827', floorEmissive:'#0a0f18', ambientColor:'#9ca3af', ambientInt:0.7, sunColor:'#d1d5db', sunInt:0.8, rayColor:'#9ca3af', rayOpacity:0.12, bgColor:'#3a4a4a' },
  // 17. Eddies & Currents — vivid spinning blue
  eddy:         { fogColor:'#0ea5e9', wallColor:'#0c4a6e', wallEmissive:'#0a3855', floorColor:'#06243a', floorEmissive:'#041828', ambientColor:'#7dd3fc', ambientInt:1.3, sunColor:'#bae6fd', sunInt:2.0, rayColor:'#38bdf8', rayOpacity:0.28, bgColor:'#0890d0' },
  // 18. Marine Heatwave — amber-tinted, warm
  heatwave:     { fogColor:'#f97316', wallColor:'#7c2d12', wallEmissive:'#9a3412', floorColor:'#431407', floorEmissive:'#5a180a', ambientColor:'#fdba74', ambientInt:1.2, sunColor:'#fde68a', sunInt:2.0, rayColor:'#f97316', rayOpacity:0.30, bgColor:'#c84a00' },
  // 19. Night Ocean — moonlit dark blue
  night:        { fogColor:'#0c4a6e', wallColor:'#0a2240', wallEmissive:'#0c1a30', floorColor:'#040c1c', floorEmissive:'#020608', ambientColor:'#60a5fa', ambientInt:0.3, sunColor:'#93c5fd', sunInt:0.2, rayColor:'#3b82f6', rayOpacity:0.06, bgColor:'#072040' },
  // 20. Plankton Bloom Night — glowing greens
  nightBloom:   { fogColor:'#052e16', wallColor:'#064e3b', wallEmissive:'#166534', floorColor:'#022c17', floorEmissive:'#14532d', ambientColor:'#4ade80', ambientInt:0.5, sunColor:'#000000', sunInt:0.0, rayColor:'#22c55e', rayOpacity:0.12, bgColor:'#021a0d' },
};

// Scratch colors — reused every frame
const _tc  = new THREE.Color();
const _sc  = new THREE.Color();
const _dc  = new THREE.Color();

export const OceanEnvironment: React.FC<OceanEnvironmentProps> = ({ currentDepth, config }) => {
  const { scene } = useThree();
  const fogRef            = useRef<THREE.FogExp2 | null>(null);
  const sunLightRef       = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef   = useRef<THREE.AmbientLight | null>(null);
  const lightShaftsRef    = useRef<THREE.Group | null>(null);
  const wallLMatRef       = useRef<THREE.MeshStandardMaterial | null>(null);
  const wallRMatRef       = useRef<THREE.MeshStandardMaterial | null>(null);
  const floorMatRef       = useRef<THREE.MeshStandardMaterial | null>(null);
  const rockMatRef        = useRef<THREE.MeshStandardMaterial | null>(null);

  const noise2D = useMemo(() => createNoise2D(config.rand), [config.seed]);

  const env = BIOME_ENV[config.biome] ?? BIOME_ENV.openOcean;

  // Generate displaced canyon walls from simplex noise
  const leftWallGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(300, 300, 64, 64);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, noise2D(x * 0.04, y * 0.04) * 8 + noise2D(x * 0.1, y * 0.1) * 2);
    }
    geo.computeVertexNormals();
    return geo;
  }, [noise2D]);

  const rightWallGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(300, 300, 64, 64);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, noise2D(x * 0.04 + 100, y * 0.04 + 100) * 8 + noise2D(x * 0.1 + 100, y * 0.1 + 100) * 2);
    }
    geo.computeVertexNormals();
    return geo;
  }, [noise2D]);

  // Coral / vent instances
  const instances = useMemo(() => {
    const items = [];
    for (let i = 0; i < 50; i++) {
      const isLeft = config.rand() > 0.5;
      const x = isLeft ? -13 + config.rand() * 4 : 13 - config.rand() * 4;
      const z = -5 - config.rand() * 80;
      const y = -config.rand() * 200;
      const isShallow = y > -30;
      const isAbyss   = y < -130;
      const isCoral = isShallow && ['reef', 'seagrass', 'sunlit', 'monsoonBloom'].includes(config.biome) && config.rand() > 0.4;
      const isVent  = isAbyss  && ['vent', 'seep', 'abyssal'].includes(config.biome) && config.rand() > 0.65;
      if (isCoral || isVent) {
        items.push({
          position: [x, y, z] as [number, number, number],
          rotation: [config.rand(), config.rand() * Math.PI, config.rand()] as [number, number, number],
          scale: 0.5 + config.rand() * 1.5,
          isCoral, isVent,
        });
      }
    }
    return items;
  }, [config]);

  // Restore the original low-poly "stones" along the canyon walls
  const rockFormations = useMemo(() => {
    const items = [];
    const stepCount = 44;
    for (let i = 0; i < stepCount; i++) {
      const y = 8 - i * 5.2;
      items.push({
        position: [-14 - (i % 4) * 2.2, y, -4 - (i % 5) * 3.5] as [number, number, number],
        rotation: [(i * 0.3) % 0.8, (i * 0.5) % 3.14, (i * 0.2) % 0.6] as [number, number, number],
        scale: [6 + (i % 4) * 1.4, 9 + (i % 3) * 1.8, 7 + (i % 2) * 2.2] as [number, number, number],
      });
      items.push({
        position: [14 + (i % 3) * 2.5, y - 2.5, -6 - (i % 4) * 4.0] as [number, number, number],
        rotation: [-(i * 0.25) % 0.7, (i * 0.7) % 3.14, -(i * 0.3) % 0.5] as [number, number, number],
        scale: [7 + (i % 3) * 1.6, 10 + (i % 2) * 2.0, 6 + (i % 4) * 1.8] as [number, number, number],
      });
      if (i % 3 === 0) {
        const xOff = ((i / 3) % 2 === 0 ? 1 : -1) * (2 + (i % 5) * 0.8);
        items.push({
          position: [xOff, y - 1, -10 - (i % 3) * 2.5] as [number, number, number],
          rotation: [(i * 0.4) % 1.2, (i * 0.6) % 3.14, (i * 0.15) % 0.4] as [number, number, number],
          scale: [2.5 + (i % 3) * 0.8, 3.0 + (i % 4) * 0.6, 2.8 + (i % 2) * 0.9] as [number, number, number],
        });
      }
    }
    return items;
  }, []);

  const floorRocks = useMemo(() => {
    return [-14, -5, 4, 13, -22, 19, -8, 8].map((x, i) => ({
      position: [x, (i % 3) * 0.6 + 1, -16 - i * 3.5] as [number, number, number],
      rotation: [i * 0.3, i * 0.5, i * 0.2] as [number, number, number],
      scale: 1.2 + (i % 3) * 0.5,
    }));
  }, []);

  const floorY = -(config.seafloorDepth / 1000) * 200;

  // Set up initial fog
  useMemo(() => {
    const fog = new THREE.FogExp2(env.fogColor, 0.018);
    scene.fog = fog;
    scene.background = new THREE.Color(env.bgColor);
    fogRef.current = fog;
  }, [scene, env.fogColor, env.bgColor]);

  useFrame((_, delta) => {
    const depthRatio = Math.min(1, currentDepth / 600);
    _sc.set(env.fogColor);
    _dc.set(config.deepColor);
    _tc.copy(_sc).lerp(_dc, depthRatio);

    // Fog density — clamped visibility multiplier
    const base   = THREE.MathUtils.lerp(0.013, 0.042, depthRatio);
    const visMult = Math.min(1.4, Math.max(0.77, 1 / config.visibility));
    const targetDensity = base * visMult;

    // Ambient: OMZ soft ramp
    let targetAmbInt = THREE.MathUtils.lerp(env.ambientInt, env.ambientInt * 0.15, depthRatio);
    if (config.omzTop && currentDepth >= config.omzTop && currentDepth <= config.omzTop + 400) {
      const omzT = Math.min(1, (currentDepth - config.omzTop) / 50);
      targetAmbInt *= THREE.MathUtils.lerp(1, 0.35, omzT);
    }

    // Sun fades with depth and night flag
    const targetSunInt = config.isNight
      ? env.sunInt * 0.1
      : THREE.MathUtils.lerp(env.sunInt, 0.0, Math.min(1, currentDepth / 250));

    // Apply
    if (fogRef.current) {
      fogRef.current.color.lerp(_tc, delta * 3);
      fogRef.current.density = THREE.MathUtils.damp(fogRef.current.density, targetDensity, 3, delta);
      if (scene.background instanceof THREE.Color) scene.background.lerp(_tc, delta * 1.5);
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = THREE.MathUtils.damp(ambientLightRef.current.intensity, targetAmbInt, 3, delta);
      ambientLightRef.current.color.set(env.ambientColor);
    }
    if (sunLightRef.current) {
      sunLightRef.current.intensity = THREE.MathUtils.damp(sunLightRef.current.intensity, targetSunInt, 3, delta);
      sunLightRef.current.color.set(env.sunColor);
    }
    if (lightShaftsRef.current) {
      const shaftAlpha = config.isNight ? 0 : Math.max(0, env.rayOpacity * (1 - currentDepth / (config.monsoon ? 60 : 95)));
      lightShaftsRef.current.visible = shaftAlpha > 0.005;
      lightShaftsRef.current.children.forEach(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.opacity = shaftAlpha;
          child.material.color.set(env.rayColor);
        }
      });
    }
    // Live-update wall + floor materials
    if (wallLMatRef.current) {
      wallLMatRef.current.color.set(env.wallColor);
      wallLMatRef.current.emissive.set(env.wallEmissive);
    }
    if (wallRMatRef.current) {
      wallRMatRef.current.color.set(env.wallColor);
      wallRMatRef.current.emissive.set(env.wallEmissive);
    }
    if (floorMatRef.current) {
      floorMatRef.current.color.set(env.floorColor);
      floorMatRef.current.emissive.set(env.floorEmissive);
    }
    if (rockMatRef.current) {
      rockMatRef.current.color.set(env.wallColor);
      rockMatRef.current.emissive.set(env.wallEmissive);
    }
  });

  return (
    <>
      <directionalLight ref={sunLightRef} position={[10, 25, 10]} color={env.sunColor} intensity={env.sunInt} />
      <ambientLight ref={ambientLightRef} intensity={env.ambientInt} color={env.ambientColor} />
      <pointLight position={[0, floorY + 10, 5]} color={env.ambientColor} intensity={0.7} distance={80} />

      {/* God-ray shafts */}
      <group ref={lightShaftsRef} position={[0, 4, -5]}>
        {[-10, -3, 3, 9, 16].map((xOffset, idx) => (
          <mesh key={idx} position={[xOffset, -12, -idx * 2.5]} rotation={[0.12, 0, -0.10 * (idx - 2)]}>
            <cylinderGeometry args={[0.5, 6.0, 38, 10, 1, true]} />
            <meshBasicMaterial
              color={env.rayColor}
              transparent
              opacity={env.rayOpacity}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Left Wall */}
      <mesh position={[-16, floorY / 2, -20]} rotation={[0, Math.PI / 2, 0]} geometry={leftWallGeo}>
        <meshStandardMaterial
          ref={wallLMatRef}
          color={env.wallColor}
          emissive={env.wallEmissive}
          emissiveIntensity={0.45}
          roughness={0.88}
          flatShading
        />
      </mesh>

      {/* Right Wall */}
      <mesh position={[16, floorY / 2, -20]} rotation={[0, -Math.PI / 2, 0]} geometry={rightWallGeo}>
        <meshStandardMaterial
          ref={wallRMatRef}
          color={env.wallColor}
          emissive={env.wallEmissive}
          emissiveIntensity={0.45}
          roughness={0.88}
          flatShading
        />
      </mesh>

      {/* Sea Floor */}
      <mesh position={[0, floorY, -20]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200, 24, 24]} />
        <meshStandardMaterial
          ref={floorMatRef}
          color={env.floorColor}
          emissive={env.floorEmissive}
          emissiveIntensity={0.35}
          roughness={0.97}
          metalness={0.03}
          flatShading
        />
      </mesh>

      {/* Canyon & Seafloor Low-Poly Rocks (Stones) */}
      <Instances limit={150}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          ref={rockMatRef}
          color={env.wallColor}
          emissive={env.wallEmissive}
          emissiveIntensity={0.4}
          roughness={0.9}
          metalness={0.1}
          flatShading
        />
        {rockFormations.map((rock, i) => (
          <Instance key={`rock-${i}`} position={rock.position} rotation={rock.rotation} scale={rock.scale} />
        ))}
        {floorRocks.map((rock, i) => (
          <Instance key={`f-rock-${i}`} position={[rock.position[0], floorY + rock.position[1], rock.position[2]]} rotation={rock.rotation} scale={rock.scale} />
        ))}
      </Instances>

      {/* Coral Instances — reef/seagrass biomes */}
      <Instances limit={80}>
        <cylinderGeometry args={[0.35, 0.55, 2.2, 7]} />
        <meshStandardMaterial
          color={['reef', 'seagrass'].includes(config.biome) ? '#0d9488' : '#1a3a4a'}
          emissive={['reef', 'seagrass'].includes(config.biome) ? '#0f766e' : '#0e4a5e'}
          emissiveIntensity={0.25}
          roughness={0.85}
          flatShading
        />
        {instances.filter(i => i.isCoral).map((c, i) => (
          <Instance key={`coral-${i}`} position={c.position} rotation={c.rotation} scale={c.scale} />
        ))}
      </Instances>

      {/* Vent chimneys — vent/seep/abyssal biomes */}
      {instances.filter(i => i.isVent).map((v, i) => (
        <group key={`vent-${i}`} position={v.position} rotation={v.rotation} scale={v.scale}>
          <mesh>
            <cylinderGeometry args={[0.5, 1.2, 3.0, 6]} />
            <meshStandardMaterial
              color={config.biome === 'seep' ? '#064e3b' : '#1e293b'}
              emissive={config.biome === 'seep' ? '#0d4429' : '#7c2d12'}
              emissiveIntensity={0.6}
              roughness={0.9}
              flatShading
            />
          </mesh>
          {/* Glowing top */}
          <mesh position={[0, 1.7, 0]}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial color={config.biome === 'seep' ? '#2dd4bf' : '#f97316'} />
          </mesh>
          <pointLight
            position={[0, 1.7, 0]}
            color={config.biome === 'seep' ? '#14b8a6' : '#f97316'}
            intensity={2.2}
            distance={10}
          />
        </group>
      ))}

      {/* Night/nightBloom: scattered bioluminescent sparkle lights */}
      {(config.biome === 'nightBloom' || config.biome === 'night') && (
        <>
          {[-8, -3, 2, 7, 12].map((x, i) => (
            <pointLight key={i} position={[x, -20 - i * 8, -8]} color="#22c55e" intensity={0.6} distance={12} />
          ))}
        </>
      )}
    </>
  );
};