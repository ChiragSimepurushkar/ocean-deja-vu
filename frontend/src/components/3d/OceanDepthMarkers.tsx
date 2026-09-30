import React from 'react';
import * as THREE from 'three';

import { DiveConfig } from '../../utils/buildDiveConfig';

interface OceanDepthMarkersProps {
  currentDepth: number;
  config: DiveConfig;
}

const MARKERS = [
  { depth: 0,    y: 0    },
  { depth: 50,   y: -10  },
  { depth: 100,  y: -20  },
  { depth: 200,  y: -40  },
  { depth: 300,  y: -60  },
  { depth: 500,  y: -100 },
  { depth: 1000, y: -200 },
];

export const OceanDepthMarkers: React.FC<OceanDepthMarkersProps> = ({ currentDepth, config }) => {
  const dynamicMarkers = [...MARKERS];
  if (config.thermoclineDepth) {
    dynamicMarkers.push({ depth: config.thermoclineDepth, y: -(config.thermoclineDepth / 1000) * 200, isThermo: true });
  }
  return (
    <group>
      {dynamicMarkers.map((m, idx) => {
        const isCurrent = Math.abs(currentDepth - m.depth) < 40;
        const color = m.isThermo ? '#f59e0b' : (isCurrent ? '#38bdf8' : '#0369a1');

        return (
          <group key={`${m.depth}-${idx}`} position={[0, m.y, -12]}>
            {/* Sonar ring — purely visual, no text */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[14, 14.15, 64]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={m.isThermo ? 0.8 : (isCurrent ? 0.55 : 0.18)}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Small glowing beacon dot at center — no label */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshBasicMaterial
                color={m.isThermo ? '#fbbf24' : (isCurrent ? '#7dd3fc' : '#0369a1')}
                transparent
                opacity={m.isThermo ? 1 : (isCurrent ? 0.9 : 0.4)}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
