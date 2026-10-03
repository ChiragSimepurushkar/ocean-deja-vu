import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface OceanSubmarineLightProps {
  currentDepth: number;
  enabled?: boolean;
}

export const OceanSubmarineLight: React.FC<OceanSubmarineLightProps> = ({
  currentDepth,
  enabled = true,
}) => {
  const { camera, scene } = useThree();
  const spotLightRef   = useRef<THREE.SpotLight>(null);
  const pointLightRef  = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!spotLightRef.current) return;

    // The light should stick exactly to the camera's position
    spotLightRef.current.position.copy(camera.position);

    // To make a spotlight follow the camera's rotation in world space,
    // we take a point exactly 1 unit forward (-Z) in the camera's local space
    // and translate that to world space to be the light's target.
    const forwardVector = new THREE.Vector3(0, 0, -1);
    forwardVector.applyMatrix4(camera.matrixWorld);
    
    // Update the default target object of the spotlight
    spotLightRef.current.target.position.copy(forwardVector);
    spotLightRef.current.target.updateMatrixWorld();

    // Ensure the target is actually attached to the scene, or Three.js ignores it
    if (spotLightRef.current.target.parent !== scene) {
      scene.add(spotLightRef.current.target);
    }

    if (pointLightRef.current) {
      pointLightRef.current.position.copy(camera.position);
    }

    // Reactive intensities that instantly respond to the enabled toggle
    // Note: Modern Three.js uses physically correct lighting, so 6.0 is basically a candle. We need 100s for a searchlight!
    const spotIntensity   = enabled ? (currentDepth > 100 ? 300 : 150) : 0;
    const pointIntensity  = enabled ? (currentDepth > 200 ? 40 : 20) : 0;
    
    // Smoothly damp the intensity so it feels like a real halogen bulb turning on/off
    spotLightRef.current.intensity = THREE.MathUtils.lerp(spotLightRef.current.intensity, spotIntensity, 0.15);
    if (pointLightRef.current) {
      pointLightRef.current.intensity = THREE.MathUtils.lerp(pointLightRef.current.intensity, pointIntensity, 0.15);
    }
  });

  return (
    <>
      <spotLight
        ref={spotLightRef}
        color="#cffafe"
        angle={0.52}
        penumbra={0.7}
        distance={120}
        decay={1.2}
        castShadow
        intensity={0}
      />
      <pointLight
        ref={pointLightRef}
        color="#38bdf8"
        intensity={0}
        distance={25}
        decay={1.5}
      />
    </>
  );
};
