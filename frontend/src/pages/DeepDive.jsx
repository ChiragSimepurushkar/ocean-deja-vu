import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ocean3DScene } from '../components/3d/Ocean3DScene';
import './DeepDive.css';

export default function DeepDive({ lat, lon }) {
  const navigate = useNavigate();
  const [currentDepth, setCurrentDepth] = useState(0);
  const depthRef = useRef(0);

  // Handle continuous keyboard input for diving
  useEffect(() => {
    const keys = { w: false, s: false, ArrowUp: false, ArrowDown: false };
    
    const handleKeyDown = (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; };
    const handleKeyUp = (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationFrameId;
    const updateDepth = () => {
      let delta = 0;
      if (keys.w || keys.ArrowUp) delta = -1.5;
      if (keys.s || keys.ArrowDown) delta = 1.5;

      if (delta !== 0) {
        depthRef.current = Math.max(0, Math.min(1000, depthRef.current + delta));
        setCurrentDepth(Math.round(depthRef.current));
      }
      animationFrameId = requestAnimationFrame(updateDepth);
    };
    updateDepth();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleWheel = (e) => {
    const delta = e.deltaY > 0 ? 15 : -15;
    depthRef.current = Math.max(0, Math.min(1000, depthRef.current + delta));
    setCurrentDepth(Math.round(depthRef.current));
  };

  return (
    <div 
      onWheel={handleWheel}
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: '#040914', overflow: 'hidden' }}
    >
      {/* Simple Back Button */}
      <button 
        onClick={() => navigate('/')} 
        style={{ 
          position: 'absolute', 
          top: '20px', 
          left: '20px', 
          zIndex: 50,
          padding: '8px 16px',
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'white',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        ← Back to Map
      </button>

      {/* Depth Indicator */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 50, color: 'white', fontFamily: 'monospace', fontSize: '1.2rem' }}>
        Depth: {currentDepth}m
      </div>

      {/* Full Screen Ocean3DScene */}
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <Ocean3DScene currentDepth={currentDepth} onDiscoverSpecies={() => {}} discoveredSpeciesIds={[]} />
      </div>
    </div>
  );
}
