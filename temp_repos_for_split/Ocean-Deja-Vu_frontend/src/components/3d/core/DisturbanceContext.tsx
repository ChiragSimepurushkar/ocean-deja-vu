import React, { createContext, useContext, useRef } from 'react';
import * as THREE from 'three';

export interface Disturber {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  strength: number;
}

export interface DisturbanceSystem {
  disturbers: Disturber[];
  updateDisturber: (index: number, pos: THREE.Vector3, vel: THREE.Vector3, radius?: number, strength?: number) => void;
  getDisturbanceUniforms: () => {
    uDisturberPositions: { value: THREE.Vector3[] };
    uDisturberRadii: { value: number[] };
    uDisturberCount: { value: number };
  };
}

const MAX_DISTURBERS = 16;

export const DisturbanceContext = createContext<DisturbanceSystem | null>(null);

export const DisturbanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const disturbersRef = useRef<Disturber[]>(
    Array.from({ length: MAX_DISTURBERS }, () => ({
      position: new THREE.Vector3(0, -9999, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      radius: 2.5,
      strength: 1.0,
    }))
  );

  const uniformsRef = useRef({
    uDisturberPositions: { value: disturbersRef.current.map((d) => d.position) },
    uDisturberRadii: { value: disturbersRef.current.map((d) => d.radius) },
    uDisturberCount: { value: 1 },
  });

  const system = useRef<DisturbanceSystem>({
    disturbers: disturbersRef.current,
    updateDisturber: (index, pos, vel, radius = 2.5, strength = 1.0) => {
      if (index >= 0 && index < MAX_DISTURBERS) {
        disturbersRef.current[index].position.copy(pos);
        disturbersRef.current[index].velocity.copy(vel);
        disturbersRef.current[index].radius = radius;
        disturbersRef.current[index].strength = strength;
      }
    },
    getDisturbanceUniforms: () => uniformsRef.current,
  });

  return (
    <DisturbanceContext.Provider value={system.current}>
      {children}
    </DisturbanceContext.Provider>
  );
};

export function useDisturbance() {
  const ctx = useContext(DisturbanceContext);
  return ctx;
}
