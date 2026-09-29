import React, { useState } from 'react';
import { Player, PlayerEvent } from '@lottiefiles/react-lottie-player';
import { MarineSpecies } from '../types';

interface LottieCreatureProps {
  animationData: Record<string, unknown>;
  name: string;
  size: number; // base size in px (e.g. 140)
  scale: number; // 0.6x to 1.4x
  direction: 1 | -1;
  speciesRef: MarineSpecies;
  onDiscover: (species: MarineSpecies) => void;
  isDiscovered: boolean;
  glowColor?: string;
  isDeepSea?: boolean;
}

export const LottieCreature: React.FC<LottieCreatureProps> = ({
  animationData,
  name,
  size,
  scale,
  direction,
  speciesRef,
  onDiscover,
  isDiscovered,
  glowColor,
  isDeepSea,
}) => {
  const [hasError, setHasError] = useState(false);

  // Explicit non-zero pixel dimensions to prevent 0x0 rendering collapses
  const actualWidth = Math.max(60, Math.round(size * scale));
  const actualHeight = Math.max(45, Math.round((size * 0.75) * scale));

  const handlePlayerEvent = (event: PlayerEvent) => {
    if (event === PlayerEvent.Error) {
      console.warn(
        `[LottieCreature] Lottie animation error for "${name}" (${speciesRef.scientificName}). Falling back to vector silhouette.`
      );
      setHasError(true);
    }
  };

  // Vector Silhouette Fallback if Lottie JSON fails to parse or render
  const renderFallbackSilhouette = () => {
    const color = speciesRef.color || '#38bdf8';
    const type = speciesRef.type;

    if (type === 'ray') {
      return (
        <svg
          viewBox="0 0 160 100"
          className="w-full h-full drop-shadow-md animate-pulse [animation-duration:3s]"
        >
          {/* Manta Ray Wing Spread */}
          <path
            d="M 120 50 Q 80 10 30 15 L 20 50 L 5 50 L 20 50 L 30 85 Q 80 90 120 50 Z"
            fill={color}
            opacity="0.9"
          />
          {/* Horns & Tail */}
          <path d="M 120 42 L 135 38 L 125 48 Z" fill="#0f172a" />
          <path d="M 120 58 L 135 62 L 125 52 Z" fill="#0f172a" />
          <line x1="20" y1="50" x2="-25" y2="50" stroke={color} strokeWidth="2.5" />
          {glowColor && (
            <circle cx="80" cy="50" r="4" fill={glowColor} className="animate-ping" />
          )}
        </svg>
      );
    }

    if (type === 'jellyfish') {
      return (
        <svg
          viewBox="0 0 100 130"
          className="w-full h-full drop-shadow-lg animate-pulse [animation-duration:2.5s]"
        >
          <path
            d="M 50 15 Q 15 15 15 55 Q 50 45 85 55 Q 85 15 50 15 Z"
            fill={color}
            opacity="0.75"
          />
          <path
            d="M 30 55 Q 25 80 32 110 M 50 50 Q 48 85 52 115 M 70 55 Q 75 80 68 110"
            stroke={color}
            strokeWidth="2"
            fill="none"
          />
          <circle cx="50" cy="40" r="5" fill="#a7f3d0" opacity="0.8" />
        </svg>
      );
    }

    if (type === 'angler') {
      return (
        <svg
          viewBox="0 0 150 100"
          className="w-full h-full drop-shadow-xl animate-pulse [animation-duration:4s]"
        >
          <ellipse cx="65" cy="50" rx="45" ry="32" fill="#0a0f1d" stroke="#1e293b" strokeWidth="2" />
          {/* Gaping jaw & needle teeth */}
          <polygon points="100,42 115,50 100,58" fill="#0a0f1d" />
          <line x1="95" y1="42" x2="100" y2="48" stroke="#ffffff" strokeWidth="2" />
          <line x1="102" y1="46" x2="106" y2="52" stroke="#ffffff" strokeWidth="2" />
          {/* Glowing Esca lure */}
          <path d="M 55 25 Q 75 -5 95 10" stroke="#38bdf8" strokeWidth="2.5" fill="none" />
          <circle cx="95" cy="10" r="6" fill="#22d3ee" className="animate-ping" />
          <circle cx="95" cy="10" r="4" fill="#a5f3fc" />
          {/* Tail */}
          <polygon points="20,50 0,35 5,50 0,65" fill="#1e293b" />
        </svg>
      );
    }

    if (type === 'squid') {
      return (
        <svg
          viewBox="0 0 140 80"
          className="w-full h-full drop-shadow-md animate-pulse [animation-duration:2.8s]"
        >
          {/* Mantle */}
          <path d="M 20 40 Q 50 20 85 28 L 85 52 Q 50 60 20 40 Z" fill={color} opacity="0.75" />
          {/* Eyes */}
          <circle cx="75" cy="40" r="4" fill="#60a5fa" />
          {/* Tentacles */}
          <path d="M 85 34 Q 105 30 130 25 M 85 46 Q 105 50 130 55" stroke={color} strokeWidth="2" fill="none" />
        </svg>
      );
    }

    // Standard Pelagic Fish (Tuna, Damselfish, Flyingfish)
    return (
      <svg
        viewBox="0 0 140 80"
        className="w-full h-full drop-shadow-md"
      >
        <path
          d="M 95 40 Q 60 15 35 25 L 15 15 L 22 40 L 15 65 L 35 55 Q 60 65 95 40 Z"
          fill={color}
          opacity="0.9"
        />
        {/* Pectoral Fin */}
        <polygon points="65,40 50,55 58,40" fill="#ffffff" opacity="0.4" />
        {/* Eye */}
        <circle cx="82" cy="35" r="4" fill="#ffffff" />
        <circle cx="83" cy="35" r="2" fill="#020617" />
      </svg>
    );
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onDiscover(speciesRef);
      }}
      className="relative group cursor-pointer select-none transition-transform duration-200 active:scale-95"
      style={{
        width: `${actualWidth}px`,
        height: `${actualHeight}px`,
        minWidth: `${actualWidth}px`,
        minHeight: `${actualHeight}px`,
        transform: direction === -1 ? 'scaleX(-1)' : 'scaleX(1)',
        filter:
          isDeepSea && glowColor
            ? `drop-shadow(0 0 12px ${glowColor}) drop-shadow(0 0 20px ${glowColor}66)`
            : undefined,
      }}
      title={`Click to analyze & catalog: ${speciesRef.name}`}
    >
      {/* 1. If Lottie player encountered an error or failed to load, render robust SVG silhouette */}
      {hasError ? (
        renderFallbackSilhouette()
      ) : (
        <div style={{ width: '100%', height: '100%' }}>
          <Player
            autoplay
            loop
            src={animationData}
            onEvent={handlePlayerEvent}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}

      {/* 2. Interactive hover targeting reticle for cataloging */}
      <div
        className="absolute inset-0 border border-cyan-400/0 group-hover:border-cyan-400/70 rounded-full transition-all duration-200 pointer-events-none scale-90 group-hover:scale-105"
        style={{
          boxShadow: '0 0 15px rgba(56, 189, 248, 0.3)',
        }}
      />

      {/* 3. Tooltip on hover */}
      <div
        className="absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-[#030914]/95 border border-cyan-500/70 text-[10px] font-mono text-cyan-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-30 shadow-lg"
        style={{
          transform: direction === -1 ? 'translateX(-50%) scaleX(-1)' : 'translateX(-50%)',
        }}
      >
        <span>{speciesRef.name}</span>
        {isDiscovered ? (
          <span className="text-teal-400 ml-1.5 font-semibold">✓ [LOGGED]</span>
        ) : (
          <span className="text-amber-400 ml-1.5 font-semibold">+{speciesRef.points} PTS</span>
        )}
      </div>
    </div>
  );
};
