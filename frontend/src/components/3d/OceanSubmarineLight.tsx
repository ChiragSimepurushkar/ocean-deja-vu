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
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const spotTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const pointLightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!spotLightRef.current) return;

    // Follow camera
    spotLightRef.current.position.copy(camera.position);

    // Aim target 30 units ahead of camera direction
    const forward = new THREE.Vector3(0, 0, -30);
    forward.applyQuaternion(camera.quaternion);
    spotTargetRef.current.position.copy(camera.position).add(forward);
    spotTargetRef.current.updateMatrixWorld();

    if (pointLightRef.current) {
      pointLightRef.current.position.copy(camera.position);
    }

    // Toggle intensity directly on the ref (boosted drastically to cut through fog)
    const spotTarget = enabled ? (currentDepth > 100 ? 15.0 : 8.0) : 0;
    const pointTarget = enabled ? (currentDepth > 200 ? 4.0 : 2.0) : 0;

    spotLightRef.current.intensity = spotTarget;
    if (pointLightRef.current) pointLightRef.current.intensity = pointTarget;
  });

  // Add the spot target to scene so R3F can find it
  React.useEffect(() => {
    scene.add(spotTargetRef.current);
    return () => { scene.remove(spotTargetRef.current); };
  }, [scene]);

  return (
    <>
      <spotLight
        ref={spotLightRef}
        color="#cffafe"
        intensity={enabled ? 8.0 : 0}
        angle={0.45}
        penumbra={0.5}
        distance={150}
        castShadow={false}
      />
      <pointLight
        ref={pointLightRef}
        color="#38bdf8"
        intensity={enabled ? 2.0 : 0}
        distance={25}
      />
    </>
  );
};
