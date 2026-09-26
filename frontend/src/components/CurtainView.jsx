import React, { useMemo, useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { PointCloudLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// Generate dense point cloud to form a voxel "curtain" with flowing animation
const generateCurtainData = (start, end, timeOffset) => {
  const points = [];
  const steps = 250; // High density horizontal segments
  const depths = [];
  for (let d = 0; d <= 1000; d += 15) {
    depths.push(d);
  }
  
  const zExaggeration = 200; // Stretch the Z axis (depth)

  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const lon = start[0] + (end[0] - start[0]) * fraction;
    const lat = start[1] + (end[1] - start[1]) * fraction;
    
    depths.forEach(depth => {
      const baseTemp = 25 - (depth / 1000) * 22;
      // Subtracting timeOffset from the fraction makes the waves "flow" horizontally
      const temp = baseTemp + Math.sin((fraction * Math.PI * 4) - timeOffset) * 2;
      
      points.push({
        position: [lon, lat, -depth * zExaggeration],
        temperature: temp,
        depth: depth
      });
    });
  }
  return points;
};

// Map temperature to color using a jet-like colormap
const getColor = (temp) => {
  if (temp > 22) return [255, 50, 50];
  if (temp > 18) return [255, 165, 0];
  if (temp > 12) return [255, 255, 50];
  if (temp > 6) return [50, 255, 255];
  return [50, 50, 255];
};

// Real Satellite Imagery Style for MapLibre
const satelliteStyle = {
  version: 8,
  sources: {
    'satellite-tiles': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: 'Map data © ESRI'
    }
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite-tiles',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};

export default function CurtainView({ startPoint, endPoint }) {
  const [timeOffset, setTimeOffset] = useState(0);

  // Animation loop for the flowing river effect
  useEffect(() => {
    let animationFrame;
    const animate = () => {
      setTimeOffset(t => t + 0.05); // Speed of the river flow
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const data = useMemo(() => {
    if (!startPoint || !endPoint) return [];
    return generateCurtainData(startPoint, endPoint, timeOffset);
  }, [startPoint, endPoint, timeOffset]);

  const layers = [
    new PointCloudLayer({
      id: 'curtain-point-cloud',
      data,
      getPosition: d => d.position,
      getNormal: [0, 1, 0],
      getColor: d => getColor(d.temperature),
      pointSize: 5,
      sizeUnits: 'pixels',
      pickable: true,
      updateTriggers: {
        getColor: [timeOffset] // Ensure color updates smoothly
      }
    })
  ];

  const initialViewState = {
    longitude: startPoint ? (startPoint[0] + endPoint[0]) / 2 : 0,
    latitude: startPoint ? (startPoint[1] + endPoint[1]) / 2 : 0,
    zoom: 5.5,
    pitch: 65,
    bearing: 30
  };

  if (!startPoint || !endPoint) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>Draw a transect on the 2D map first to view the 3D curtain.</div>;
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      <DeckGL
        initialViewState={initialViewState}
        controller={true}
        layers={layers}
        getTooltip={({object}) => object && `Temperature: ${object.temperature.toFixed(2)} °C\nDepth: ${object.depth}m`}
      >
        <Map mapStyle={satelliteStyle} />
      </DeckGL>
      
      {/* Legend */}
      <div style={{ position: 'absolute', bottom: '40px', right: '40px', background: 'rgba(25,25,25,0.85)', color: 'white', padding: '12px 16px', borderRadius: '8px', zIndex: 10, fontSize: '0.8rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem' }}>Temperature (°C)</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><div style={{ width: 12, height: 12, background: 'rgb(255, 50, 50)', borderRadius: '2px' }}></div> &gt; 22</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><div style={{ width: 12, height: 12, background: 'rgb(255, 165, 0)', borderRadius: '2px' }}></div> 18 - 22</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><div style={{ width: 12, height: 12, background: 'rgb(255, 255, 50)', borderRadius: '2px' }}></div> 12 - 18</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><div style={{ width: 12, height: 12, background: 'rgb(50, 255, 255)', borderRadius: '2px' }}></div> 6 - 12</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 12, height: 12, background: 'rgb(50, 50, 255)', borderRadius: '2px' }}></div> &lt; 6</div>
      </div>
    </div>
  );
}
