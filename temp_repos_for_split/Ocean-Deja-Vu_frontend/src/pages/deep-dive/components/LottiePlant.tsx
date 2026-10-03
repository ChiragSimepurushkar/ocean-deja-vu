import React, { useState } from 'react';
import { Player, PlayerEvent } from '@lottiefiles/react-lottie-player';

interface LottiePlantProps {
  animationData: Record<string, unknown>;
  name: string;
  width: number;
  height: number;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const LottiePlant: React.FC<LottiePlantProps> = ({
  animationData,
  name,
  width,
  height,
  scale = 1,
  className = '',
  style = {},
}) => {
  const [hasError, setHasError] = useState(false);

  const actualWidth = Math.max(40, Math.round(width * scale));
  const actualHeight = Math.max(60, Math.round(height * scale));

  const handlePlayerEvent = (event: PlayerEvent) => {
    if (event === PlayerEvent.Error) {
      console.warn(`[LottiePlant] Lottie animation error for plant "${name}". Falling back to swaying vector flora.`);
      setHasError(true);
    }
  };

  const renderFallbackPlant = () => {
    return (
      <svg
        viewBox="0 0 100 200"
        className="w-full h-full animate-kelp"
        preserveAspectRatio="xMidYMax meet"
      >
        <path
          d="M 50 200 Q 30 140 60 90 Q 75 40 50 0 Q 35 45 45 90 Q 30 150 50 200 Z"
          fill="#0d9488"
          opacity="0.85"
        />
        {/* Leaf 1 */}
        <path d="M 55 120 Q 85 100 90 80 Q 70 85 52 110 Z" fill="#14b8a6" opacity="0.9" />
        {/* Leaf 2 */}
        <path d="M 45 70 Q 15 50 10 30 Q 30 35 48 60 Z" fill="#0f766e" opacity="0.9" />
      </svg>
    );
  };

  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      style={{
        width: `${actualWidth}px`,
        height: `${actualHeight}px`,
        minWidth: `${actualWidth}px`,
        minHeight: `${actualHeight}px`,
        ...style,
      }}
      title={name}
    >
      {hasError ? (
        renderFallbackPlant()
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
            }}
          />
        </div>
      )}
    </div>
  );
};
