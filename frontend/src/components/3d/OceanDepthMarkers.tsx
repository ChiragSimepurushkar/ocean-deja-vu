import React from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface OceanDepthMarkersProps {
  currentDepth: number;
}

const MARKERS = [
  { depth: 0,    label: 'SURFACE LAYER',        y: 0,    sub: 'Epipelagic Zone' },
  { depth: 50,   label: '50m · UPPER MIXED',    y: -10,  sub: 'Solar Penetration' },
  { depth: 100,  label: '100m · THERMOCLINE',   y: -20,  sub: 'Rapid Temp Drop' },
  { depth: 200,  label: '200m · MESOPELAGIC',   y: -40,  sub: 'Twilight Threshold' },
  { depth: 300,  label: '300m · DEEP THERMO',   y: -60,  sub: 'Oxygen Minimum' },
  { depth: 500,  label: '500m · BATHYPELAGIC',  y: -100, sub: 'Complete Darkness' },
  { depth: 1000, label: '1000m · ABYSSAL FLOOR',y: -200, sub: 'Hydrothermal Bed' },
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

            {/* Floating Telemetry Overlay — inline styles only, no Tailwind */}
            <Html
              position={[0, 1.2, 0]}
              center
              distanceFactor={35}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div style={{
                padding: '4px 12px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                transition: 'all 0.3s',
                background: isCurrent ? 'rgba(8,47,73,0.85)' : 'rgba(2,8,20,0.45)',
                border: isCurrent ? '1px solid #38bdf8' : '1px solid rgba(3,105,161,0.35)',
                opacity: isCurrent ? 1 : 0.65,
                transform: isCurrent ? 'scale(1.05)' : 'scale(1)',
                boxShadow: isCurrent ? '0 0 18px rgba(56,189,248,0.25)' : 'none',
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  letterSpacing: '0.08em',
                  color: isCurrent ? '#cffafe' : 'rgba(103,232,249,0.6)',
                }}>
                  {m.label}
                </div>
                <div style={{
                  fontSize: '9px',
                  color: isCurrent ? '#94a3b8' : 'rgba(148,163,184,0.5)',
                }}>
                  {m.sub}
                </div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
