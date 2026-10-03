import React, { useEffect, useRef } from 'react';
import { MarineSpecies } from '../types';

interface OceanCanvasProps {
  currentDepth: number; // 0 to 1000
  onDiscoverSpecies: (species: MarineSpecies) => void;
  discoveredSpeciesIds: string[];
}

interface FishActor {
  id: string;
  name: string;
  scientificName: string;
  type: string;
  x: number;
  y: number;
  speed: number;
  direction: 1 | -1;
  size: number;
  color: string;
  glowColor?: string;
  minDepth: number;
  maxDepth: number;
  oscillation: number;
  oscSpeed: number;
  speciesRef: MarineSpecies;
}

interface Particle {
  x: number;
  y: number;
  speedY: number;
  speedX: number;
  size: number;
  opacity: number;
  isBubble: boolean;
}

export const OceanCanvas: React.FC<OceanCanvasProps> = ({
  currentDepth,
  onDiscoverSpecies,
  discoveredSpeciesIds,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const actorsRef = useRef<FishActor[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Initialize marine actors
  useEffect(() => {
    const actors: FishActor[] = [
      // 0 - 60m surface life
      {
        id: 'flying-fish-1',
        name: 'Indian Ocean Flyingfish',
        scientificName: 'Exocoetidae volitans',
        type: 'fish',
        x: 100,
        y: 120,
        speed: 1.8,
        direction: 1,
        size: 26,
        color: '#38bdf8',
        glowColor: '#7dd3fc',
        minDepth: 0,
        maxDepth: 55,
        oscillation: 0,
        oscSpeed: 0.08,
        speciesRef: {
          id: 'flying-fish',
          name: 'Indian Ocean Flyingfish',
          scientificName: 'Exocoetidae volitans',
          depthRange: '0 - 20m',
          minDepth: 0,
          maxDepth: 40,
          rarity: 'Common',
          description: 'Wing-like pectoral fins allow this epipelagic glider to leap out of warm equatorial waves.',
          points: 50,
          color: '#38bdf8',
          type: 'fish',
        },
      },
      {
        id: 'turtle-1',
        name: 'Hawksbill Sea Turtle',
        scientificName: 'Eretmochelys imbricata',
        type: 'turtle',
        x: 350,
        y: 180,
        speed: 0.7,
        direction: -1,
        size: 55,
        color: '#0d9488',
        glowColor: '#2dd4bf',
        minDepth: 0,
        maxDepth: 75,
        oscillation: 0,
        oscSpeed: 0.02,
        speciesRef: {
          id: 'hawksbill-turtle',
          name: 'Hawksbill Sea Turtle',
          scientificName: 'Eretmochelys imbricata',
          depthRange: '0 - 60m',
          minDepth: 0,
          maxDepth: 70,
          rarity: 'Uncommon',
          description: 'Critical coral reef dweller navigating seasonal monsoon current reversals.',
          points: 100,
          color: '#0d9488',
          type: 'turtle',
        },
      },
      // 50 - 150m Manta & Tuna
      {
        id: 'manta-1',
        name: 'Oceanic Manta Ray',
        scientificName: 'Mobula birostris',
        type: 'ray',
        x: 600,
        y: 220,
        speed: 1.1,
        direction: 1,
        size: 85,
        color: '#1e293b',
        glowColor: '#2dd4bf',
        minDepth: 30,
        maxDepth: 130,
        oscillation: 0,
        oscSpeed: 0.03,
        speciesRef: {
          id: 'reef-manta',
          name: 'Oceanic Manta Ray',
          scientificName: 'Mobula birostris',
          depthRange: '0 - 100m',
          minDepth: 0,
          maxDepth: 110,
          rarity: 'Uncommon',
          description: 'Gentle plankton filter-feeder with up to 7-meter wingspan, cruising upwelling zones.',
          points: 120,
          color: '#1e293b',
          glowColor: '#2dd4bf',
          type: 'ray',
        },
      },
      {
        id: 'tuna-school',
        name: 'Yellowfin Tuna School',
        scientificName: 'Thunnus albacares',
        type: 'fish',
        x: 800,
        y: 260,
        speed: 2.4,
        direction: -1,
        size: 38,
        color: '#0284c7',
        glowColor: '#38bdf8',
        minDepth: 20,
        maxDepth: 140,
        oscillation: 0,
        oscSpeed: 0.07,
        speciesRef: {
          id: 'yellowfin-tuna',
          name: 'Yellowfin Tuna School',
          scientificName: 'Thunnus albacares',
          depthRange: '10 - 150m',
          minDepth: 10,
          maxDepth: 120,
          rarity: 'Common',
          description: 'High-speed pelagic predator cruising along thermal fronts in upper ocean.',
          points: 75,
          color: '#0284c7',
          type: 'fish',
        },
      },
      // 100 - 300m Thermocline / Comb Jelly
      {
        id: 'comb-jelly-1',
        name: 'Rainbow Ctenophore',
        scientificName: 'Beroe abyssicola',
        type: 'jellyfish',
        x: 450,
        y: 340,
        speed: 0.45,
        direction: 1,
        size: 34,
        color: '#67e8f9',
        glowColor: '#34d399',
        minDepth: 80,
        maxDepth: 280,
        oscillation: 0,
        oscSpeed: 0.04,
        speciesRef: {
          id: 'comb-jelly',
          name: 'Rainbow Ctenophore',
          scientificName: 'Beroe abyssicola',
          depthRange: '80 - 300m',
          minDepth: 75,
          maxDepth: 250,
          rarity: 'Common',
          description: 'Translucent gelatinous organism with rows of microscopic cilia refracting rainbow light.',
          points: 90,
          color: '#a7f3d0',
          type: 'jellyfish',
        },
      },
      // 200 - 550m Siphonophore & Glass Squid
      {
        id: 'siphonophore-1',
        name: 'Giant String Siphonophore',
        scientificName: 'Apolemia uvaria',
        type: 'siphonophore',
        x: 250,
        y: 400,
        speed: 0.35,
        direction: -1,
        size: 110,
        color: '#38bdf8',
        glowColor: '#67e8f9',
        minDepth: 180,
        maxDepth: 650,
        oscillation: 0,
        oscSpeed: 0.02,
        speciesRef: {
          id: 'deep-siphonophore',
          name: 'Giant String Siphonophore',
          scientificName: 'Apolemia uvaria',
          depthRange: '200 - 800m',
          minDepth: 180,
          maxDepth: 650,
          rarity: 'Rare',
          description: 'Colonial superorganism stretching meters across the twilight zone, glowing with bioluminescence.',
          points: 200,
          color: '#38bdf8',
          type: 'siphonophore',
        },
      },
      {
        id: 'glass-squid-1',
        name: 'Cockatoo Glass Squid',
        scientificName: 'Cranchia scabra',
        type: 'squid',
        x: 720,
        y: 460,
        speed: 0.65,
        direction: 1,
        size: 42,
        color: '#93c5fd',
        glowColor: '#60a5fa',
        minDepth: 260,
        maxDepth: 680,
        oscillation: 0,
        oscSpeed: 0.05,
        speciesRef: {
          id: 'glass-squid',
          name: 'Cockatoo Glass Squid',
          scientificName: 'Cranchia scabra',
          depthRange: '300 - 750m',
          minDepth: 250,
          maxDepth: 600,
          rarity: 'Uncommon',
          description: 'Nearly 100% transparent body with photophores under its eyes for camouflage.',
          points: 150,
          color: '#93c5fd',
          type: 'squid',
        },
      },
      // 600 - 1000m Anglerfish & Viperfish
      {
        id: 'angler-1',
        name: 'Deep-Sea Humpback Anglerfish',
        scientificName: 'Melanocetus johnsonii',
        type: 'angler',
        x: 320,
        y: 520,
        speed: 0.4,
        direction: 1,
        size: 58,
        color: '#0f172a',
        glowColor: '#22d3ee',
        minDepth: 600,
        maxDepth: 1000,
        oscillation: 0,
        oscSpeed: 0.03,
        speciesRef: {
          id: 'anglerfish',
          name: 'Deep-Sea Humpback Anglerfish',
          scientificName: 'Melanocetus johnsonii',
          depthRange: '700 - 1000m+',
          minDepth: 650,
          maxDepth: 1000,
          rarity: 'Legendary',
          description: 'Monarch of the midnight abyss. Uses a modified dorsal spine tipped with a symbiotic glowing lure.',
          points: 300,
          color: '#0f172a',
          type: 'angler',
        },
      },
      {
        id: 'viperfish-1',
        name: 'Sloane\'s Viperfish',
        scientificName: 'Chauliodus sloani',
        type: 'fish',
        x: 650,
        y: 540,
        speed: 0.8,
        direction: -1,
        size: 46,
        color: '#1e293b',
        glowColor: '#38bdf8',
        minDepth: 500,
        maxDepth: 1000,
        oscillation: 0,
        oscSpeed: 0.05,
        speciesRef: {
          id: 'viperfish',
          name: 'Sloane\'s Viperfish',
          scientificName: 'Chauliodus sloani',
          depthRange: '500 - 1000m+',
          minDepth: 480,
          maxDepth: 1000,
          rarity: 'Rare',
          description: 'Equipped with needle-sharp fangs and ventral photophores for counter-illumination.',
          points: 220,
          color: '#1e293b',
          type: 'fish',
        },
      }
    ];

    actorsRef.current = actors;

    // Generate floating bubbles and marine snow particles
    const particles: Particle[] = Array.from({ length: 65 }).map(() => ({
      x: Math.random() * 1200,
      y: Math.random() * 800,
      speedY: 0.2 + Math.random() * 0.8,
      speedX: (Math.random() - 0.5) * 0.3,
      size: 1.2 + Math.random() * 3.5,
      opacity: 0.2 + Math.random() * 0.6,
      isBubble: Math.random() > 0.4,
    }));
    particlesRef.current = particles;
  }, []);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 1200);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 700);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    let time = 0;

    const render = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      // 1. Dynamic Water Background Gradient based on depth
      const depthFrac = Math.min(1, Math.max(0, currentDepth / 1000));
      const grad = ctx.createLinearGradient(0, 0, 0, height);

      if (currentDepth <= 60) {
        // Bright turquoise sunlit surface
        grad.addColorStop(0, '#14b8a6');
        grad.addColorStop(0.5, '#06b6d4');
        grad.addColorStop(1, '#0284c7');
      } else if (currentDepth <= 150) {
        // Upper thermocline azure
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(0.6, '#0284c7');
        grad.addColorStop(1, '#1d4ed8');
      } else if (currentDepth <= 300) {
        // Lower thermocline cobalt
        grad.addColorStop(0, '#0284c7');
        grad.addColorStop(0.5, '#1d4ed8');
        grad.addColorStop(1, '#1e3a8a');
      } else if (currentDepth <= 600) {
        // Twilight mesopelagic dark indigo
        grad.addColorStop(0, '#1d4ed8');
        grad.addColorStop(0.5, '#1e1b4b');
        grad.addColorStop(1, '#0f172a');
      } else {
        // Bathypelagic Midnight Abyss
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(0.4, '#0f172a');
        grad.addColorStop(1, '#020408');
      }

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Sunlight Caustics Rays (Visible primarily in upper 0-120m)
      if (currentDepth < 140) {
        const causticsOpacity = Math.max(0, 1 - currentDepth / 130) * 0.35;
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${causticsOpacity})`;
        for (let r = 0; r < 7; r++) {
          const rayX = (width / 8) * (r + 1) + Math.sin(time * 0.8 + r) * 45;
          const rayWidth = 40 + Math.sin(time * 1.2 + r * 2) * 20;

          ctx.beginPath();
          ctx.moveTo(rayX - rayWidth / 2, 0);
          ctx.lineTo(rayX + rayWidth / 2, 0);
          ctx.lineTo(rayX + rayWidth * 1.8 + Math.cos(time + r) * 30, height * 0.85);
          ctx.lineTo(rayX - rayWidth * 1.8 + Math.cos(time + r) * 30, height * 0.85);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // 3. Floating Particles & Bubbles
      particlesRef.current.forEach((p) => {
        p.y -= p.speedY;
        p.x += p.speedX + Math.sin(time + p.y * 0.01) * 0.2;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        ctx.save();
        if (currentDepth < 200 && p.isBubble) {
          // Epipelagic bubbles
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity * 0.8})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.2})`;
          ctx.fill();
        } else {
          // Marine snow in deeper waters
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = currentDepth > 500
            ? `rgba(103, 232, 249, ${p.opacity * 0.7})` // bioluminescent glow
            : `rgba(241, 245, 249, ${p.opacity * 0.4})`;
          ctx.fill();
        }
        ctx.restore();
      });

      // 4. Render Marine Life Actors corresponding to current depth band
      actorsRef.current.forEach((actor) => {
        // Calculate visibility based on current camera depth relative to species depth range
        const depthDelta = Math.abs(currentDepth - (actor.minDepth + actor.maxDepth) / 2);
        const depthSpan = (actor.maxDepth - actor.minDepth) / 2 + 60;

        if (depthDelta > depthSpan) return; // Outside current visible depth band

        const visibility = Math.max(0, 1 - depthDelta / depthSpan);

        // Movement updates
        actor.x += actor.speed * actor.direction;
        actor.oscillation += actor.oscSpeed;
        const currentY = actor.y + Math.sin(actor.oscillation) * 12;

        // Wrap around screen boundaries
        if (actor.direction === 1 && actor.x > width + 120) {
          actor.x = -120;
          actor.y = 80 + Math.random() * (height - 200);
        } else if (actor.direction === -1 && actor.x < -120) {
          actor.x = width + 120;
          actor.y = 80 + Math.random() * (height - 200);
        }

        ctx.save();
        ctx.globalAlpha = visibility;
        ctx.translate(actor.x, currentY);

        // Flip horizontal orientation if moving left
        if (actor.direction === -1) {
          ctx.scale(-1, 1);
        }

        // Draw species silhouette based on type
        if (actor.type === 'ray') {
          // Manta Ray with flapping wings
          const wingFlap = Math.sin(actor.oscillation * 1.5) * 8;
          ctx.fillStyle = actor.color;
          ctx.beginPath();
          ctx.moveTo(35, 0);
          ctx.quadraticCurveTo(0, -35 + wingFlap, -30, -30 + wingFlap);
          ctx.lineTo(-40, 0);
          ctx.quadraticCurveTo(-20, 0, -60, 0); // long whip tail
          ctx.quadraticCurveTo(-20, 0, -40, 0);
          ctx.lineTo(-30, 30 - wingFlap);
          ctx.quadraticCurveTo(0, 35 - wingFlap, 35, 0);
          ctx.closePath();
          ctx.fill();

          // Cephalic fins
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.ellipse(38, -6, 8, 3, 0.4, 0, Math.PI * 2);
          ctx.ellipse(38, 6, 8, 3, -0.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (actor.type === 'turtle') {
          // Sea Turtle
          ctx.fillStyle = actor.color;
          // Shell
          ctx.beginPath();
          ctx.ellipse(0, 0, 24, 18, 0, 0, Math.PI * 2);
          ctx.fill();
          // Head
          ctx.beginPath();
          ctx.ellipse(28, 0, 8, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          // Flippers
          const flipperStroke = Math.sin(actor.oscillation) * 6;
          ctx.beginPath();
          ctx.ellipse(12, -22 + flipperStroke, 16, 6, -0.6, 0, Math.PI * 2);
          ctx.ellipse(12, 22 - flipperStroke, 16, 6, 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (actor.type === 'jellyfish') {
          // Rainbow Ctenophore with rainbow cilia
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
          ctx.fill();

          // Iridescent cilia bands
          const colors = ['#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'];
          colors.forEach((col, idx) => {
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 14 - idx * 2.5, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
          });
        } else if (actor.type === 'siphonophore') {
          // Giant String Siphonophore (chain of glowing bells)
          ctx.lineWidth = 3;
          ctx.strokeStyle = actor.color;
          ctx.shadowColor = actor.glowColor || '#67e8f9';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(-60, 0);
          for (let s = -50; s <= 60; s += 15) {
            const waveY = Math.sin(actor.oscillation + s * 0.1) * 8;
            ctx.lineTo(s, waveY);
          }
          ctx.stroke();
          // Glowing bell nodes
          for (let s = -50; s <= 60; s += 15) {
            const waveY = Math.sin(actor.oscillation + s * 0.1) * 8;
            ctx.beginPath();
            ctx.arc(s, waveY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#a5f3fc';
            ctx.fill();
          }
        } else if (actor.type === 'angler') {
          // Deep-Sea Anglerfish with Glowing Esca Lure
          ctx.fillStyle = '#0a0e17';
          // Body
          ctx.beginPath();
          ctx.ellipse(0, 0, 32, 24, 0, 0, Math.PI * 2);
          ctx.fill();
          // Large gaping jaw with teeth
          ctx.fillStyle = '#f8fafc';
          for (let t = -10; t <= 10; t += 5) {
            ctx.fillRect(24, t, 4, 2);
          }
          // Esca (Glowing fishing rod lure)
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(14, -20);
          ctx.quadraticCurveTo(28, -45, 42, -28);
          ctx.stroke();
          // Glowing Photophore Bulb
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#67e8f9';
          ctx.beginPath();
          ctx.arc(44, -28, 6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Standard Fish (Tuna, Flyingfish, Viperfish)
          ctx.fillStyle = actor.color;
          if (actor.glowColor && currentDepth > 300) {
            ctx.shadowColor = actor.glowColor;
            ctx.shadowBlur = 10;
          }

          ctx.beginPath();
          ctx.moveTo(25, 0);
          ctx.quadraticCurveTo(10, -14, -18, -8);
          // Tail fin wagging
          const tailWag = Math.sin(actor.oscillation * 2) * 6;
          ctx.lineTo(-30, -14 + tailWag);
          ctx.lineTo(-24, 0);
          ctx.lineTo(-30, 14 + tailWag);
          ctx.lineTo(-18, 8);
          ctx.quadraticCurveTo(10, 14, 25, 0);
          ctx.closePath();
          ctx.fill();

          // Small pectoral fin
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.ellipse(4, 3, 6, 3, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // 5. Swaying Kelp & Deep Corals at Viewport Bottom (if in photic zone < 120m)
      if (currentDepth < 100) {
        ctx.save();
        const kelpOpacity = Math.max(0, 1 - currentDepth / 90) * 0.7;
        ctx.fillStyle = `rgba(13, 148, 136, ${kelpOpacity})`;
        for (let k = 0; k < width; k += 80) {
          const sway = Math.sin(time * 1.5 + k) * 20;
          ctx.beginPath();
          ctx.moveTo(k, height);
          ctx.quadraticCurveTo(k + sway / 2, height - 60, k + sway, height - 120);
          ctx.quadraticCurveTo(k + 12 + sway / 2, height - 60, k + 20, height);
          ctx.closePath();
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
  }, [currentDepth]);

  // Click on Canvas to Interact with Marine Life
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if clicked near any active actor
    actorsRef.current.forEach((actor) => {
      const depthDelta = Math.abs(currentDepth - (actor.minDepth + actor.maxDepth) / 2);
      const depthSpan = (actor.maxDepth - actor.minDepth) / 2 + 50;
      if (depthDelta > depthSpan) return;

      const currentY = actor.y + Math.sin(actor.oscillation) * 12;
      const dist = Math.hypot(actor.x - clickX, currentY - clickY);
      if (dist < actor.size * 1.5) {
        onDiscoverSpecies(actor.speciesRef);
      }
    });
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-auto">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full block cursor-pointer"
        title="Click on swimming marine life to catalog specimens!"
      />
    </div>
  );
};
