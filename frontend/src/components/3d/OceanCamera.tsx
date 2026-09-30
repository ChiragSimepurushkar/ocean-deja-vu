import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface OceanCameraProps {
  currentDepth: number; // 0 to 1000m
}

export const OceanCamera: React.FC<OceanCameraProps> = ({ currentDepth }) => {
  const { camera } = useThree();

  // Smoothed camera position and look target
  const currentPos = useRef(new THREE.Vector3(0, 0, 14));
  const currentLook = useRef(new THREE.Vector3(0, -5, -20));

  // Second-layer smoothed mouse input
  const smoothSteerX = useRef(0);
  const smoothSteerY = useRef(0);

  // Manual movement offsets (WASD / Arrow keys)
  const manualOffset = useRef(new THREE.Vector3(0, 0, 0));
  const manualVelocity = useRef(new THREE.Vector3(0, 0, 0));

  // Track which keys are held
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const k = keys.current;

    // --- KEYBOARD MOVEMENT ---
    const moveSpeedX = 14;  // left/right — lightly fast, feels snappy
    const friction = 0.94;  // silky long glide when key released

    // Left / Right: A/D or Arrow keys
    if (k['ArrowLeft']  || k['KeyA']) manualVelocity.current.x -= moveSpeedX * delta;
    if (k['ArrowRight'] || k['KeyD']) manualVelocity.current.x += moveSpeedX * delta;

    // Apply friction so the camera glides smoothly to a stop
    manualVelocity.current.multiplyScalar(friction);

    // Cap max velocity
    manualVelocity.current.x = THREE.MathUtils.clamp(manualVelocity.current.x, -2.5, 2.5);

    // Large exploration bounds (horizontal only, vertical is handled by global currentDepth)
    manualOffset.current.add(manualVelocity.current);
    manualOffset.current.x = THREE.MathUtils.clamp(manualOffset.current.x, -120, 120);
    // Keep Y offset clamped to 0 since we now use depth for vertical
    manualOffset.current.y = 0;

    // Map depth (0-1000m) -> 3D Y coordinate
    const targetY = -(currentDepth / 1000) * 200;

    // --- Mouse steer ---
    smoothSteerX.current = THREE.MathUtils.damp(smoothSteerX.current, state.pointer.x * 3.5, 1.2, delta);
    smoothSteerY.current = THREE.MathUtils.damp(smoothSteerY.current, state.pointer.y * 2.0, 1.2, delta);

    // --- IDLE FLOAT ---
    const driftX   = Math.sin(time * 0.28) * 0.9 + Math.sin(time * 0.11) * 0.4 + smoothSteerX.current + manualOffset.current.x;
    const driftZ   = 13 + Math.cos(time * 0.22) * 0.7 + Math.sin(time * 0.17) * 0.5;
    const microBobY = Math.sin(time * 0.55) * 0.30 + Math.cos(time * 0.31) * 0.15;

    // --- DAMP camera POSITION — softer so movement feels fluid ---
    currentPos.current.x = THREE.MathUtils.damp(currentPos.current.x, driftX, 2.2, delta);
    currentPos.current.y = THREE.MathUtils.damp(
      currentPos.current.y,
      targetY + microBobY + smoothSteerY.current * 0.5 + manualOffset.current.y,
      1.4,
      delta
    );
    currentPos.current.z = THREE.MathUtils.damp(currentPos.current.z, driftZ, 1.8, delta);

    camera.position.copy(currentPos.current);

    // --- LOOK-AT: lags behind for inertia ---
    const lookX = currentPos.current.x * 0.45 + smoothSteerX.current * 1.8;
    const lookY = currentPos.current.y - 4.5 + smoothSteerY.current * 1.2;
    const lookZ = currentPos.current.z - 24;

    currentLook.current.x = THREE.MathUtils.damp(currentLook.current.x, lookX, 1.2, delta);
    currentLook.current.y = THREE.MathUtils.damp(currentLook.current.y, lookY, 1.2, delta);
    currentLook.current.z = THREE.MathUtils.damp(currentLook.current.z, lookZ, 1.2, delta);

    camera.lookAt(currentLook.current);

    // --- IDLE ROLL ---
    const idleRoll = Math.sin(time * 0.38) * 0.012 + Math.cos(time * 0.19) * 0.007;
    camera.rotation.z += idleRoll;
  });

  return null;
};
