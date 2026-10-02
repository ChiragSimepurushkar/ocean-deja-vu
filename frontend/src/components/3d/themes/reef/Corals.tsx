import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { REEF_CONFIG } from './Config';
import { depthToY } from '../../core/depthScale';

// Custom GLSL shader with caustics and continuous coral bleaching timeline
const CORAL_SHADER = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    uniform float uTime;
    attribute vec3 aColor;
    varying vec3 vBaseColor;

    void main() {
      vUv = uv;
      vBaseColor = aColor;
      vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
      // Gentle current micro-sway for sea fans and branch tips
      worldPos.x += sin(uTime * 1.5 + worldPos.y * 0.8) * 0.05 * clamp((position.y + 1.0) * 0.5, 0.0, 1.0);
      vWorldPosition = worldPos.xyz;
      vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uBleach; // 0 = healthy, 0.5 = bleached white, 1.0 = dead algae grey-brown
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vBaseColor;

    float causticPattern(vec2 p, float t) {
      vec2 p1 = p + vec2(sin(t + p.y * 2.5), cos(t + p.x * 2.2)) * 0.2;
      vec2 p2 = p + vec2(cos(t * 1.2 - p.y * 1.8), sin(t * 0.8 + p.x * 2.8)) * 0.2;
      float c1 = sin(p1.x * 10.0) * sin(p1.y * 10.0);
      float c2 = sin(p2.x * 12.0) * sin(p2.y * 12.0);
      return pow(max(0.0, (c1 + c2) * 0.5 + 0.5), 2.5);
    }

    void main() {
      float caustic = causticPattern(vWorldPosition.xz * 0.4, uTime * 1.4) * max(0.0, vNormal.y);
      vec3 lightDir = normalize(vec3(0.3, 0.9, 0.2));
      float diff = max(dot(vNormal, lightDir), 0.15);

      vec3 healthy = vBaseColor * (diff + caustic * 0.5);
      vec3 bleachedWhite = vec3(0.96, 0.97, 0.95) * (diff + caustic * 0.3);
      vec3 deadAlgae = vec3(0.28, 0.27, 0.22) * diff;

      // 0..0.5: healthy -> white bleach
      // 0.5..1.0: white bleach -> dead algae
      vec3 finalCol;
      if (uBleach < 0.5) {
        finalCol = mix(healthy, bleachedWhite, uBleach * 2.0);
      } else {
        finalCol = mix(bleachedWhite, deadAlgae, (uBleach - 0.5) * 2.0);
      }

      gl_FragColor = vec4(finalCol, 1.0);
    }
  `,
};

/**
 * Procedural branching Acropora coral geometry generator
 * Merges recursive branching cylinders into a single pristine geometry.
 */
function createBranchingCoralGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  function addBranch(origin: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, depth: number) {
    if (depth <= 0) return;
    const cyl = new THREE.CylinderGeometry(radius * 0.65, radius, length, 6);
    // Align cylinder to direction
    cyl.translate(0, length / 2, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    cyl.applyQuaternion(quat);
    cyl.translate(origin.x, origin.y, origin.z);
    geometries.push(cyl);

    const tip = origin.clone().add(dir.clone().normalize().multiplyScalar(length));
    const childLen = length * 0.75;
    const childRad = radius * 0.7;

    // 2-3 child branches splayed outward
    const branchCount = depth === 3 ? 3 : 2;
    for (let b = 0; b < branchCount; b++) {
      const angle = (b / branchCount) * Math.PI * 2 + depth;
      const spread = 0.45;
      const childDir = new THREE.Vector3(
        dir.x + Math.cos(angle) * spread,
        dir.y + 0.8,
        dir.z + Math.sin(angle) * spread
      ).normalize();
      addBranch(tip, childDir, childLen, childRad, depth - 1);
    }
  }

  addBranch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 1.2, 0.18, 3);

  // Merge geometries
  let totalVerts = 0;
  geometries.forEach(g => { totalVerts += g.attributes.position.count; });
  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  let offset = 0;

  geometries.forEach(g => {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    posArr.set(p, offset * 3);
    normArr.set(n, offset * 3);
    offset += g.attributes.position.count;
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  return merged;
}

export const ReefCorals: React.FC<{ bleachFactor?: number }> = ({ bleachFactor = 0 }) => {
  const branchingRef = useRef<THREE.InstancedMesh>(null);
  const tableRef = useRef<THREE.InstancedMesh>(null);
  const brainRef = useRef<THREE.InstancedMesh>(null);
  const spongeRef = useRef<THREE.InstancedMesh>(null);
  const fanRef = useRef<THREE.InstancedMesh>(null);

  const floorY = depthToY(35); // 35m depth for rich coral reef crest

  const branchingGeo = useMemo(() => createBranchingCoralGeometry(), []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBleach: { value: bleachFactor },
  }), [bleachFactor]);

  // Branching Acropora instances (30 colonies)
  const branchingData = useMemo(() => {
    const count = 30;
    const mats: THREE.Matrix4[] = [];
    const colors = new Float32Array(count * 3);
    const dummy = new THREE.Object3D();
    const palette = ['#f43f5e', '#ec4899', '#fb923c', '#a855f7'];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.4;
      const radius = 6 + (i % 5) * 4.2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.7 + Math.random() * 0.6;

      dummy.position.set(x, floorY + 0.1, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.2);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      const c = new THREE.Color(palette[i % palette.length]);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { count, mats, colors };
  }, [floorY]);

  // Table Corals (20 tiered plates)
  const tableData = useMemo(() => {
    const count = 20;
    const mats: THREE.Matrix4[] = [];
    const colors = new Float32Array(count * 3);
    const dummy = new THREE.Object3D();
    const palette = ['#14b8a6', '#06b6d4', '#10b981', '#f59e0b'];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 8 + (i % 4) * 5.0;
      const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 4;
      const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 4;
      const stalkH = 1.0 + Math.random() * 1.5;

      dummy.position.set(x, floorY + stalkH, z);
      dummy.rotation.set(0.1, Math.random() * Math.PI * 2, 0.05);
      dummy.scale.set(1.8 + Math.random() * 1.0, 0.22, 1.8 + Math.random() * 1.0);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      const c = new THREE.Color(palette[i % palette.length]);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { count, mats, colors };
  }, [floorY]);

  // Brain Corals (15 massive boulder spheres with noise ridges)
  const brainData = useMemo(() => {
    const count = 15;
    const mats: THREE.Matrix4[] = [];
    const colors = new Float32Array(count * 3);
    const dummy = new THREE.Object3D();
    const palette = ['#eab308', '#ca8a04', '#d97706'];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 36;
      const z = (Math.random() - 0.5) * 36;
      const r = 1.0 + Math.random() * 0.9;

      dummy.position.set(x, floorY + r * 0.7, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(r, r * 0.75, r);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      const c = new THREE.Color(palette[i % palette.length]);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { count, mats, colors };
  }, [floorY]);

  // Giant Barrel Sponges (18 open hollow vase cylinders)
  const spongeData = useMemo(() => {
    const count = 18;
    const mats: THREE.Matrix4[] = [];
    const colors = new Float32Array(count * 3);
    const dummy = new THREE.Object3D();
    const palette = ['#ea580c', '#c2410c', '#b45309'];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 38;
      const z = (Math.random() - 0.5) * 38;
      const h = 1.4 + Math.random() * 1.2;

      dummy.position.set(x, floorY + h * 0.5, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(0.7, h, 0.7);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      const c = new THREE.Color(palette[i % palette.length]);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { count, mats, colors };
  }, [floorY]);

  // Sea Fans (24 swaying gorgonian fan planes)
  const fanData = useMemo(() => {
    const count = 24;
    const mats: THREE.Matrix4[] = [];
    const colors = new Float32Array(count * 3);
    const dummy = new THREE.Object3D();
    const palette = ['#ec4899', '#f43f5e', '#8b5cf6', '#06b6d4'];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      const scale = 1.2 + Math.random() * 1.0;

      dummy.position.set(x, floorY + scale * 0.5, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      const c = new THREE.Color(palette[i % palette.length]);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { count, mats, colors };
  }, [floorY]);

  // Set up matrices on mount
  useMemo(() => {
    //
  }, []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime();
    uniforms.uBleach.value = bleachFactor;

    if (branchingRef.current && branchingRef.current.count === branchingData.count) {
      branchingData.mats.forEach((m, i) => branchingRef.current!.setMatrixAt(i, m));
      branchingRef.current.instanceMatrix.needsUpdate = true;
    }
    if (tableRef.current && tableRef.current.count === tableData.count) {
      tableData.mats.forEach((m, i) => tableRef.current!.setMatrixAt(i, m));
      tableRef.current.instanceMatrix.needsUpdate = true;
    }
    if (brainRef.current && brainRef.current.count === brainData.count) {
      brainData.mats.forEach((m, i) => brainRef.current!.setMatrixAt(i, m));
      brainRef.current.instanceMatrix.needsUpdate = true;
    }
    if (spongeRef.current && spongeRef.current.count === spongeData.count) {
      spongeData.mats.forEach((m, i) => spongeRef.current!.setMatrixAt(i, m));
      spongeRef.current.instanceMatrix.needsUpdate = true;
    }
    if (fanRef.current && fanRef.current.count === fanData.count) {
      fanData.mats.forEach((m, i) => fanRef.current!.setMatrixAt(i, m));
      fanRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Sandy carbonate reef base with caustic highlights */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120, 32, 32]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.9} />
      </mesh>

      {/* 1. Branching Acropora Corals */}
      <instancedMesh
        ref={branchingRef}
        args={[branchingGeo, undefined, branchingData.count]}
      >
        <bufferAttribute attach="geometry-attributes-aColor" args={[branchingData.colors, 3]} />
        <shaderMaterial
          vertexShader={CORAL_SHADER.vertexShader}
          fragmentShader={CORAL_SHADER.fragmentShader}
          uniforms={uniforms}
        />
      </instancedMesh>

      {/* 2. Table / Plate Corals */}
      <instancedMesh
        ref={tableRef}
        args={[undefined, undefined, tableData.count]}
      >
        <cylinderGeometry args={[1.2, 0.4, 0.25, 12]} />
        <bufferAttribute attach="geometry-attributes-aColor" args={[tableData.colors, 3]} />
        <shaderMaterial
          vertexShader={CORAL_SHADER.vertexShader}
          fragmentShader={CORAL_SHADER.fragmentShader}
          uniforms={uniforms}
        />
      </instancedMesh>

      {/* 3. Brain / Boulder Corals */}
      <instancedMesh
        ref={brainRef}
        args={[undefined, undefined, brainData.count]}
      >
        <dodecahedronGeometry args={[1.0, 2]} />
        <bufferAttribute attach="geometry-attributes-aColor" args={[brainData.colors, 3]} />
        <shaderMaterial
          vertexShader={CORAL_SHADER.vertexShader}
          fragmentShader={CORAL_SHADER.fragmentShader}
          uniforms={uniforms}
        />
      </instancedMesh>

      {/* 4. Giant Barrel Sponges */}
      <instancedMesh
        ref={spongeRef}
        args={[undefined, undefined, spongeData.count]}
      >
        <cylinderGeometry args={[0.55, 0.4, 1.0, 10, 1, true]} />
        <bufferAttribute attach="geometry-attributes-aColor" args={[spongeData.colors, 3]} />
        <shaderMaterial
          vertexShader={CORAL_SHADER.vertexShader}
          fragmentShader={CORAL_SHADER.fragmentShader}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* 5. Gorgonian Sea Fans */}
      <instancedMesh
        ref={fanRef}
        args={[undefined, undefined, fanData.count]}
      >
        <planeGeometry args={[1.0, 1.2, 2, 4]} />
        <bufferAttribute attach="geometry-attributes-aColor" args={[fanData.colors, 3]} />
        <shaderMaterial
          vertexShader={CORAL_SHADER.vertexShader}
          fragmentShader={CORAL_SHADER.fragmentShader}
          uniforms={uniforms}
          side={THREE.DoubleSide}
          transparent
        />
      </instancedMesh>
    </group>
  );
};
