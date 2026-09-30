import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OceanCamera } from './OceanCamera';
import { OceanEnvironment } from './OceanEnvironment';
import { OceanSubmarineLight } from './OceanSubmarineLight';
import { MarineSnow3D } from './MarineSnow3D';
import { Creatures3D } from './Creatures3D';
import { OceanDepthMarkers } from './OceanDepthMarkers';
import { MarineSpecies } from '../../types';
import { Lightbulb, MousePointer } from 'lucide-react';

interface Ocean3DSceneProps {
  currentDepth: number;
  onDiscoverSpecies: (species: MarineSpecies) => void;
  discoveredSpeciesIds: string[];
}

export const Ocean3DScene: React.FC<Ocean3DSceneProps> = ({
  currentDepth,
  onDiscoverSpecies,
  discoveredSpeciesIds,
}) => {
  const [flashlightOn, setFlashlightOn] = useState(true);
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
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#22d3ee', padding: '24px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>WebGL 3D Context Suspended</h3>
        <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '360px' }}>
          Hardware acceleration unavailable. Please enable hardware acceleration in your browser settings.
        </p>
      </div>
    );
  }

  // Bloom intensity scales with depth — deeper = more bioluminescence glow
  const bloomIntensity = currentDepth > 400 ? 1.8 : currentDepth > 200 ? 1.2 : 0.7;
  const bloomThreshold = currentDepth > 400 ? 0.5 : currentDepth > 200 ? 0.65 : 0.8;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', userSelect: 'none' }}>
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
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          {/* Cinematic smooth submersible camera */}
          <OceanCamera currentDepth={currentDepth} />

          {/* Submarine searchlight + proximity fill */}
          <OceanSubmarineLight currentDepth={currentDepth} enabled={flashlightOn} />

          {/* Dynamic canyon, lighting, fog, god-rays */}
          <OceanEnvironment currentDepth={currentDepth} />

          {/* Marine snow particles */}
          <MarineSnow3D currentDepth={currentDepth} count={1400} />

          {/* 10 creature types populating every depth band */}
          <Creatures3D
            currentDepth={currentDepth}
            onDiscoverSpecies={onDiscoverSpecies}
            discoveredSpeciesIds={discoveredSpeciesIds}
          />

          {/* Sonar depth rings */}
          <OceanDepthMarkers currentDepth={currentDepth} />

          {/* Bloom post-processing — bioluminescence glow + light shafts */}
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

      {/* Controls overlay */}
      <div style={{ position: 'absolute', top: '72px', left: '24px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => setFlashlightOn(!flashlightOn)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', fontSize: '12px', fontFamily: 'monospace',
            borderRadius: '4px', border: flashlightOn ? '1px solid rgba(245,158,11,0.6)' : '1px solid #334155',
            background: flashlightOn ? 'rgba(69,26,3,0.5)' : 'rgba(15,23,42,0.6)',
            color: flashlightOn ? '#fde68a' : '#94a3b8', cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
          title="Toggle Submersible Exploration Headlights"
        >
          <Lightbulb style={{ width: 14, height: 14, color: flashlightOn ? '#fbbf24' : '#64748b' }} />
          <span>Lights: {flashlightOn ? 'ON' : 'OFF'}</span>
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '4px 10px', fontSize: '11px', fontFamily: 'monospace',
          color: 'rgba(103,232,249,0.8)', background: 'rgba(2,9,20,0.6)',
          border: '1px solid rgba(8,47,73,0.4)', borderRadius: '4px',
          backdropFilter: 'blur(4px)',
        }}>
          <MousePointer style={{ width: 12, height: 12, color: '#22d3ee' }} />
          <span>Mouse to steer · W/S or ↑↓ to dive · A/D or ←→ to strafe</span>
        </div>
      </div>
    </div>
  );
};