import React from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface OceanDepthMarkersProps {
  currentDepth: number;
}

const MARKERS = [
  { depth: 0, label: 'SURFACE LAYER', y: 0, sub: 'Epipelagic Zone' },
  { depth: 50, label: '50m · UPPER MIXED', y: -10, sub: 'Solar Penetration' },
  { depth: 100, label: '100m · THERMOCLINE ENTRY', y: -20, sub: 'Rapid Temp Drop' },
  { depth: 200, label: '200m · MESOPELAGIC', y: -40, sub: 'Twilight Threshold' },
  { depth: 300, label: '300m · DEEP THERMOCLINE', y: -60, sub: 'Oxygen Minimum' },
  { depth: 500, label: '500m · BATHYPELAGIC', y: -100, sub: 'Complete Darkness' },
  { depth: 1000, label: '1000m · ABYSSAL FLOOR', y: -200, sub: 'Hydrothermal Bed' },
];

export const OceanDepthMarkers: React.FC<OceanDepthMarkersProps> = ({ currentDepth }) => {
  return (
    <group>
      {MARKERS.map((m) => {
        const isCurrent = Math.abs(currentDepth - m.depth) < 40;

        return (
          <group key={m.depth} position={[0, m.y, -12]}>
            {/* 3D Holographic Ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[14, 14.15, 64]} />
              <meshBasicMaterial
                color={isCurrent ? '#38bdf8' : '#0369a1'}
                transparent
                opacity={isCurrent ? 0.75 : 0.25}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Glowing Center Sonar Beacon Pin */}
            <mesh position={[0, 0, 0]}>
              <octahedronGeometry args={[0.35]} />
              <meshBasicMaterial
                color={isCurrent ? '#38bdf8' : '#0284c7'}
                wireframe={!isCurrent}
              />
            </mesh>

            {/* Floating 3D Telemetry Overlay */}
            <Html
              position={[0, 1.2, 0]}
              center
              distanceFactor={35}
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              <div
                className={`transition-all duration-300 px-3 py-1 rounded border font-mono whitespace-nowrap text-center ${
                  isCurrent
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-500/20 scale-105'
                    : 'bg-slate-950/40 border-cyan-900/40 text-cyan-600/70 opacity-60'
                }`}
              >
                <div className="text-[11px] font-bold tracking-wider">{m.label}</div>
                <div className="text-[9px] text-slate-400">{m.sub}</div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
