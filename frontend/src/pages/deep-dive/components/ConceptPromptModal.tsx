import React, { useState } from 'react';
import { Sparkles, X, Copy, Check, Eye } from 'lucide-react';

interface ConceptPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PromptItem {
  id: string;
  title: string;
  scenario: string;
  aspectRatio: string;
  recommendedModel: string;
  prompt: string;
  negativePrompt: string;
}

const CONCEPT_PROMPTS: PromptItem[] = [
  {
    id: 'prompt-1',
    title: '1. Top-Down North Indian Ocean 3D/2D Satellite Bathymetric Map',
    scenario: 'Start Screen: Cartographic overview showing the Arabian Sea, Indian Subcontinent, and Bay of Bengal with pulsing sensor nodes.',
    aspectRatio: '16:9',
    recommendedModel: 'Imagen 3 / Midjourney v6',
    prompt:
      'Top-down aerial satellite and 3D bathymetric cartography map of the North Indian Ocean encompassing the Arabian Sea, the Indian subcontinent coastlines, the Bay of Bengal, Sri Lanka, and the Maldives and Andaman archipelagos. Visible glowing turquoise and cyan oceanic current vectors, deep midnight navy ocean trenches, glowing telemetry radar rings marking research stations. Dark cinematic sci-fi mission control aesthetic, high-resolution cartographic topography, crisp coastline relief, clean isometric lighting, 8k render.',
    negativePrompt:
      'cartoonish, blurry, low resolution, messy text, crowded labels, bright pastel neon, generic world map.',
  },
  {
    id: 'prompt-2',
    title: '2. Hydraulic Splashdown into Sunlit Photic Zone (0m – 50m)',
    scenario: 'Transition: The moment the player dives into the water surface with shockwave ripples and sunlit caustics.',
    aspectRatio: '16:9',
    recommendedModel: 'Imagen 3 / Midjourney v6',
    prompt:
      'Cinematic first-person perspective splashing directly into crystal clear turquoise ocean water, golden sunlight caustics dancing dynamically across rippling water waves, underwater bubbles rising from camera entry point. In the midground, graceful silhouettes of an oceanic manta ray and schools of shimmering yellowfin tuna gliding past healthy coral reef shelves. Vivid tropical cyan to deep azure gradient, natural water refraction, National Geographic underwater documentary cinematography, 8k resolution, photorealistic.',
    negativePrompt:
      'murky, muddy brown, plastic textures, oversaturated anime style, floating garbage, dark void, distortion.',
  },
  {
    id: 'prompt-3',
    title: '3. Sci-Fi Submersible HUD in the 1000m Midnight Abyss',
    scenario: 'Deep Dive: At 1000 meters in the bathypelagic zone with glowing deep-sea organisms and telemetry instrument glassmorphism.',
    aspectRatio: '16:9',
    recommendedModel: 'Imagen 3 / Midjourney v6',
    prompt:
      'First-person view from a high-tech deep ocean scientific submersible cockpit gazing into the pitch-black 1000-meter bathypelagic abyss. Directly ahead in the dark waters swims a massive deep-sea humpback anglerfish with a brilliant bioluminescent cyan and amber glowing esca lure, accompanied by floating glowing siphonophores and drifting iridescent marine snow particles. Holographic floating frosted glass instrument HUD panels around the viewport edge displaying digital monospace telemetry: "DEPTH: 1000m", "IN-SITU TEMP: 5.4°C", "PRESSURE: 101 ATM", sci-fi oceanic exploration atmosphere, cinematic lighting, 8k octane render.',
    negativePrompt:
      'bright sunny water, daytime, low resolution, blurry HUD, clumsy text, plastic toys, unrealistic fish.',
  },
  {
    id: 'prompt-4',
    title: '4. 2D Stratified Ocean Temperature Curtain & D20 Thermocline',
    scenario: 'Scientific Transect: Cutaway cross-section of the North Indian Ocean showing stratified layers from 0 to 1000m.',
    aspectRatio: '16:9',
    recommendedModel: 'Imagen 3 / Midjourney v6',
    prompt:
      'Scientific 2D cutaway cross-section diagram of the North Indian Ocean vertical water column, revealing 15 stratified depth layers from 0m down to 1000m. Color gradient shifting smoothly from bright tropical turquoise at the sunlit surface mixed layer, through vivid cobalt blue across the steep D20 thermocline barrier, down into pitch abyssal navy. Crisp glowing isotherm lines, floating ARGO sensor probe silhouettes, clean scientific data telemetry overlay, elegant museum educational graphics, sleek minimalist aesthetic.',
    negativePrompt:
      'cluttered diagrams, handwritten text, messy graphs, pixelated lines, neon cartoon badges.',
  }
];

export const ConceptPromptModal: React.FC<ConceptPromptModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#061021] border border-cyan-800/60 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/50 bg-[#040a17]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-display text-lg font-bold text-white tracking-wide">
                Advance Visual Concept Generation Prompts
              </h2>
              <p className="text-xs text-slate-400">
                Tailored prompts for generating cinematic concept artwork in Gemini Imagen 3 or Midjourney v6
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Prompts */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {CONCEPT_PROMPTS.map((item) => {
            const isCopied = copiedId === item.id;

            return (
              <div
                key={item.id}
                className="bg-[#08152c]/90 border border-cyan-900/60 rounded-xl p-5 shadow-lg space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-950 pb-2">
                  <h3 className="font-display font-bold text-white text-base">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <span>Aspect: {item.aspectRatio}</span>
                    <span className="text-slate-600">·</span>
                    <span>{item.recommendedModel}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300">
                  <strong className="text-teal-300">Scene Purpose:</strong> {item.scenario}
                </p>

                <div className="relative bg-[#020612] border border-cyan-950 rounded-lg p-3 text-xs font-mono text-cyan-200/90 leading-relaxed">
                  <div className="text-[10px] uppercase text-slate-500 mb-1">Prompt:</div>
                  "{item.prompt}"
                </div>

                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className="text-[11px] text-slate-400 truncate">
                    Negative prompt: {item.negativePrompt}
                  </div>

                  <button
                    onClick={() => handleCopy(item.id, item.prompt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded transition-colors cursor-pointer shrink-0"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-slate-950" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-950" />
                        <span>Copy Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#030814] border-t border-cyan-950/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Ready to paste directly into Imagen, Midjourney, or Stable Diffusion</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-800 rounded cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
