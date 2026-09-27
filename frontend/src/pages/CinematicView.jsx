import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { getField } from '../api';
import { useNavigate } from 'react-router-dom';
import { Play, Maximize2, Minimize2 } from 'lucide-react';
import './DeepDive.css';

const DEPTHS = [0, 50, 100, 200, 500, 1000];
const OPACITIES = [0.9, 0.7, 0.6, 0.5, 0.4, 0.3];

const CAM = {
  topDown: { eye: {x: 0, y: 0, z: 2.5}, up: {x: 0, y: 1, z: 0} },
  perspective: { eye: {x: 1.5, y: 1.5, z: 1.0}, up: {x: 0, y: 0, z: 1} },
  section: { eye: {x: 0, y: -2.5, z: 0.1}, up: {x: 0, y: 0, z: 1} }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function generateOrbitFrames(steps) {
  const frames = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const offsetAngle = angle + Math.PI / 4;
    frames.push({
      eye: { x: Math.cos(offsetAngle) * 2.1, y: Math.sin(offsetAngle) * 2.1, z: 1.0 },
      up: { x: 0, y: 0, z: 1 }
    });
  }
  return frames;
}

export default function CinematicView({ lat, lon, date }) {
  const navigate = useNavigate();
  const [layersData, setLayersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const [camera, setCamera] = useState(CAM.topDown);
  const [visibilities, setVisibilities] = useState([true, false, false, false, false, false, false]);
  const [currentOpacities, setCurrentOpacities] = useState([1, 0, 0, 0, 0, 0, 0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusText, setStatusText] = useState("Ready for Cinematic Presentation");

  useEffect(() => {
    async function loadLayers() {
      setLoading(true);
      const fetchedLayers = await Promise.all(
        DEPTHS.map(async d => {
          try {
             return await getField(date || '2023-01-01', d);
          } catch (e) {
             console.error(e);
             return null;
          }
        })
      );
      setLayersData(fetchedLayers);
      setLoading(false);
    }
    loadLayers();
  }, [date]);

  const animateCam = async (targetCam, duration) => {
    setCamera(targetCam);
    await sleep(duration);
  };

  const cinemaMode = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    
    // Step 1: top-down
    setStatusText("Step 1: Surface layer, top-down view");
    setVisibilities([true, false, false, false, false, false, false]);
    setCurrentOpacities([1, 0, 0, 0, 0, 0, 0]);
    await animateCam(CAM.topDown, 100);
    await sleep(2500);

    // Step 2: reveal layers one by one
    setStatusText("Step 2: Revealing deeper layers to 1000m");
    animateCam(CAM.perspective, 500); 
    for (let i = 1; i < 6; i++) {
      setVisibilities(v => { const nv = [...v]; nv[i] = true; return nv; });
      setCurrentOpacities(o => { const no = [...o]; no[i] = OPACITIES[i]; return no; });
      await sleep(500);
    }
    await sleep(1000);

    // Step 3: slow orbit
    setStatusText("Step 3: Orbiting 3D volume stack");
    const orbit = generateOrbitFrames(12);
    for (const cam of orbit) {
      await animateCam(cam, 250);
    }

    // Step 4: isosurface reveal (trace 6)
    setStatusText("Step 4: 20°C Isotherm Surface materializes");
    setVisibilities(v => { const nv = [...v]; nv[6] = true; return nv; });
    setCurrentOpacities(o => { const no = [...o]; no[6] = 1.0; return no; });
    await sleep(4000);

    // Step 5: cross-section
    setStatusText("Step 5: Swooping to cross-section view");
    await animateCam(CAM.section, 1500);
    
    setStatusText("Cinematic Mode Complete. Free interaction enabled.");
    setIsPlaying(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '600px', background: 'white', color: '#0f172a', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
        <h2 style={{ color: 'var(--primary)' }}>Initializing Deep Ocean Volume...</h2>
        <p>Fetching multi-depth telemetry data (0m - 1000m)</p>
      </div>
    );
  }

  const traces = DEPTHS.map((depth, index) => {
    const layer = layersData[index];
    if (!layer) return null;
    
    // Scale down depth so 1000m is -5 in Plotly units
    const zScaled = -depth / 200; 
    const zArray = layer.data.map(row => row.map(() => zScaled));
    
    return {
      type: 'surface',
      x: layer.lon,
      y: layer.lat,
      z: zArray,
      surfacecolor: layer.data,
      colorscale: 'Jet',
      cmin: 0,
      cmax: 32,
      showscale: index === 0,
      visible: visibilities[index],
      opacity: currentOpacities[index],
      hoverinfo: 'x+y+z+text',
      text: layer.data.map(row => row.map(val => `Temp: ${val.toFixed(2)}°C<br>Depth: ${depth}m`)),
      name: `${depth}m Depth`
    };
  }).filter(Boolean);

  // Fake Isosurface for 20C
  let isoX = [], isoY = [], isoZ = [], isoVal = [];
  layersData.forEach((layer, i) => {
    if(!layer) return;
    layer.data.forEach((row, yIdx) => {
      row.forEach((val, xIdx) => {
        if (Math.abs(val - 20) < 0.5) { 
          isoX.push(layer.lon[xIdx]);
          isoY.push(layer.lat[yIdx]);
          isoZ.push(-DEPTHS[i] / 200);
          isoVal.push(val);
        }
      });
    });
  });

  traces.push({
    type: 'scatter3d',
    mode: 'markers',
    x: isoX,
    y: isoY,
    z: isoZ,
    marker: {
      color: isoVal,
      colorscale: 'Jet',
      cmin: 0,
      cmax: 32,
      size: 4,
      opacity: 0.8,
      symbol: 'circle'
    },
    visible: visibilities[6],
    name: '20°C Isotherm'
  });

  return (
    <div style={{ 
      ...(isFullScreen ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999 } : { width: '100%', height: 'calc(100vh - 120px)', position: 'relative', borderRadius: '16px', border: '1px solid #E2E8F0' }),
      background: 'white',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, padding: '2rem', zIndex: 10 }}>
        <h1 style={{ margin: 0, fontSize: '2rem', color: '#0f172a' }}>Oceanographic Simulation</h1>
        <p style={{ color: '#64748b', fontSize: '1.1rem', margin: '5px 0 20px 0' }}>{statusText}</p>
        
        <button 
          onClick={cinemaMode} 
          disabled={isPlaying}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: isPlaying ? '#E2E8F0' : '#eab308', color: isPlaying ? '#94a3b8' : 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: isPlaying ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(234, 179, 8, 0.3)' }}
        >
          <Play size={20} fill="currentColor" />
          {isPlaying ? 'Presenting...' : 'Present Cinematic Mode'}
        </button>
      </div>

      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setIsFullScreen(!isFullScreen)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'white', border: '1px solid #E2E8F0', color: '#0f172a', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
        >
          {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          {isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
        <button 
          onClick={() => navigate('/')} 
          style={{ padding: '10px 20px', background: 'white', border: '1px solid #E2E8F0', color: '#0f172a', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
        >
          Close Viewer
        </button>
      </div>

      <Plot
        data={traces}
        layout={{
          autosize: true,
          margin: { l: 0, r: 0, b: 0, t: 0 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          scene: {
            xaxis: { title: 'Longitude', color: '#64748b', gridcolor: '#e2e8f0', showbackground: false },
            yaxis: { title: 'Latitude', color: '#64748b', gridcolor: '#e2e8f0', showbackground: false },
            zaxis: { title: 'Depth Scale', color: '#64748b', gridcolor: '#e2e8f0', showbackground: false },
            camera: camera
          },
          showlegend: false
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
        revision={camera.eye.x + visibilities.join('')} 
      />
    </div>
  );
}
