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
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Shockwave Expanding Water Rings centered on clickX, clickY */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: clickX, top: clickY }}
      >
        {/* Ring 1 - Fast shockwave */}
        <div
          className="rounded-full border-4 border-cyan-300 opacity-90 animate-ping"
          style={{
            width: phase === 'ripple' ? '280px' : '900px',
            height: phase === 'ripple' ? '280px' : '900px',
            transition: 'all 0.8s cubic-bezier(0.1, 0.9, 0.2, 1)',
            borderColor: 'rgba(56, 189, 248, 0.8)',
            boxShadow: '0 0 40px rgba(45, 212, 191, 0.6), inset 0 0 40px rgba(56, 189, 248, 0.4)',
          }}
        />

        {/* Ring 2 - Deep oceanic displacement */}
        <div
          className="absolute inset-0 -m-8 rounded-full border-2 border-teal-200"
          style={{
            transform: phase === 'submerge' ? 'scale(4)' : 'scale(1)',
            opacity: phase === 'submerge' ? 0 : 0.8,
            transition: 'all 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />

        {/* Droplets Burst */}
        {droplets.map((d) => (
          <div
            key={d.id}
            className="absolute rounded-full bg-cyan-200/90 shadow-sm shadow-cyan-300"
            style={{
              width: `${d.size}px`,
              height: `${d.size}px`,
              transform:
                phase === 'ripple'
                  ? 'translate(0, 0) scale(1)'
                  : `translate(${d.dx * 2.2}px, ${d.dy * 2.2}px) scale(0.2)`,
              opacity: phase === 'ripple' ? 0.9 : 0,
              transition: 'all 0.6s cubic-bezier(0.1, 0.8, 0.3, 1)',
            }}
          />
        ))}
      </div>

      {/* Underwater Submersion Wash and Blur Overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#06b6d4]/90 via-[#0284c7]/95 to-[#050b14] transition-opacity duration-600 flex flex-col items-center justify-center"
        style={{
          opacity: phase === 'submerge' ? 1 : 0,
          backdropFilter: phase === 'submerge' ? 'blur(12px)' : 'none',
        }}
      >
        <div className="text-center font-display text-cyan-100 animate-pulse px-4">
          <p className="text-xs uppercase font-mono tracking-widest text-cyan-300 mb-2">
            SUBMERGING RESEARCH VESSEL
          </p>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-2">
            Splashing into {stationName}
          </h2>
          <p className="text-sm font-mono text-cyan-200/80">
            Penetrating surface barrier layer · 0m Epipelagic
          </p>
        </div>
      </div>
    </div>
  );
};
