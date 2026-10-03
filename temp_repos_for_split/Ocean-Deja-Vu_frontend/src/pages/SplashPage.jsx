import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SplashTransition } from '../components/SplashTransition';

const IMAGES = ['/image1.png', '/image2.png', '/image3.png', '/image4.png', '/image5.png'];

export default function SplashPage({ onComplete }) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const preloadedRef = useRef([]);

  // Preload all images eagerly on mount
  useEffect(() => {
    let loaded = 0;
    IMAGES.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        preloadedRef.current[i] = img;
        loaded++;
        if (loaded === IMAGES.length) setImagesLoaded(true);
      };
      img.onerror = () => {
        loaded++;
        if (loaded === IMAGES.length) setImagesLoaded(true);
      };
    });
  }, []);

  // Progress bar
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setLoadingProgress(p => {
        if (p >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return Math.min(100, p + Math.random() * 12);
      });
    }, 200);
    return () => clearInterval(progressInterval);
  }, []);

  // Slideshow — only start after images preloaded
  useEffect(() => {
    if (!imagesLoaded) return;
    const slideshowInterval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % IMAGES.length);
    }, 3000);
    return () => clearInterval(slideshowInterval);
  }, [imagesLoaded]);

  const handleBegin = () => {
    setTransitioning(true);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      
      {/* Ambient aura blobs */}
      <motion.div 
        animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'absolute', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 70%)', top: '20%', left: '30%' }}
      />
      <motion.div 
        animate={{ y: [0, 30, 0], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'absolute', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%)', bottom: '10%', right: '20%' }}
      />

      <div style={{ zIndex: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Slideshow with placeholder */}
        <div style={{ 
          position: 'relative', width: '500px', height: '320px', marginBottom: '2rem',
          borderRadius: '16px', overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(6,182,212,0.05) 100%)',
          border: '1px solid rgba(56,189,248,0.1)',
        }}>
          {!imagesLoaded && (
            <div style={{ 
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(56,189,248,0.5)', fontSize: '0.85rem', fontFamily: "'JetBrains Mono', monospace",
            }}>
              Loading previews...
            </div>
          )}
          <AnimatePresence mode="wait">
            {imagesLoaded && (
              <motion.img
                key={currentImageIndex}
                src={IMAGES[currentImageIndex]}
                alt={`Ocean Deja Vu Preview ${currentImageIndex + 1}`}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                style={{ 
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                  objectFit: 'cover', borderRadius: '16px',
                }}
              />
            )}
          </AnimatePresence>

          {/* Slide indicator dots */}
          <div style={{ 
            position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: '8px', zIndex: 5,
          }}>
            {IMAGES.map((_, i) => (
              <div key={i} style={{
                width: i === currentImageIndex ? '24px' : '8px', height: '8px',
                borderRadius: '4px', transition: 'all 0.3s ease',
                background: i === currentImageIndex ? '#38bdf8' : 'rgba(255,255,255,0.3)',
              }} />
            ))}
          </div>
        </div>

        {/* Project Name — subtitle treatment */}
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{ 
            fontSize: '2.8rem', fontWeight: 900, color: 'white', margin: 0, 
            letterSpacing: '6px', textTransform: 'uppercase',
            textShadow: '0 0 40px rgba(56,189,248,0.4), 0 4px 20px rgba(0,0,0,0.5)',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          OCEAN DEJA VU
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          style={{ 
            color: '#64748b', fontSize: '1rem', marginTop: '0.6rem', 
            letterSpacing: '3px', textTransform: 'uppercase',
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
          }}
        >
          Reconstructing the ocean you can't see
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: loadingProgress >= 100 ? 1 : 0, scale: loadingProgress >= 100 ? 1 : 0.9 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        style={{ zIndex: 10, marginTop: '3rem', pointerEvents: loadingProgress >= 100 ? 'auto' : 'none' }}
      >
        <button 
          onClick={handleBegin}
          className="pulse-btn"
          style={{ 
            background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', 
            padding: '16px 48px', fontSize: '1.1rem', fontWeight: 700, borderRadius: '50px',
            cursor: 'pointer', boxShadow: '0 0 30px rgba(56,189,248,0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            fontFamily: "'Inter', sans-serif", letterSpacing: '1px',
          }}
        >
          Begin Exploration
          <span style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '4px', fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>Enables Ambient Sound</span>
        </button>
      </motion.div>

      {loadingProgress < 100 && (
        <div style={{ position: 'absolute', bottom: '18%', width: '280px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${loadingProgress}%`, height: '100%', background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)', transition: 'width 0.2s', boxShadow: '0 0 8px rgba(56,189,248,0.5)' }} />
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
          0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.3); }
          70% { box-shadow: 0 0 0 15px rgba(56, 189, 248, 0); }
          100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
        }
        .pulse-btn {
          animation: pulse 2s infinite;
          transition: all 0.3s;
        }
        .pulse-btn:hover {
          background: rgba(14,165,233,0.2) !important;
          transform: scale(1.05);
          border-color: rgba(56,189,248,0.7) !important;
        }
      `}</style>
    </div>
  );
}
