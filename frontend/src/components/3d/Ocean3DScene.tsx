import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OceanCamera } from './OceanCamera';
import { OceanEnvironment } from './OceanEnvironment';
import { OceanSubmarineLight } from './OceanSubmarineLight';
import { MarineSnow3D } from './MarineSnow3D';
import { Creatures3D } from './Creatures3D';
import { OceanDepthMarkers } from './OceanDepthMarkers';
import { MarineSpecies } from '../../types';
import { DiveConfig } from '../../utils/buildDiveConfig';

interface Ocean3DSceneProps {
  currentDepth: number;
  onDiscoverSpecies: (species: MarineSpecies) => void;
  discoveredSpeciesIds: string[];
  flashlightOn?: boolean;
  config: DiveConfig;
}

export const Ocean3DScene: React.FC<Ocean3DSceneProps> = ({
  currentDepth,
  onDiscoverSpecies,
  discoveredSpeciesIds,
  flashlightOn = true,
  config,
}) => {
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) setWebglError(true);
    } catch {
      setWebglError(true);
    }
  }, []);

  if (webglError) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#020617',
        color: '#38bdf8', padding: '2rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
        <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: '0.5rem' }}>WebGL Unavailable</h3>
        <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '320px' }}>
          Hardware acceleration is disabled. Switch to 2D View in the top bar.
        </p>
      </div>
    );
  }

  // Bloom scales with depth: deeper = more bioluminescent glow
  const bloomIntensity = currentDepth > 400 ? 1.8 : currentDepth > 200 ? 1.2 : 0.65;
  const bloomThreshold = currentDepth > 400 ? 0.5 : currentDepth > 200 ? 0.65 : 0.82;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        camera={{
          fov: 55,
          near: 0.1,
          far: 280,
          position: [0, 0, 14],
        }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          {/* Cinematic smooth submersible camera */}
          <OceanCamera currentDepth={currentDepth} />

          {/* Submarine searchlight — controlled by external flashlightOn prop */}
          <OceanSubmarineLight currentDepth={currentDepth} enabled={flashlightOn} />

          {/* Dynamic canyon environment, fog, god-rays */}
          <OceanEnvironment currentDepth={currentDepth} config={config} />

          {/* Drifting marine snow particles */}
          <MarineSnow3D currentDepth={currentDepth} count={1400} config={config} />

          {/* 10 animated creature types — purely decorative, no click */}
          <Creatures3D
            currentDepth={currentDepth}
            onDiscoverSpecies={onDiscoverSpecies}
            discoveredSpeciesIds={discoveredSpeciesIds}
            config={config}
          />

          {/* Subtle sonar depth rings — no HTML labels */}
          <OceanDepthMarkers currentDepth={currentDepth} config={config} />

          {/* Bloom post-processing for bioluminescence */}
          <EffectComposer>
            <Bloom
              intensity={bloomIntensity}
              luminanceThreshold={bloomThreshold}
              luminanceSmoothing={0.9}
              radius={0.8}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
};