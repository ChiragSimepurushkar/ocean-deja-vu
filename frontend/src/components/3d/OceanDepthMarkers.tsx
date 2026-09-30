import React from 'react';
import * as THREE from 'three';

interface OceanDepthMarkersProps {
  currentDepth: number;
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

export const OceanDepthMarkers: React.FC<OceanDepthMarkersProps> = ({ currentDepth }) => {
  return (
    <group>
      {MARKERS.map((m) => {
        const isCurrent = Math.abs(currentDepth - m.depth) < 40;

        return (
          <group key={m.depth} position={[0, m.y, -12]}>
            {/* Sonar ring — purely visual, no text */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[14, 14.15, 64]} />
              <meshBasicMaterial
                color={isCurrent ? '#38bdf8' : '#0369a1'}
                transparent
                opacity={isCurrent ? 0.55 : 0.18}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Small glowing beacon dot at center — no label */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshBasicMaterial
                color={isCurrent ? '#7dd3fc' : '#0369a1'}
                transparent
                opacity={isCurrent ? 0.9 : 0.4}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
