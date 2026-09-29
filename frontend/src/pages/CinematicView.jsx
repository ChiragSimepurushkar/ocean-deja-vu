import React, { useState, useEffect, useRef } from 'react';
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
  section: { eye: {x: 0, y: -2.5, z: 0.1}, up: {x: 0, y: 0, z: 1} },
  front: { eye: {x: 0, y: -2.5, z: 0.2}, up: {x: 0, y: 0, z: 1} },
  back: { eye: {x: 0, y: 2.5, z: 0.2}, up: {x: 0, y: 0, z: 1} },
  left: { eye: {x: -2.5, y: 0, z: 0.2}, up: {x: 0, y: 0, z: 1} },
  right: { eye: {x: 2.5, y: 0, z: 0.2}, up: {x: 0, y: 0, z: 1} }
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
  // Visibilities and opacities just for the 6 temp layers now
  const [visibilities, setVisibilities] = useState([true, false, false, false, false, false]);
  const [currentOpacities, setCurrentOpacities] = useState([1, 0, 0, 0, 0, 0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusText, setStatusText] = useState("Ready for Cinematic Presentation");
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const speedRef = useRef(1);
  const [camRevision, setCamRevision] = useState(0);

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
    setCamRevision(r => r + 1);
    await sleep(duration / speedRef.current);
  };

  const forceCamera = (cam) => {
    setIsPlaying(false);
    setCamera(cam);
    setCamRevision(r => r + 1); // Force plotly to update even if manually rotated
  };

  const cinemaMode = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    setProgress(0);
    
    // Step 1: top-down
    setStatusText("Step 1: Top-down overview of all models");
    setVisibilities([true, false, false, false, false, false]);
    setCurrentOpacities([1, 0, 0, 0, 0, 0]);
    await animateCam(CAM.topDown, 100);
    setProgress(15);
    await sleep(2500 / speedRef.current);

    // Step 2: reveal layers one by one
    setStatusText("Step 2: Revealing deep temperature layers");
    animateCam(CAM.perspective, 500); 
    for (let i = 1; i < 6; i++) {
      setVisibilities(v => { const nv = [...v]; nv[i] = true; return nv; });
      setCurrentOpacities(o => { const no = [...o]; no[i] = OPACITIES[i]; return no; });
      await sleep(500 / speedRef.current);
    }
    setProgress(35);
    await sleep(1000 / speedRef.current);

    // Step 3: slow orbit
    setStatusText("Step 3: Orbiting 3D volume models");
    const orbit = generateOrbitFrames(12);
    for (const cam of orbit) {
      await animateCam(cam, 250);
    }
    setProgress(65);
    await sleep(1000 / speedRef.current);

    // Step 4: cross-section
    setStatusText("Step 4: Swooping to cross-section view");
    await animateCam(CAM.section, 1500);
    await sleep(3000 / speedRef.current);
    setProgress(100);

    // Reset to initial state for free interaction
    setStatusText("Cinematic Mode Complete. Free interaction enabled.");
    setVisibilities([true, true, true, true, true, true]);
    setCurrentOpacities([1, 0.7, 0.6, 0.5, 0.4, 0.3]);
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

  const tempTraces = DEPTHS.map((depth, index) => {
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
      showscale: false,
      visible: visibilities[index],
      opacity: currentOpacities[index],
      hoverinfo: 'x+y+z+text',
      text: layer.data.map(row => row.map(val => val !== null && val !== undefined ? `Temp: ${Number(val).toFixed(2)}°C<br>Depth: ${depth}m` : 'N/A')),
      name: `${depth}m Depth`
    };
  }).filter(Boolean);

  // Fake Isosurface for 20C
  let isoX = [], isoY = [], isoZ = [], isoVal = [];
  layersData.forEach((layer, i) => {
    if(!layer) return;
    layer.data.forEach((row, yIdx) => {
      row.forEach((val, xIdx) => {
        if (val !== null && val !== undefined && Math.abs(val - 20) < 0.5) { 
          isoX.push(layer.lon[xIdx]);
          isoY.push(layer.lat[yIdx]);
          isoZ.push(-DEPTHS[i] / 200);
          isoVal.push(val);
        }
      });
    });
  });

  const isoTrace = {
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
    visible: true,
    name: '20°C Isotherm'
  };

  let salTrace = null;
  // Salinity 0m surface (Fake data based on 0m temp)
  if (layersData[0]) {
    const layer = layersData[0];
    const salinityData = layer.data.map(row => row.map(val => val !== null && val !== undefined ? 32 + (val / 32) * 5 : null)); // Maps roughly to 32-37 PSU
    salTrace = {
      type: 'surface',
      x: layer.lon,
      y: layer.lat,
      z: layer.data.map(row => row.map(() => 0)),
      surfacecolor: salinityData,
      colorscale: 'Viridis',
      cmin: 32,
      cmax: 37,
      showscale: false,
      visible: true,
      opacity: 1,
      hoverinfo: 'x+y+text',
      text: salinityData.map(row => row.map(val => val !== null ? `Salinity: ${Number(val).toFixed(2)} PSU` : 'N/A')),
      name: 'Surface Salinity'
    };
  }

  let curTrace = null;
  // Currents 0m surface (Fake data based on 0m temp)
  if (layersData[0]) {
    const layer = layersData[0];
    const currentsData = layer.data.map(row => row.map(val => val !== null && val !== undefined ? (val / 32) * 2 : null)); // Maps roughly to 0-2 m/s
    curTrace = {
      type: 'surface',
      x: layer.lon,
      y: layer.lat,
      z: layer.data.map(row => row.map(() => 0)),
      surfacecolor: currentsData,
      colorscale: 'Plasma',
      cmin: 0,
      cmax: 2,
      showscale: false,
      visible: true,
      opacity: 1,
      hoverinfo: 'x+y+text',
      text: currentsData.map(row => row.map(val => val !== null ? `Currents: ${Number(val).toFixed(2)} m/s` : 'N/A')),
      name: 'Surface Currents'
    };
  }

  let bboxTrace = null;
  // Bounding Box (Surroundings)
  if (layersData[0]) {
    const minLon = layersData[0].lon[0];
    const maxLon = layersData[0].lon[layersData[0].lon.length - 1];
    const minLat = layersData[0].lat[0];
    const maxLat = layersData[0].lat[layersData[0].lat.length - 1];
    const zMin = -1000 / 200; // -5
    const zMax = 0;

    const boxX = [
      minLon, maxLon, maxLon, minLon, minLon, null, 
      minLon, maxLon, maxLon, minLon, minLon, null,
      minLon, minLon, null, maxLon, maxLon, null,
      maxLon, maxLon, null, minLon, minLon
    ];
    const boxY = [
      minLat, minLat, maxLat, maxLat, minLat, null,
      minLat, minLat, maxLat, maxLat, minLat, null,
      minLat, minLat, null, minLat, minLat, null,
      maxLat, maxLat, null, maxLat, maxLat
    ];
    const boxZ = [
      zMax, zMax, zMax, zMax, zMax, null,
      zMin, zMin, zMin, zMin, zMin, null,
      zMax, zMin, null, zMax, zMin, null,
      zMax, zMin, null, zMax, zMin
    ];

    bboxTrace = {
      type: 'scatter3d',
      mode: 'lines',
      x: boxX,
      y: boxY,
      z: boxZ,
      line: { color: '#00aaff', width: 2 },
      opacity: 0.3,
      visible: true,
      name: 'Domain Boundaries',
      hoverinfo: 'none'
    };
  }

  // Surrounding Context (Extended Chunk Data)
  let surroundingTrace = null;
  if (layersData[0]) {
    const minLon = layersData[0].lon[0] - 10;
    const maxLon = layersData[0].lon[layersData[0].lon.length - 1] + 10;
    const minLat = layersData[0].lat[0] - 10;
    const maxLat = layersData[0].lat[layersData[0].lat.length - 1] + 10;
    const zMin = -1000 / 200;
    
    // Create an extended sea floor plane slightly larger than the domain
    surroundingTrace = {
      type: 'mesh3d',
      x: [minLon, maxLon, maxLon, minLon],
      y: [minLat, minLat, maxLat, maxLat],
      z: [zMin-0.1, zMin-0.1, zMin-0.1, zMin-0.1],
      i: [0, 0],
      j: [1, 2],
      k: [2, 3],
      color: '#e2e8f0',
      opacity: 0.15,
      name: 'Extended Context',
      hoverinfo: 'none'
    };
  }

  const baseData = [bboxTrace, surroundingTrace].filter(Boolean);

  const commonLayout = {
    autosize: true,
    margin: { l: 0, r: 0, b: 0, t: 25 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    scene: {
      xaxis: { title: 'Longitude', color: '#64748b', gridcolor: '#e2e8f0', showbackground: false },
      yaxis: { title: 'Latitude', color: '#64748b', gridcolor: '#e2e8f0', showbackground: false },
      zaxis: { title: 'Depth', color: '#64748b', gridcolor: '#e2e8f0', showbackground: false },
      camera: camera
    },
    showlegend: false
  };

  return (
    <div style={{ 
      ...(isFullScreen ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999 } : { width: '100%', height: 'calc(100vh - 120px)', position: 'relative', borderRadius: '16px', border: '1px solid #E2E8F0' }),
      background: 'white',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#0f172a' }}>Oceanographic Simulation</h1>
          <p style={{ color: '#64748b', fontSize: '1.1rem', margin: '5px 0 20px 0' }}>{statusText}</p>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={cinemaMode} 
              disabled={isPlaying}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: isPlaying ? '#E2E8F0' : '#eab308', color: isPlaying ? '#94a3b8' : 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: isPlaying ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(234, 179, 8, 0.3)' }}
            >
              <Play size={18} fill="currentColor" />
              {isPlaying ? 'Presenting...' : 'Cinematic Sequence'}
            </button>
            
            <button
              onClick={() => {
                const newSpeed = playbackSpeed === 1 ? 2 : 1;
                setPlaybackSpeed(newSpeed);
                speedRef.current = newSpeed;
              }}
              style={{ padding: '10px 16px', background: 'white', color: '#0f172a', border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Speed: {playbackSpeed}x
            </button>

            {/* Camera Controls */}
            <div style={{ display: 'flex', gap: '5px', marginLeft: '15px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              {[
                { label: 'Top', cam: CAM.topDown },
                { label: 'Front', cam: CAM.front },
                { label: 'Back', cam: CAM.back },
                { label: 'Left', cam: CAM.left },
                { label: 'Right', cam: CAM.right },
                { label: 'Angled', cam: CAM.perspective }
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={() => forceCamera(btn.cam)}
                  style={{ padding: '6px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
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
      </div>

      {/* Progress Timeline */}
      {isPlaying && (
        <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', width: '60%', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#eab308', transition: 'width 0.5s linear' }}></div>
          </div>
          <div style={{ color: '#0f172a', fontWeight: 'bold', background: 'rgba(255,255,255,0.9)', padding: '4px 12px', borderRadius: '20px', backdropFilter: 'blur(4px)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            Cinematic Progress: {progress}%
          </div>
        </div>
      )}

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '15px',
        padding: '0 20px 20px 20px',
        boxSizing: 'border-box'
      }}>
        {/* Panel 1: Temperature Stack */}
        <div style={{ position: 'relative', background: '#f8fafc', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>Temperature Volume</div>
          <Plot
            data={[...tempTraces, ...baseData]}
            layout={commonLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
            revision={camRevision + visibilities.join('')} 
          />
        </div>

        {/* Panel 2: 20C Isotherm */}
        <div style={{ position: 'relative', background: '#f8fafc', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>20°C Isotherm</div>
          <Plot
            data={[isoTrace, ...baseData].filter(Boolean)}
            layout={commonLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
            revision={camRevision} 
          />
        </div>

        {/* Panel 3: Salinity */}
        <div style={{ position: 'relative', background: '#f8fafc', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>Surface Salinity (PSU)</div>
          <Plot
            data={[salTrace, ...baseData].filter(Boolean)}
            layout={commonLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
            revision={camRevision} 
          />
        </div>

        {/* Panel 4: Currents */}
        <div style={{ position: 'relative', background: '#f8fafc', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>Surface Currents (m/s)</div>
          <Plot
            data={[curTrace, ...baseData].filter(Boolean)}
            layout={commonLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
            revision={camRevision} 
          />
        </div>
      </div>
    </div>
  );
}
