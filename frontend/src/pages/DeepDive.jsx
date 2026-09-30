import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, MeshDistortMaterial, useGLTF, Html } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import './DeepDive.css';

useGLTF.preload('/fish.glb');

function useUnderwaterSound() {
  useEffect(() => {
    let audioCtx;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(60, audioCtx.currentTime); 
      
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.1, audioCtx.currentTime);
      lfoGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      lfo.start();
      
      return () => {
        osc.stop();
        lfo.stop();
        audioCtx.close();
      };
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }, []);
}

function RealFish({ color, proportions, speed, radius, yOffset, startAngle, scale = 1, offsets, analysisMode, onSelect, selected }) {
  const group = useRef();
  const currentPos = useRef(new THREE.Vector3());
  const targetPos = useRef(new THREE.Vector3());
  const { scene } = useGLTF('/fish.glb');
  
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((node) => {
      if (node.isMesh) {
        node.material = node.material.clone();
        node.material.color.set(color); 
        if (selected) {
          node.material.emissive = new THREE.Color('#00ff00');
          node.material.emissiveIntensity = 0.5;
        }
      }
    });
    return clone;
  }, [scene, color, selected]);
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + startAngle;
    const x = Math.sin(t * 0.5 + offsets[0]) * radius + Math.sin(t * 1.2) * 5;
    const z = Math.cos(t * 0.4 + offsets[1]) * radius + Math.cos(t * 1.5) * 5;
    const y = yOffset + Math.sin(t * 0.8 + offsets[2]) * 3;
    
    targetPos.current.set(x, y, z);
    currentPos.current.lerp(targetPos.current, 0.05);
    group.current.position.copy(currentPos.current);
    
    const dir = targetPos.current.clone().sub(currentPos.current).normalize();
    if (dir.lengthSq() > 0.001) {
      const targetRotation = Math.atan2(dir.x, dir.z);
      const diff = targetRotation - group.current.rotation.y;
      const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
      group.current.rotation.y += normalizedDiff * 0.1;
    }
    
    group.current.rotation.z = Math.sin(t * 25) * 0.15;
    group.current.rotation.x = Math.sin(t * 10) * 0.05;
  });

  return (
    <group ref={group} scale={[scale * 10 * proportions.x, scale * 10 * proportions.y, scale * 10 * proportions.z]}>
      <primitive 
        object={clonedScene} 
        onClick={(e) => {
          if (analysisMode) {
            e.stopPropagation();
            onSelect();
          }
        }}
        onPointerOver={() => {
          if (analysisMode) document.body.style.cursor = 'crosshair';
        }}
        onPointerOut={() => {
          if (analysisMode) document.body.style.cursor = 'default';
        }}
      />
      {selected && analysisMode && (
        <Html position={[0, 1.5, 0]} center>
          <div style={{ background: 'rgba(0,30,60,0.8)', border: '1px solid #00ff00', padding: '10px', borderRadius: '5px', color: '#00ff00', fontFamily: 'monospace', whiteSpace: 'nowrap', pointerEvents: 'none', backdropFilter: 'blur(4px)' }}>
            <strong>TARGET ACQUIRED</strong><br/>
            Length: {(scale * 100).toFixed(1)} cm<br/>
            Est. Mass: {(scale * scale * 15).toFixed(1)} kg<br/>
            Speed: {(speed * 10).toFixed(1)} knots
          </div>
        </Html>
      )}
    </group>
  );
}

function Octopus({ position, color, scale, analysisMode, onSelect, selected }) {
  const group = useRef();
  const tentacles = useRef([]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    group.current.position.y = position[1] + Math.sin(t * 1.5) * 0.5;
    tentacles.current.forEach((tentacle, i) => {
      if (tentacle) {
        tentacle.rotation.z = Math.sin(t * 2 + i) * 0.5;
        tentacle.rotation.x = Math.cos(t * 2 + i) * 0.5;
      }
    });
  });

  return (
    <group ref={group} position={position} scale={scale} 
      onClick={(e) => {
        if (analysisMode) {
          e.stopPropagation();
          onSelect();
        }
      }}
    >
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color={selected && analysisMode ? '#00ff00' : color} roughness={0.6} />
      </mesh>
      {[...Array(8)].map((_, i) => (
        <group key={i} position={[Math.cos((i * Math.PI) / 4) * 0.5, 0.2, Math.sin((i * Math.PI) / 4) * 0.5]}>
          <group ref={(el) => (tentacles.current[i] = el)}>
            <mesh position={[0, -1, 0]}>
              <cylinderGeometry args={[0.2, 0.05, 2]} />
              <meshStandardMaterial color={selected && analysisMode ? '#00ff00' : color} roughness={0.6} />
            </mesh>
          </group>
        </group>
      ))}
      {selected && analysisMode && (
        <Html position={[0, 2.5, 0]} center>
          <div style={{ background: 'rgba(0,30,60,0.8)', border: '1px solid #00ff00', padding: '10px', borderRadius: '5px', color: '#00ff00', fontFamily: 'monospace', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            <strong>CEPHALOPOD DETECTED</strong><br/>
            Tentacle Span: {(scale * 2).toFixed(1)} m<br/>
            Behavior: Foraging
          </div>
        </Html>
      )}
    </group>
  );
}

function Corals() {
  const corals = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() - 0.5) * 400;
      const z = (Math.random() - 0.5) * 400;
      arr.push({
        position: [x, -15, z],
        scale: Math.random() * 2 + 0.5,
        color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5)
      });
    }
    return arr;
  }, []);

  return (
    <>
      {corals.map((c, i) => (
        <group key={i} position={c.position} scale={c.scale}>
          <mesh position={[0, 0.5, 0]}>
            <dodecahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={c.color} roughness={0.9} />
          </mesh>
          <mesh position={[0.5, 1, 0.5]} scale={0.5}>
            <dodecahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={c.color} roughness={0.9} />
          </mesh>
          <mesh position={[-0.5, 0.8, -0.5]} scale={0.6}>
            <dodecahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={c.color} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Seagrass() {
  const meshRef = useRef();
  const count = 1000;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const grasses = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
      x: (Math.random() - 0.5) * 400,
      z: (Math.random() - 0.5) * 400,
      scale: Math.random() * 2 + 1,
      offset: Math.random() * 10
    }));
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    grasses.forEach((grass, i) => {
      dummy.position.set(grass.x, -15 + grass.scale * 1.5, grass.z);
      dummy.scale.set(0.2, grass.scale, 0.2);
      dummy.rotation.z = Math.sin(t * 1.5 + grass.offset) * 0.2;
      dummy.rotation.x = Math.cos(t * 1.2 + grass.offset) * 0.2;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <cylinderGeometry args={[1, 1, 3]} />
      <meshStandardMaterial color="#228b22" roughness={0.8} />
    </instancedMesh>
  );
}

function Seabed() {
  return (
    <mesh position={[0, -15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#0b2447" roughness={1} />
    </mesh>
  );
}

function WaterSurface() {
  return (
    <mesh position={[0, 20, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1000, 1000, 64, 64]} />
      <MeshDistortMaterial color="#1ea3d8" distort={0.2} speed={1.0} roughness={0.1} metalness={0.8} transparent opacity={0.6} />
    </mesh>
  );
}

function AquaticLife({ analysisMode, selectedId, onSelect }) {
  const fishes = useMemo(() => {
    const items = [];
    const colorPalettes = ['#ffffff', '#ffaa55', '#55aaff', '#ff5555', '#55ffaa', '#aaaaaa'];
    for (let i = 0; i < 60; i++) { 
      const scaleBase = Math.random() > 0.8 ? (Math.random() * 1.5 + 1) : (Math.random() * 0.4 + 0.1);
      items.push({
        id: 'f'+i,
        color: colorPalettes[Math.floor(Math.random() * colorPalettes.length)],
        proportions: { x: 0.5 + Math.random() * 1.0, y: 0.5 + Math.random() * 1.0, z: 0.5 + Math.random() * 1.0 },
        speed: Math.random() * 0.3 + 0.1,
        radius: Math.random() * 150 + 10,
        yOffset: (Math.random() - 0.5) * 30, 
        startAngle: Math.random() * Math.PI * 2,
        scale: scaleBase,
        offsets: [Math.random() * 10, Math.random() * 10, Math.random() * 10]
      });
    }
    return items;
  }, []);

  const octopuses = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({
      id: 'o'+i,
      position: [(Math.random() - 0.5) * 200, -13, (Math.random() - 0.5) * 200],
      color: new THREE.Color().setHSL(Math.random(), 0.6, 0.4),
      scale: Math.random() * 2 + 1
    }));
  }, []);

  return (
    <>
      {fishes.map(f => (
        <RealFish key={f.id} {...f} analysisMode={analysisMode} selected={selectedId === f.id} onSelect={() => onSelect(f.id)} />
      ))}
      {octopuses.map(o => (
        <Octopus key={o.id} {...o} analysisMode={analysisMode} selected={selectedId === o.id} onSelect={() => onSelect(o.id)} />
      ))}
    </>
  );
}

function CameraController({ movement }) {
  useFrame(({ camera }) => {
    const speed = 0.5; 
    if (movement.forward) camera.translateZ(-speed);
    if (movement.backward) camera.translateZ(speed);
    if (movement.left) camera.translateX(-speed);
    if (movement.right) camera.translateX(speed);
    if (movement.up) camera.translateY(speed);
    if (movement.down) camera.translateY(-speed);
    
    if (camera.position.y > 18) camera.position.y = 18;
    if (camera.position.y < -13) camera.position.y = -13;
  });
  return null;
}

export default function DeepDive({ lat, lon }) {
  const navigate = useNavigate();
  useUnderwaterSound(); 
  const [movement, setMovement] = useState({ forward: false, backward: false, left: false, right: false, up: false, down: false });
  const [analysisMode, setAnalysisMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const handleControl = (dir, isDown) => {
    setMovement(prev => ({ ...prev, [dir]: isDown }));
  };

  return (
    <div className="deep-dive-container">
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', gap: '10px' }}>
        <button onClick={() => {
          setAnalysisMode(!analysisMode);
          setSelectedId(null);
        }} style={{ padding: '10px 20px', borderRadius: '8px', background: analysisMode ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255,255,255,0.2)', border: analysisMode ? '1px solid #00ff00' : '1px solid white', color: analysisMode ? '#00ff00' : 'white', cursor: 'pointer', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>
          {analysisMode ? '🔭 Exit Analysis Mode' : '📊 Enter Analysis Mode'}
        </button>
        <button className="close-btn" onClick={() => navigate('/')} style={{ position: 'relative', top: 0, right: 0 }}>Back to Map</button>
      </div>
      
      <div className="dd-overlay" style={{ position: 'absolute', top: 0, left: 0, padding: '2rem', zIndex: 1, pointerEvents: 'none' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>Ocean Deja Vu Virtual Dive</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1rem', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>
          Exploring infinite ecosystem at {lat.toFixed(2)}°N, {lon.toFixed(2)}°E
        </p>
      </div>

      {analysisMode && (() => {
        // Generate deterministic, unique data based on exact lat/lon coordinates
        const pseudoRandom = (seed) => {
          const x = Math.sin(lat * 12.9898 + lon * 78.233 + seed) * 43758.5453;
          return x - Math.floor(x);
        };
        
        const temp = (28 - (Math.abs(lat) / 3) + (pseudoRandom(1) * 6 - 3)).toFixed(1);
        const salinity = (33.5 + pseudoRandom(2) * 3).toFixed(2);
        const ph = (7.8 + pseudoRandom(3) * 0.5).toFixed(2);
        const pressure = (1.5 + pseudoRandom(4) * 4).toFixed(1);
        
        const pelagicLevel = pseudoRandom(5);
        const benthicLevel = pseudoRandom(6);
        
        return (
          <div style={{ position: 'absolute', top: '150px', left: '2rem', width: '300px', background: 'rgba(0, 20, 40, 0.7)', border: '1px solid #00aaff', borderRadius: '12px', padding: '1.5rem', color: '#00aaff', zIndex: 10, backdropFilter: 'blur(10px)', fontFamily: 'monospace' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#00ffaa', borderBottom: '1px solid #00aaff', paddingBottom: '0.5rem' }}>ENVIRONMENT TELEMETRY</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Temp:</span> <span style={{ color: 'white' }}>{temp}°C</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Salinity:</span> <span style={{ color: 'white' }}>{salinity} PSU</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>pH Level:</span> <span style={{ color: 'white' }}>{ph}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Pressure:</span> <span style={{ color: 'white' }}>{pressure} atm</span></div>
            
            <h4 style={{ margin: '1.5rem 0 0.5rem 0', color: '#00ffaa' }}>BIOMASS SCANNER</h4>
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span>Pelagic Fish</span> 
                <span>{pelagicLevel > 0.7 ? 'High' : pelagicLevel > 0.4 ? 'Moderate' : 'Low'}</span>
              </div>
              <div style={{ height: '6px', background: '#003366', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' }}>
                <div style={{ width: `${pelagicLevel * 100}%`, height: '100%', background: pelagicLevel > 0.7 ? '#00ffaa' : pelagicLevel > 0.4 ? '#ffaa00' : '#ff4444' }}></div>
              </div>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span>Benthic Fauna</span> 
                <span>{benthicLevel > 0.7 ? 'High' : benthicLevel > 0.4 ? 'Moderate' : 'Low'}</span>
              </div>
              <div style={{ height: '6px', background: '#003366', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' }}>
                <div style={{ width: `${benthicLevel * 100}%`, height: '100%', background: benthicLevel > 0.7 ? '#00ffaa' : benthicLevel > 0.4 ? '#ffaa00' : '#ff4444' }}></div>
              </div>
            </div>
            <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#aaaaaa' }}>* Click on any organism in the water to run a biological scan.</p>
          </div>
        );
      })()}

      <div style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            style={{ padding: '15px 25px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', border: '1px solid white', color: 'white', cursor: 'pointer', fontSize: '1.2rem', backdropFilter: 'blur(5px)' }}
            onPointerDown={() => handleControl('forward', true)}
            onPointerUp={() => handleControl('forward', false)}
            onPointerLeave={() => handleControl('forward', false)}
          >⬆️ Forward</button>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            style={{ padding: '15px 25px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', border: '1px solid white', color: 'white', cursor: 'pointer', fontSize: '1.2rem', backdropFilter: 'blur(5px)' }}
            onPointerDown={() => handleControl('left', true)}
            onPointerUp={() => handleControl('left', false)}
            onPointerLeave={() => handleControl('left', false)}
          >⬅️ Left</button>
          <button 
            style={{ padding: '15px 25px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', border: '1px solid white', color: 'white', cursor: 'pointer', fontSize: '1.2rem', backdropFilter: 'blur(5px)' }}
            onPointerDown={() => handleControl('backward', true)}
            onPointerUp={() => handleControl('backward', false)}
            onPointerLeave={() => handleControl('backward', false)}
          >⬇️ Backward</button>
          <button 
            style={{ padding: '15px 25px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', border: '1px solid white', color: 'white', cursor: 'pointer', fontSize: '1.2rem', backdropFilter: 'blur(5px)' }}
            onPointerDown={() => handleControl('right', true)}
            onPointerUp={() => handleControl('right', false)}
            onPointerLeave={() => handleControl('right', false)}
          >➡️ Right</button>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            style={{ padding: '10px 20px', borderRadius: '8px', background: 'rgba(96,165,250,0.3)', border: '1px solid #60A5FA', color: 'white', cursor: 'pointer', fontSize: '1rem', backdropFilter: 'blur(5px)' }}
            onPointerDown={() => handleControl('up', true)}
            onPointerUp={() => handleControl('up', false)}
            onPointerLeave={() => handleControl('up', false)}
          >🔼 Swim Up</button>
          <button 
            style={{ padding: '10px 20px', borderRadius: '8px', background: 'rgba(96,165,250,0.3)', border: '1px solid #60A5FA', color: 'white', cursor: 'pointer', fontSize: '1rem', backdropFilter: 'blur(5px)' }}
            onPointerDown={() => handleControl('down', true)}
            onPointerUp={() => handleControl('down', false)}
            onPointerLeave={() => handleControl('down', false)}
          >🔽 Swim Down</button>
        </div>
      </div>

      <Canvas camera={{ position: [0, 0, 15], fov: 60, far: 500 }} style={{ background: '#001a33' }}>
        <CameraController movement={movement} />
        
        <fog attach="fog" args={['#001a33', 10, 80]} />
        
        <ambientLight intensity={0.5} color="#4dc0ff" />
        <directionalLight position={[0, 20, 0]} intensity={3} color="#ffffff" castShadow />
        <pointLight position={[0, -10, 0]} intensity={1} color="#0044ff" />

        <Seabed />
        <Seagrass />
        <Corals />
        <WaterSurface />
        <Suspense fallback={null}>
          <AquaticLife analysisMode={analysisMode} selectedId={selectedId} onSelect={setSelectedId} />
        </Suspense>
        
        <Sparkles count={5000} scale={200} size={4} speed={0.4} opacity={0.5} color="#aaddff" />
        <Sparkles count={10000} scale={400} size={1} speed={0.1} opacity={0.2} color="#ffffff" />
      </Canvas>
    </div>
  );
}
