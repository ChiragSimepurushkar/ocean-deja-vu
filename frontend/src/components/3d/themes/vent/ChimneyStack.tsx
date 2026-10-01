import React from 'react';
import { VENT_CONFIG } from './Config';

export const ChimneyStack: React.FC = () => {
  const floorY = VENT_CONFIG.floorY;

  return (
    <group position={[0, floorY, 0]}>
      {/* Black basalt mineral seafloor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[90, 90, 16, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.95} />
      </mesh>

      {/* Main black smoker chimney monolith */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 4.5, 0]}>
          <cylinderGeometry args={[0.9, 2.2, 9, 10]} />
          <meshStandardMaterial color="#1e1b18" roughness={0.95} />
        </mesh>
        <mesh position={[0, 9.5, 0]}>
          <cylinderGeometry args={[0.5, 0.9, 2.5, 8]} />
          <meshStandardMaterial color="#292524" roughness={0.9} />
        </mesh>
        {/* Glowing molten thermal vent orifice with amber point light */}
        <mesh position={[0, 10.8, 0]}>
          <sphereGeometry args={[0.4, 8, 8]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>
        <pointLight
          position={[0, 11, 0]}
          color={VENT_CONFIG.lighting.amberColor}
          intensity={VENT_CONFIG.lighting.amberIntensity}
          distance={20}
        />
      </group>

      {/* Flanking secondary spires */}
      {[-4, 4].map((x, i) => (
        <group key={i} position={[x, 0, i === 0 ? -3 : 3]}>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.5, 1.4, 6, 8]} />
            <meshStandardMaterial color="#1c1917" roughness={0.95} />
          </mesh>
          <pointLight
            position={[0, 6.2, 0]}
            color="#fb923c"
            intensity={1.5}
            distance={10}
          />
        </group>
      ))}
    </group>
  );
};
