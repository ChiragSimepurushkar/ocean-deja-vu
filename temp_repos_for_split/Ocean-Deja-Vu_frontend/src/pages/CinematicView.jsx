import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { getField } from '../api';
import { useNavigate } from 'react-router-dom';
import { Maximize2, Minimize2, Search, Crosshair, ArrowUpRight, ArrowDownRight, Navigation2, Thermometer, Droplets, Wind, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play, Square, ChevronUp, ChevronDown, ArrowUpLeft, ArrowDownLeft, Info } from 'lucide-react';
import { gsap } from 'gsap';
import { Tooltip } from '../components/Tooltip';
import './DeepDive.css';

const DEPTHS = [0, 50, 100, 200, 500, 1000];
const TABS = ['Temperature', '20°C Isotherm', 'Salinity', 'Currents'];

const SCIENTIFIC_NOTES = [
  "Surface layer, pre-monsoon warming phase...",
  "Base of the actively mixed wind-driven layer. Strong mechanical turbulence.",
  "Thermal transition zone. Temperature drops steeply per meter.",
  "Permanent Thermocline Barrier. Oxygen Minimum Zone.",
  "Intense hydrostatic pressure. Temperature stabilizes near 8-9°C.",
  "Cold Antarctic Intermediate Water influence. Midnight Abyss."
];

const Sparkline = ({ data, color }) => {
  if (!data || data.length < 2) return <div style={{width: '60px', height: '20px', background: 'var(--bg-input)', borderRadius: '4px'}} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 60},${20 - ((d - min) / range) * 20}`).join(' ');
  return (
    <svg width="60" height="20" style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy={20 - ((data[data.length-1] - min) / range) * 20} r="2.5" fill={color} />
    </svg>
  );
};

export default function CinematicView({ date, lat, lon }) {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const initialLat = parseFloat(searchParams.get('lat') || lat || 15);
  const initialLon = parseFloat(searchParams.get('lon') || lon || 65);
  const selectedDate = searchParams.get('date') || date || '2023-01-01';

  const [loading, setLoading] = useState(true);
  const [layersData, setLayersData] = useState([]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const [activeTab, setActiveTab] = useState('Temperature');
  const [probeLat, setProbeLat] = useState(initialLat);
  const [probeLon, setProbeLon] = useState(initialLon);
  const [probeDepthIdx, setProbeDepthIdx] = useState(0);
  
  const [command, setCommand] = useState('');
  const [probeHistory, setProbeHistory] = useState([]);
  
  const [stepSize, setStepSize] = useState(1);
  const [cameraObj, setCameraObj] = useState({ eye: {x: 1.5, y: -1.5, z: 0.8}, up: {x: 0, y: 0, z: 1} });
  const [camRev, setCamRev] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sequenceProgress, setSequenceProgress] = useState(0);
  const [caption, setCaption] = useState("");
  const timelineRef = useRef(null);
  
  useEffect(() => {
    setLoading(true);
    Promise.all(DEPTHS.map(d => getField(selectedDate, d.toString())))
      .then(responses => {
        const mappedLayers = responses.map(res => ({
          lat: res.lat,
          lon: res.lon,
          data: res.data
        }));
        setLayersData(mappedLayers);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedDate]);

  const getProbeValue = (lat, lon, depthIdx) => {
    if (!layersData[depthIdx]) return null;
    const lats = layersData[depthIdx].lat;
    const lons = layersData[depthIdx].lon;
    let closestLatIdx = 0; let minLatDiff = 999;
    lats.forEach((l, i) => { if(Math.abs(l - lat) < minLatDiff) { minLatDiff = Math.abs(l-lat); closestLatIdx = i; } });
    let closestLonIdx = 0; let minLonDiff = 999;
    lons.forEach((l, i) => { if(Math.abs(l - lon) < minLonDiff) { minLonDiff = Math.abs(l-lon); closestLonIdx = i; } });
    return layersData[depthIdx].data[closestLatIdx][closestLonIdx];
  };

  useEffect(() => {
    if (!loading && layersData.length > 0) {
      const temp = getProbeValue(probeLat, probeLon, probeDepthIdx) || 0;
      const sal = 32 + (temp / 32) * 5;
      const cur = (temp / 32) * 2;
      const iso = temp > 20 ? -DEPTHS[probeDepthIdx] : -200; 
      
      setProbeHistory(prev => {
        const newHist = [...prev, { lat: probeLat, lon: probeLon, depth: DEPTHS[probeDepthIdx], temp, sal, cur, iso }];
        if (newHist.length > 8) return newHist.slice(newHist.length - 8);
        return newHist;
      });
    }
  }, [probeLat, probeLon, probeDepthIdx, loading, layersData]);

  const handleMove = (dx, dy, dDepth) => {
    let newLon = probeLon + dx * 0.25 * stepSize;
    let newLat = probeLat + dy * 0.25 * stepSize;
    let newDepthIdx = Math.max(0, Math.min(DEPTHS.length - 1, probeDepthIdx + dDepth));
    setProbeLon(newLon);
    setProbeLat(newLat);
    setProbeDepthIdx(newDepthIdx);
  };

  const toggleCinematic = () => {
    if (isPlaying) {
      if (timelineRef.current) timelineRef.current.kill();
      setIsPlaying(false);
      setSequenceProgress(0);
      setCaption("");
    } else {
      setIsPlaying(true);
      const tl = gsap.timeline({
        onUpdate: function() { setSequenceProgress(this.progress() * 100); },
        onComplete: () => { setIsPlaying(false); setCaption(""); }
      });
      timelineRef.current = tl;
      
      const presets = [
        { eye: {x: 0, y: 0, z: 2.5}, dIdx: 0 }, // Top
        { eye: {x: 0, y: -2.5, z: 0.5}, dIdx: 1 }, // Front
        { eye: {x: 2.5, y: 0, z: 0.5}, dIdx: 2 }, // Side
        { eye: {x: 1.5, y: -1.5, z: 0.8}, dIdx: 3 }, // Angled
        { eye: {x: -1.5, y: -1.5, z: 1.2}, dIdx: 4 }, // Elevated
        { eye: {x: 1.5, y: 1.5, z: 0.3}, dIdx: 5 }, // Low angle
      ];
      
      let camState = { ...cameraObj.eye };
      
      presets.forEach((p, i) => {
        tl.to(camState, {
          x: p.eye.x, y: p.eye.y, z: p.eye.z,
          duration: 2,
          ease: "power2.inOut",
          onStart: () => setCaption(SCIENTIFIC_NOTES[p.dIdx]),
          onUpdate: () => {
             setCameraObj({ eye: { x: camState.x, y: camState.y, z: camState.z }, up: {x:0, y:0, z:1} });
             setCamRev(r => r + 1);
          }
        }, `+=${i === 0 ? 0 : 0.5}`);
      });
    }
  };

  const handleCommandSubmit = (e) => {
    if (e.key === 'Enter') {
      let newLat = probeLat;
      let newLon = probeLon;
      let newDepthIdx = probeDepthIdx;

      const regex = /(\d+)\s*(m|km|cells?)?\s*(left|right|north|south|east|west|up|down|deeper|shallower)/gi;
      let match;
      let matched = false;
      while ((match = regex.exec(command)) !== null) {
        matched = true;
        const num = parseInt(match[1]);
        const unit = (match[2] || '').toLowerCase();
        const dir = match[3].toLowerCase();

        let steps = 1;
        if (unit.includes('cell')) steps = num;
        else if (unit === 'km') steps = Math.max(1, Math.round(num / 25)); // ~25km per 0.25 deg

        if (['left', 'west'].includes(dir)) newLon -= 0.25 * steps;
        if (['right', 'east'].includes(dir)) newLon += 0.25 * steps;
        if (['north', 'up'].includes(dir) && !['m','km'].includes(unit)) newLat += 0.25 * steps;
        if (['south', 'down'].includes(dir) && !['m','km'].includes(unit)) newLat -= 0.25 * steps;

        if ((['deeper', 'down'].includes(dir) && ['m','km'].includes(unit)) || ['deeper'].includes(dir)) {
          let s = num && unit === 'm' ? Math.max(1, Math.round(num/100)) : steps;
          while (s > 0 && newDepthIdx < DEPTHS.length - 1) { newDepthIdx++; s--; }
        }
        if ((['shallower', 'up'].includes(dir) && ['m','km'].includes(unit)) || ['shallower'].includes(dir)) {
          let s = num && unit === 'm' ? Math.max(1, Math.round(num/100)) : steps;
          while (s > 0 && newDepthIdx > 0) { newDepthIdx--; s--; }
        }
      }
      
      if (matched) {
         setProbeLat(newLat);
         setProbeLon(newLon);
         setProbeDepthIdx(newDepthIdx);
         setCommand('');
      }
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '600px', background: 'var(--bg-panel)', color: 'var(--text-main)', borderRadius: '16px', border: '1px solid var(--border)' }}>
        <h2 style={{ color: 'var(--primary)' }}>Initializing Probe Telemetry...</h2>
        <p style={{ color: 'var(--text-muted)' }}>Fetching multi-depth volumetric data</p>
      </div>
    );
  }

  const windowSize = 8;
  const slicedLayersData = layersData.map(layer => {
    if (!layer) return null;
    const latIndices = layer.lat.map((l, i) => Math.abs(l - probeLat) <= windowSize ? i : -1).filter(i => i !== -1);
    const lonIndices = layer.lon.map((l, i) => Math.abs(l - probeLon) <= windowSize ? i : -1).filter(i => i !== -1);
    if (latIndices.length === 0 || lonIndices.length === 0) return null;
    return { 
      ...layer, 
      lat: latIndices.map(i => layer.lat[i]), 
      lon: lonIndices.map(i => layer.lon[i]), 
      data: latIndices.map(y => lonIndices.map(x => layer.data[y][x])) 
    };
  });

  const getHeroTraces = () => {
    const traces = [];
    
    traces.push({
      type: 'scatter3d',
      mode: 'markers',
      x: [probeLon], y: [probeLat], z: [-DEPTHS[probeDepthIdx] / 200],
      marker: { size: 10, color: '#f43f5e', symbol: 'cross', line: { color: 'white', width: 2 } },
      name: 'Probe Position'
    });

    if (activeTab === 'Temperature') {
      slicedLayersData.forEach((layer, index) => {
        if (!layer) return;
        traces.push({
          type: 'surface',
          x: layer.lon, y: layer.lat, z: layer.data.map(() => layer.lon.map(() => -DEPTHS[index] / 200)),
          surfacecolor: layer.data,
          colorscale: 'Jet',
          cmin: 0, cmax: 32,
          showscale: false,
          opacity: 0.9 - (index * 0.12),
          hoverinfo: 'none'
        });
      });
    } 
    else if (activeTab === '20°C Isotherm') {
      const isoZ = [];
      const isoColor = [];
      const layer0 = slicedLayersData[0];
      for(let y=0; y<layer0.lat.length; y++) {
        let rowZ = [], rowC = [];
        for(let x=0; x<layer0.lon.length; x++) {
           let bestDepth = -5;
           let minDiff = 999;
           slicedLayersData.forEach((layer, dIdx) => {
              if(!layer) return;
              let val = layer.data[y][x];
              if(val !== null && Math.abs(val - 20) < minDiff) {
                 minDiff = Math.abs(val - 20);
                 bestDepth = -DEPTHS[dIdx] / 200;
              }
           });
           rowZ.push(minDiff < 4 ? bestDepth : null);
           rowC.push(20);
        }
        isoZ.push(rowZ);
        isoColor.push(rowC);
      }
      traces.push({
        type: 'surface',
        x: layer0.lon, y: layer0.lat, z: isoZ,
        surfacecolor: isoColor,
        colorscale: 'Jet', cmin: 0, cmax: 32,
        showscale: false,
        opacity: 0.8
      });
    }
    else if (activeTab === 'Salinity') {
      const layer = slicedLayersData[0];
      traces.push({
        type: 'surface',
        x: layer.lon, y: layer.lat, z: layer.data.map(() => layer.lon.map(() => 0)),
        surfacecolor: layer.data.map(row => row.map(v => v ? 32 + (v/32)*5 : null)),
        colorscale: 'Viridis',
        contours: { z: { show: true, usecolormap: true, highlightcolor: "rgba(255,255,255,0.2)", project: {z: true} } },
        showscale: false
      });
    }
    else if (activeTab === 'Currents') {
      const layer = slicedLayersData[0];
      const curX=[], curY=[], curZ=[], u=[], v=[], w=[];
      layer.data.forEach((row, y) => {
        row.forEach((val, x) => {
           if (x%3===0 && y%3===0 && val) {
              curX.push(layer.lon[x]);
              curY.push(layer.lat[y]);
              curZ.push(0);
              u.push(Math.cos(val)* (val/32));
              v.push(Math.sin(val)* (val/32));
              w.push(0);
           }
        });
      });
      traces.push({
        type: 'cone',
        x: curX, y: curY, z: curZ,
        u: u, v: v, w: w,
        sizemode: 'absolute', sizeref: 0.8,
        colorscale: 'Plasma', showscale: false
      });
    }
    return traces;
  };

  const getThumbnailTraces = (tab) => {
    if (tab === 'Temperature') return [{ type: 'surface', z: [[1,1],[1,1]], surfacecolor: [[25,25],[10,10]], colorscale: 'Jet', showscale: false }];
    if (tab === '20°C Isotherm') return [{ type: 'surface', z: [[0,-2],[-1,-3]], surfacecolor: [[20,20],[20,20]], colorscale: 'Jet', showscale: false }];
    if (tab === 'Salinity') return [{ type: 'surface', z: [[0,0],[0,0]], surfacecolor: [[34,35],[36,37]], colorscale: 'Viridis', showscale: false }];
    if (tab === 'Currents') return [{ type: 'cone', x:[0], y:[0], z:[0], u:[1], v:[1], w:[0], colorscale: 'Plasma', showscale: false }];
  };

  const currentHist = probeHistory[probeHistory.length - 1] || {};
  const prevHist = probeHistory.length > 1 ? probeHistory[probeHistory.length - 2] : currentHist;
  
  const getDelta = (curr, prev, unit) => {
    if (curr === undefined || prev === undefined) return null;
    const diff = curr - prev;
    if (Math.abs(diff) < 0.01) return <span style={{color: 'var(--text-muted)'}}>—</span>;
    return diff > 0 
      ? <span style={{color: '#ef4444', display:'flex', alignItems:'center'}}><ArrowUpRight size={12}/>{diff.toFixed(2)}{unit}</span>
      : <span style={{color: '#3b82f6', display:'flex', alignItems:'center'}}><ArrowDownRight size={12}/>{Math.abs(diff).toFixed(2)}{unit}</span>;
  };

  return (
    <div style={{ 
      ...(isFullScreen ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999 } : { width: '100%', height: 'calc(100vh - 120px)', position: 'relative', borderRadius: '16px', border: '1px solid var(--border)' }),
      background: 'var(--bg-panel)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
    }}>
      {/* Top Header & Search Bar */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation2 size={20} color="var(--primary)"/> Volumetric Probe & Compare
            <Tooltip content="This view lets you slice the ocean volumetrically. Use the compass controls to move the probe horizontally (by grid cell) and vertically (by depth level). Observe how values change in the trend strip below.">
              <Info size={16} color="var(--text-muted)" style={{ cursor: 'pointer', outline: 'none' }} />
            </Tooltip>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Target: {probeLat.toFixed(2)}°N, {probeLon.toFixed(2)}°E @ {DEPTHS[probeDepthIdx]}m depth
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
             <button onClick={toggleCinematic} className="tour-cinematic" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: isPlaying ? '#ef4444' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                {isPlaying ? <><Square size={14}/> Stop</> : <><Play size={14}/> Cinematic Sequence</>}
             </button>
             <Tooltip content="The Cinematic Sequence auto-plays a guided tour through different camera perspectives, showing how the ocean characteristics change with depth.">
               <Info size={16} color="var(--text-muted)" style={{ cursor: 'pointer', outline: 'none' }} />
             </Tooltip>
             {isPlaying && (
               <div style={{ width: '150px', height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                 <div style={{ width: `${sequenceProgress}%`, height: '100%', background: 'var(--primary)' }} />
               </div>
             )}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }} className="tour-compass">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
              <button onClick={() => setStepSize(1)} style={{ padding: '4px 8px', background: stepSize === 1 ? 'var(--primary)' : 'transparent', color: stepSize === 1 ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>1 cell</button>
              <button onClick={() => setStepSize(5)} style={{ padding: '4px 8px', background: stepSize === 5 ? 'var(--primary)' : 'transparent', color: stepSize === 5 ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>5 cells</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', background: 'var(--bg-input)', padding: '4px', borderRadius: '8px' }}>
               <button onClick={() => handleMove(-1, 1, 0)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}><ArrowUpLeft size={16} /></button>
               <button onClick={() => handleMove(0, 1, 0)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}><ArrowUp size={16} /></button>
               <button onClick={() => handleMove(1, 1, 0)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}><ArrowUpRight size={16} /></button>
               <button onClick={() => handleMove(-1, 0, 0)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}><ArrowLeft size={16} /></button>
               <button style={{ border: 'none', background: 'transparent', color: 'var(--primary)' }}><Crosshair size={16} /></button>
               <button onClick={() => handleMove(1, 0, 0)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}><ArrowRight size={16} /></button>
               <button onClick={() => handleMove(-1, -1, 0)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}><ArrowDownLeft size={16} /></button>
               <button onClick={() => handleMove(0, -1, 0)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}><ArrowDown size={16} /></button>
               <button onClick={() => handleMove(1, -1, 0)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}><ArrowDownRight size={16} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-input)', padding: '4px', borderRadius: '8px' }}>
               <button onClick={() => handleMove(0, 0, -1)} style={{ padding: '2px 6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}><ChevronUp size={14}/> Shallower</button>
               <button onClick={() => handleMove(0, 0, 1)} style={{ padding: '2px 6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}><ChevronDown size={14}/> Deeper</button>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="search-bar" style={{ margin: 0, border: '1px solid var(--border)', background: 'var(--bg-input)', padding: '4px 8px', borderRadius: '6px' }}>
              <Search size={14} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder='Search (e.g. north 2 cells)' 
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleCommandSubmit}
                style={{ width: '150px', fontSize: '0.8rem', color: 'var(--text-main)', background: 'transparent', border: 'none', outline: 'none' }}
              />
            </div>
            <button onClick={() => setIsFullScreen(!isFullScreen)} style={{ padding: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)' }}>
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Side: Multiples Strip */}
        <div style={{ width: '180px', borderRight: '1px solid var(--border)', background: 'var(--bg-input)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Perspectives</h3>
          {TABS.map(tab => (
            <div 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              style={{ 
                background: 'var(--bg-panel)', borderRadius: '8px', padding: '8px', cursor: 'pointer',
                border: activeTab === tab ? '2px solid var(--primary)' : '1px solid var(--border)',
                boxShadow: activeTab === tab ? '0 4px 12px rgba(37,99,235,0.15)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: activeTab === tab ? 'var(--primary)' : 'var(--text-main)', marginBottom: '6px' }}>{tab}</div>
              <div style={{ height: '80px', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-input)', pointerEvents: 'none' }}>
                 <Plot
                    data={getThumbnailTraces(tab)}
                    layout={{ margin: {l:0, r:0, t:0, b:0}, scene: {xaxis: {visible:false}, yaxis: {visible:false}, zaxis: {visible:false}}, paper_bgcolor:'transparent', plot_bgcolor:'transparent' }}
                    config={{displayModeBar: false}}
                    style={{width: '100%', height: '100%'}}
                 />
              </div>
            </div>
          ))}
        </div>

        {/* Center: Hero Panel */}
        <div style={{ flex: 1, position: 'relative', background: 'var(--chart-bg)' }}>
          {caption && (
            <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'rgba(2,6,23,0.85)', padding: '12px 24px', borderRadius: '12px', color: '#38bdf8', fontSize: '1.1rem', fontWeight: 600, border: '1px solid #0369a1', backdropFilter: 'blur(8px)', textAlign: 'center', maxWidth: '80%', opacity: 1, transition: 'opacity 0.5s' }}>
              {caption}
            </div>
          )}
          <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 10, background: 'var(--bg-panel)', padding: '6px 12px', borderRadius: '6px', backdropFilter: 'blur(4px)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeTab === 'Temperature' && <Thermometer size={18} color="#38bdf8"/>}
              {activeTab === 'Salinity' && <Droplets size={18} color="#34d399"/>}
              {activeTab === 'Currents' && <Wind size={18} color="#f472b6"/>}
              {activeTab}
            </div>
          </div>
          <Plot
            data={getHeroTraces()}
            layout={{
              uirevision: camRev,
              autosize: true, margin: { l: 0, r: 0, b: 0, t: 0 },
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              scene: {
                aspectratio: { x: 2, y: 2, z: 1 },
                xaxis: { title: 'Lon', color: 'var(--text-muted)', gridcolor: 'var(--border)' },
                yaxis: { title: 'Lat', color: 'var(--text-muted)', gridcolor: 'var(--border)' },
                zaxis: { title: 'Depth', color: 'var(--text-muted)', gridcolor: 'var(--border)' },
                camera: cameraObj
              }
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </div>
      </div>

      {/* Bottom: Trend Strip & Deltas */}
      <div style={{ height: '80px', borderTop: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '8px' }}><Thermometer size={20} color="#ef4444" /></div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TEMPERATURE</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display:'flex', alignItems:'center', gap:'6px' }}>
              {currentHist.temp ? currentHist.temp.toFixed(2) : '--'}°C
              <span style={{ fontSize: '0.85rem' }}>{getDelta(currentHist.temp, prevHist.temp, '°')}</span>
            </div>
          </div>
          <div style={{ marginLeft: '10px' }}><Sparkline data={probeHistory.map(h => h.temp)} color="#ef4444" /></div>
        </div>

        <div style={{ width: '1px', height: '40px', background: 'var(--border)' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '8px' }}><Droplets size={20} color="#10b981" /></div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>SALINITY</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display:'flex', alignItems:'center', gap:'6px' }}>
              {currentHist.sal ? currentHist.sal.toFixed(2) : '--'} PSU
              <span style={{ fontSize: '0.85rem' }}>{getDelta(currentHist.sal, prevHist.sal, '')}</span>
            </div>
          </div>
          <div style={{ marginLeft: '10px' }}><Sparkline data={probeHistory.map(h => h.sal)} color="#10b981" /></div>
        </div>

        <div style={{ width: '1px', height: '40px', background: 'var(--border)' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#fdf4ff', padding: '8px', borderRadius: '8px' }}><Wind size={20} color="#d946ef" /></div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CURRENTS</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display:'flex', alignItems:'center', gap:'6px' }}>
              {currentHist.cur ? currentHist.cur.toFixed(2) : '--'} m/s
              <span style={{ fontSize: '0.85rem' }}>{getDelta(currentHist.cur, prevHist.cur, '')}</span>
            </div>
          </div>
          <div style={{ marginLeft: '10px' }}><Sparkline data={probeHistory.map(h => h.cur)} color="#d946ef" /></div>
        </div>
      </div>
    </div>
  );
}
