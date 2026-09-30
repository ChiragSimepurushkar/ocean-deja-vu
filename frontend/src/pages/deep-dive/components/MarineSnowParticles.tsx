import React, { useEffect, useRef } from 'react';

interface MarineSnowProps {
  currentDepth: number; // 0 to 1000m
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  opacity: number;
  blurLevel: number;
  isBubble: boolean;
  isBioluminescent: boolean;
}

export const MarineSnowParticles: React.FC<MarineSnowProps> = ({ currentDepth }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const depthRef = useRef(currentDepth);

  useEffect(() => {
    depthRef.current = currentDepth;
  }, [currentDepth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Initialize 160 particles with varied depths, speeds, blurs, and sizes
    const initialParticles: Particle[] = Array.from({ length: 160 }).map(() => {
      const isBubble = Math.random() < 0.25;
      const size = 1.0 + Math.random() * 4.5;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size,
        speedY: isBubble ? -(0.5 + Math.random() * 1.2) : (0.15 + Math.random() * 0.45),
        speedX: (Math.random() - 0.5) * 0.25,
        wobbleSpeed: 0.02 + Math.random() * 0.04,
        wobbleAmp: 0.4 + Math.random() * 0.8,
        opacity: 0.2 + Math.random() * 0.65,
        blurLevel: size > 3.2 ? 1.5 : size < 1.8 ? 0 : 0.8,
        isBubble,
        isBioluminescent: Math.random() < 0.28,
      };
    });
    particlesRef.current = initialParticles;

    let time = 0;

    const render = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      const depth = depthRef.current;

      // Determine active particle count based on depth:
      // Surface (<100m): ~45 particles (bubbles & plankton)
      // 100m-300m: ~85 particles
      // >300m: 160 particles (high-density marine snow aggregate)
      let activeCount = 50;
      if (depth >= 300) {
        // Density increases significantly below 300m up to 1000m
        const deepProgress = Math.min(1, (depth - 300) / 400);
        activeCount = Math.round(90 + deepProgress * 70); // 90 to 160
      } else if (depth >= 100) {
        activeCount = Math.round(50 + ((depth - 100) / 200) * 40); // 50 to 90
      }

      for (let i = 0; i < activeCount; i++) {
        const p = particlesRef.current[i];
        if (!p) continue;

        const isSurfaceZone = depth < 120;

        // In surface zone, bubbles float UP; in deep ocean, marine snow slowly descends DOWN
        if (isSurfaceZone && p.isBubble) {
          p.y += p.speedY; // negative, floats up
          if (p.y < -15) {
            p.y = height + 15;
            p.x = Math.random() * width;
          }
        } else {
          // Marine snow drifts down with horizontal sine wobble
          p.y += p.speedY;
          p.x += p.speedX + Math.sin(time * p.wobbleSpeed + p.y * 0.01) * p.wobbleAmp;

          if (p.y > height + 20) {
            p.y = -20;
            p.x = Math.random() * width;
          }
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
        }

        ctx.save();

        if (isSurfaceZone && p.isBubble) {
          // Render bubbly sheen
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity * 0.75})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.25})`;
          ctx.fill();
        } else {
          // Marine snow speck
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

          if (depth > 400 && p.isBioluminescent) {
            // Soft glowing turquoise/cyan bioluminescent marine snow
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = p.size * 3;
            ctx.fillStyle = `rgba(165, 243, 252, ${Math.min(1, p.opacity + 0.3)})`;
          } else if (p.blurLevel > 1) {
            // Out of focus foreground / background bokeh snow
            ctx.fillStyle = `rgba(226, 232, 240, ${p.opacity * 0.45})`;
          } else {
            // Crisp organic marine snow flake
            ctx.fillStyle = `rgba(241, 245, 249, ${p.opacity * 0.65})`;
          }
          ctx.fill();
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-[25]"
    />
  );
};
