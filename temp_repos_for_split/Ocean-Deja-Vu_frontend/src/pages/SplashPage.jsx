import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SplashTransition } from '../components/SplashTransition';

export default function SplashPage({ onComplete }) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setLoadingProgress(p => {
        if (p >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return Math.min(100, p + Math.random() * 15);
      });
    }, 200);

    const slideshowInterval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % 5);
    }, 3500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(slideshowInterval);
    };
  }, []);

  const handleBegin = () => {
    setTransitioning(true);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      
      {/* Ambient background using Framer Motion */}
      <motion.div 
        animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'absolute', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 70%)', top: '20%', left: '30%' }}
      />
      <motion.div 
        animate={{ y: [0, 30, 0], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'absolute', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)', bottom: '10%', right: '20%' }}
      />

      <div style={{ zIndex: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Slideshow */}
        <div style={{ position: 'relative', width: '450px', height: '300px', marginBottom: '2rem' }}>
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImageIndex}
              src={`/image${currentImageIndex + 1}.png`}
              alt={`Slide ${currentImageIndex + 1}`}
              initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
              transition={{ duration: 1, ease: "easeInOut" }}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(56,189,248,0.4))' }}
            />
          </AnimatePresence>
        </div>

        {/* Subtitle Project Name */}
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1 }}
          style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', margin: 0, letterSpacing: '4px', textTransform: 'uppercase', textShadow: '0 4px 20px rgba(56,189,248,0.4)' }}
        >
          OCEAN DEJA VU
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          style={{ color: '#94a3b8', fontSize: '1.2rem', marginTop: '0.5rem', letterSpacing: '2px', textTransform: 'uppercase' }}
        >
          Reconstructing the ocean you can't see
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: loadingProgress >= 100 ? 1 : 0, scale: loadingProgress >= 100 ? 1 : 0.9 }}
        transition={{ delay: 1.8, duration: 0.5 }}
        style={{ zIndex: 10, marginTop: '4rem', pointerEvents: loadingProgress >= 100 ? 'auto' : 'none' }}
      >
        <button 
          onClick={handleBegin}
          style={{ 
            background: 'rgba(56,189,248,0.1)', border: '2px solid #38bdf8', color: '#38bdf8', 
            padding: '16px 48px', fontSize: '1.2rem', fontWeight: 700, borderRadius: '50px',
            cursor: 'pointer', boxShadow: '0 0 30px rgba(56,189,248,0.3)',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}
          className="pulse-btn"
        >
          Begin Exploration
          <span style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '4px', fontWeight: 500 }}>Enables Ambient Sound</span>
        </button>
      </motion.div>

      {loadingProgress < 100 && (
        <div style={{ position: 'absolute', bottom: '20%', width: '300px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${loadingProgress}%`, height: '100%', background: '#38bdf8', transition: 'width 0.2s' }} />
        </div>
      )}

      {transitioning && (
        <SplashTransition 
          isActive={true} 
          direction="down" 
          onComplete={onComplete}
        />
      )}
      
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(56, 189, 248, 0); }
          100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
        }
        .pulse-btn {
          animation: pulse 2s infinite;
          transition: all 0.3s;
        }
        .pulse-btn:hover {
          background: rgba(56,189,248,0.2) !important;
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}
