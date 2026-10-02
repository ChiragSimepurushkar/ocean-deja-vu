import React, { useEffect, useState } from 'react';
import { playSplashSound } from '../utils/audio';

interface SplashTransitionProps {
  clickX: number;
  clickY: number;
  soundEnabled: boolean;
  stationName: string;
  onComplete: () => void;
}

export const SplashTransition: React.FC<SplashTransitionProps> = ({
  clickX,
  clickY,
  soundEnabled,
  stationName,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'ripple' | 'submerge' | 'complete'>('ripple');

  useEffect(() => {
    // Play the Web Audio synthesized plunge splash sound
    playSplashSound(soundEnabled);

    const timer1 = setTimeout(() => {
      setPhase('submerge');
    }, 450);

    const timer2 = setTimeout(() => {
      setPhase('complete');
      onComplete();
    }, 1100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [soundEnabled, onComplete]);

  // Generate splash droplet particle offsets
  const droplets = Array.from({ length: 24 }).map((_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const distance = 80 + (i % 5) * 35;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    return { id: i, dx, dy, size: 4 + (i % 4) * 3 };
  });

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999, pointerEvents: 'none', overflow: 'hidden'
    }}>
      {/* Shockwave Expanding Water Rings centered on clickX, clickY */}
      <div style={{
        position: 'absolute', left: clickX, top: clickY,
        width: 0, height: 0,
      }}>
        {/* Ring 1 - Fast shockwave */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '4px solid #67e8f9',
          opacity: 0.9,
          width: phase === 'ripple' ? '280px' : '900px',
          height: phase === 'ripple' ? '280px' : '900px',
          transition: 'all 0.8s cubic-bezier(0.1, 0.9, 0.2, 1)',
          borderColor: 'rgba(56, 189, 248, 0.8)',
          boxShadow: '0 0 40px rgba(45, 212, 191, 0.6), inset 0 0 40px rgba(56, 189, 248, 0.4)',
        }} />

        {/* Ring 2 - Deep oceanic displacement */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '64px', height: '64px',
          borderRadius: '50%',
          border: '2px solid #99f6e4',
          transform: phase === 'submerge' ? 'translate(-50%, -50%) scale(15)' : 'translate(-50%, -50%) scale(1)',
          opacity: phase === 'submerge' ? 0 : 0.8,
          transition: 'all 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />

        {/* Droplets Burst */}
        {droplets.map((d) => (
          <div key={d.id} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            borderRadius: '50%',
            backgroundColor: 'rgba(165, 243, 252, 0.9)',
            boxShadow: '0 1px 2px rgba(103, 232, 249, 0.5)',
            width: `${d.size}px`,
            height: `${d.size}px`,
            transform: phase === 'ripple'
              ? 'translate(-50%, -50%) scale(1)'
              : `translate(calc(-50% + ${d.dx * 2.2}px), calc(-50% + ${d.dy * 2.2}px)) scale(0.2)`,
            opacity: phase === 'ripple' ? 0.9 : 0,
            transition: 'all 0.6s cubic-bezier(0.1, 0.8, 0.3, 1)',
          }} />
        ))}
      </div>

      {/* Underwater Submersion Wash and Blur Overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(180deg, rgba(6, 182, 212, 0.9) 0%, rgba(2, 132, 199, 0.95) 50%, #050b14 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: phase === 'submerge' ? 1 : 0,
        backdropFilter: phase === 'submerge' ? 'blur(12px)' : 'none',
        transition: 'opacity 0.6s ease',
      }}>
        <div style={{ textAlign: 'center', padding: '0 1rem' }}>
          <p style={{
            fontSize: '0.75rem', textTransform: 'uppercase', fontFamily: 'monospace',
            letterSpacing: '0.1em', color: '#67e8f9', marginBottom: '0.5rem'
          }}>
            SUBMERGING RESEARCH VESSEL
          </p>
          <h2 style={{
            fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.025em',
            color: '#fff', marginBottom: '0.5rem'
          }}>
            Splashing into {stationName}
          </h2>
          <p style={{
            fontSize: '0.875rem', fontFamily: 'monospace', color: 'rgba(165, 243, 252, 0.8)'
          }}>
            Penetrating surface barrier layer · 0m Epipelagic
          </p>
        </div>
      </div>
    </div>
  );
};
