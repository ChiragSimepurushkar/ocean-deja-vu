import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisturbance } from './core/DisturbanceContext';

interface OceanCameraProps {
  currentDepth: number; // 0 to 1000m
}

export const OceanCamera: React.FC<OceanCameraProps> = ({ currentDepth }) => {
  const { camera } = useThree();

  // Smoothed camera position and look target
  const currentPos = useRef(new THREE.Vector3(0, 0, 14));
  const currentLook = useRef(new THREE.Vector3(0, -5, -20));

  // Second-layer smoothed mouse input (reduces jitter)
  const smoothSteerX = useRef(0);
  const smoothSteerY = useRef(0);

  const prevPos = useRef(new THREE.Vector3());
  const disturbance = useDisturbance();

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // Map depth (0-1000m) -> 3D Y coordinate
    const targetY = -(currentDepth / 1000) * 200;

    // --- LAYER 1: Smooth raw pointer input ---
    smoothSteerX.current = THREE.MathUtils.damp(smoothSteerX.current, state.pointer.x * 3.5, 2.5, delta);
    smoothSteerY.current = THREE.MathUtils.damp(smoothSteerY.current, state.pointer.y * 2.0, 2.5, delta);

    // --- IDLE FLOAT: multi-layered sine = buoyancy / underwater current ---
    const driftX   = Math.sin(time * 0.28) * 0.9 + Math.sin(time * 0.11) * 0.4 + smoothSteerX.current;
    const driftZ   = 13 + Math.cos(time * 0.22) * 0.7 + Math.sin(time * 0.17) * 0.5;
    const microBobY = Math.sin(time * 0.55) * 0.30 + Math.cos(time * 0.31) * 0.15;

    // --- LAYER 2: Damp camera POSITION (slow = weighty, momentum feel) ---
    currentPos.current.x = THREE.MathUtils.damp(currentPos.current.x, driftX, 2.8, delta);
    // Y uses a very soft factor so depth-diving feels like descending in water
    currentPos.current.y = THREE.MathUtils.damp(
      currentPos.current.y,
      targetY + microBobY + smoothSteerY.current * 0.5,
      1.6,
      delta
    );
    currentPos.current.z = THREE.MathUtils.damp(currentPos.current.z, driftZ, 2.5, delta);

    camera.position.copy(currentPos.current);

    // --- LOOK-AT: lags slightly behind position for inertia feel ---
    const lookX = currentPos.current.x * 0.45 + smoothSteerX.current * 1.8;
    const lookY = currentPos.current.y - 4.5 + smoothSteerY.current * 1.2;
    const lookZ = currentPos.current.z - 24;

    currentLook.current.x = THREE.MathUtils.damp(currentLook.current.x, lookX, 3.0, delta);
    currentLook.current.y = THREE.MathUtils.damp(currentLook.current.y, lookY, 3.0, delta);
    currentLook.current.z = THREE.MathUtils.damp(currentLook.current.z, lookZ, 3.0, delta);

    camera.lookAt(currentLook.current);

    // --- IDLE ROLL: subtle oscillating tilt = floating in water ---
    // Applied AFTER lookAt so it adds on top without fighting the look direction
    const idleRoll = Math.sin(time * 0.38) * 0.018 + Math.cos(time * 0.19) * 0.010;
    camera.rotation.z += idleRoll;

    // --- Update Disturbance System ---
    if (disturbance && delta > 0) {
      const vel = new THREE.Vector3().subVectors(currentPos.current, prevPos.current).divideScalar(delta);
      disturbance.updateDisturber(0, currentPos.current, vel, 8.0, 1.5);
      prevPos.current.copy(currentPos.current);
    }
  });

  return null;
};
