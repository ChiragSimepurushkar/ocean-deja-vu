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
import { Compass, Lightbulb, MousePointer } from 'lucide-react';

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
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-cyan-400 p-6 text-center">
        <Compass className="w-12 h-12 text-cyan-500 mb-3 animate-pulse" />
        <h3 className="text-lg font-bold font-display text-white mb-1">WebGL 3D Context Suspended</h3>
        <p className="text-sm text-slate-400 max-w-sm mb-4">
          Hardware acceleration unavailable. Toggle to 2D Illustrated Mode from the top toolbar to explore.
        </p>
      </div>
    );
  }

  // Bloom intensity scales with depth — deeper = more bioluminescence glow
  const bloomIntensity = currentDepth > 400 ? 1.8 : currentDepth > 200 ? 1.2 : 0.7;
  const bloomThreshold = currentDepth > 400 ? 0.5 : currentDepth > 200 ? 0.65 : 0.8;

  return (
    <div className="relative w-full h-full select-none">
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
        className="w-full h-full !absolute inset-0"
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
      <div className="absolute top-18 left-4 sm:left-6 z-20 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => setFlashlightOn(!flashlightOn)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border backdrop-blur-sm transition-colors cursor-pointer shadow-md ${
            flashlightOn
              ? 'bg-amber-950/50 border-amber-500/60 text-amber-200'
              : 'bg-slate-900/60 border-slate-700 text-slate-400'
          }`}
          title="Toggle Submersible Exploration Headlights"
        >
          <Lightbulb className={`w-3.5 h-3.5 ${flashlightOn ? 'text-amber-400' : 'text-slate-500'}`} />
          <span>Lights: {flashlightOn ? 'ON' : 'OFF'}</span>
        </button>

        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-cyan-300/80 bg-slate-950/60 border border-cyan-900/40 rounded backdrop-blur-sm">
          <MousePointer className="w-3 h-3 text-cyan-400" />
          <span>Move mouse to steer sub · Scroll to dive</span>
        </div>
      </div>
    </div>
  );
};