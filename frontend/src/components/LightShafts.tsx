import React from 'react';

interface LightShaftsProps {
  currentDepth: number; // 0 to 1000m
}

export const LightShafts: React.FC<LightShaftsProps> = ({ currentDepth }) => {
  // Fade out completely by 100m depth
  if (currentDepth >= 105) return null;

  const depthFactor = Math.max(0, Math.min(1, 1 - currentDepth / 100));
  const masterOpacity = depthFactor * 0.75;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-[5] transition-opacity duration-300"
      style={{ opacity: masterOpacity }}
    >
      {/* SVG God Rays with multi-angled volumetric light beams and shimmering animated gradients */}
      <svg
        className="w-full h-full"
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="godRayGrad1" x1="0%" y1="0%" x2="40%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="30%" stopColor="#67e8f9" stopOpacity="0.25" />
            <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="godRayGrad2" x1="10%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.38" />
            <stop offset="35%" stopColor="#5eead4" stopOpacity="0.22" />
            <stop offset="75%" stopColor="#0ea5e9" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="godRayGrad3" x1="20%" y1="0%" x2="60%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Ray 1 */}
        <polygon
          points="80,0 180,0 420,600 240,600"
          fill="url(#godRayGrad1)"
          className="animate-pulse [animation-duration:6s]"
        />

        {/* Ray 2 */}
        <polygon
          points="260,0 380,0 680,600 480,600"
          fill="url(#godRayGrad2)"
          className="animate-pulse [animation-duration:8s] [animation-delay:1.5s]"
        />

        {/* Ray 3 */}
        <polygon
          points="460,0 560,0 840,600 680,600"
          fill="url(#godRayGrad1)"
          className="animate-pulse [animation-duration:7s] [animation-delay:3s]"
        />

        {/* Ray 4 */}
        <polygon
          points="640,0 780,0 1020,600 820,600"
          fill="url(#godRayGrad3)"
          className="animate-pulse [animation-duration:9s] [animation-delay:0.8s]"
        />

        {/* Ray 5 */}
        <polygon
          points="820,0 950,0 1180,600 990,600"
          fill="url(#godRayGrad2)"
          className="animate-pulse [animation-duration:7.5s] [animation-delay:2.2s]"
        />
      </svg>

      {/* Surface caustic shimmer band */}
      <div
        className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-white/20 via-cyan-200/10 to-transparent pointer-events-none animate-caustics"
      />
    </div>
  );
};
