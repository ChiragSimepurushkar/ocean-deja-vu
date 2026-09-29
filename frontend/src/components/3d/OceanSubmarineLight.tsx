import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface OceanSubmarineLightProps {
  currentDepth: number; // 0 to 1000m
  enabled?: boolean;
}

export const OceanSubmarineLight: React.FC<OceanSubmarineLightProps> = ({
  currentDepth,
  enabled = true,
}) => {
  const { camera } = useThree();
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!spotLightRef.current || !targetRef.current) return;

    // Follow camera position with slight forward offset
    spotLightRef.current.position.copy(camera.position);

    // Target 25 units straight in front of where camera is pointing
    const forwardVector = new THREE.Vector3(0, 0, -25);
    forwardVector.applyQuaternion(camera.quaternion);
    targetRef.current.position.copy(camera.position).add(forwardVector);

    if (pointLightRef.current) {
      pointLightRef.current.position.copy(camera.position);
    }
  });

  // Light is most visible and critical in deeper waters (>100m)
  const intensity = enabled ? (currentDepth > 100 ? 5.5 : 2.5) : 0;

  return (
    <>
      <object3D ref={targetRef} />
      {/* High-intensity submersible searchlight beam */}
      <spotLight
        ref={spotLightRef}
        target={targetRef.current || undefined}
        intensity={intensity}
        color="#cffafe"
        angle={0.52}
        penumbra={0.7}
        distance={60}
        castShadow
      />
      {/* Soft local cockpit proximity wash light */}
      <pointLight
        ref={pointLightRef}
        color="#38bdf8"
        intensity={currentDepth > 200 ? 1.5 : 0.8}
        distance={12}
      />
    </>
  );
};
