import React from 'react';
import { MarineSpecies } from '../types';
import { MARINE_SPECIES_CATALOG } from '../data/oceanData';
import { Fish, X, Sparkles, Check, Lock } from 'lucide-react';

interface SpeciesCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  discoveredSpeciesIds: string[];
}

export const SpeciesCatalogModal: React.FC<SpeciesCatalogModalProps> = ({
  isOpen,
  onClose,
  discoveredSpeciesIds,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#061021] border border-cyan-800/60 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/50 bg-[#040a17]">
          <div className="flex items-center gap-2">
            <Fish className="w-5 h-5 text-cyan-400" />
            <h2 className="font-display text-lg font-bold text-white tracking-wide">
              North Indian Ocean Marine Taxonomy Log
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress stats */}
        <div className="px-6 py-3 bg-[#030814] border-b border-cyan-950 flex items-center justify-between text-xs font-mono text-slate-400">
          <div>
            Discovered: <strong className="text-teal-300 font-bold tabular-nums">{discoveredSpeciesIds.length}</strong> / {MARINE_SPECIES_CATALOG.length} Pelagic Species
          </div>
          <div className="text-[11px] text-cyan-400">
            Tip: Click swimming creatures in dive mode to discover them
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MARINE_SPECIES_CATALOG.map((species: MarineSpecies) => {
            const isDiscovered = discoveredSpeciesIds.includes(species.id);

            return (
              <div
                key={species.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  isDiscovered
                    ? 'bg-[#08152c]/80 border-cyan-700/60 text-slate-100 shadow-md'
                    : 'bg-slate-900/30 border-slate-800/60 opacity-60 text-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="font-display font-bold text-base text-white">
                      {isDiscovered ? species.name : 'Unknown Specimen'}
                    </h4>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-cyan-900">
                      {species.rarity}
                    </span>
                  </div>

                  <div className="text-xs font-mono text-cyan-400 italic mb-2">
                    {isDiscovered ? species.scientificName : 'Catalog pending in-situ visual contact'}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isDiscovered
                      ? species.description
                      : `Encounter this creature between ${species.depthRange} in the water column.`}
                  </p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-cyan-950 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">
                    Depth: <strong className="text-cyan-300">{species.depthRange}</strong>
                  </span>

                  <div className="flex items-center gap-1 text-teal-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+{species.points} PTS</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#030814] border-t border-cyan-950/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-800 rounded cursor-pointer text-xs font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
