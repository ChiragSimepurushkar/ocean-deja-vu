import React, { useState } from 'react';
import { LeaderboardEntry, Badge } from '../types';
import { BADGES_CATALOG } from '../data/oceanData';
import { Trophy, X, Medal, Award, CheckCircle, ShieldCheck, User } from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  unlockedBadgeIds: string[];
  userCallsign: string;
  onUpdateCallsign: (newCallsign: string) => void;
  userScore: number;
  maxDepthReached: number;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  entries,
  unlockedBadgeIds,
  userCallsign,
  onUpdateCallsign,
  userScore,
  maxDepthReached,
}) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'badges'>('leaderboard');
  const [editingCallsign, setEditingCallsign] = useState(false);
  const [newCallsignInput, setNewCallsignInput] = useState(userCallsign);

  if (!isOpen) return null;

  const handleSaveCallsign = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCallsignInput.trim()) {
      onUpdateCallsign(newCallsignInput.trim());
      setEditingCallsign(false);
    }
  };

  // Combine and sort entries
  const allEntries = [...entries].sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#061021] border border-cyan-800/60 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/50 bg-[#040a17]">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold text-white tracking-wide">
              North Indian Ocean Explorer Registry
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Summary Card & Tabs */}
        <div className="px-6 py-3 bg-[#030814] border-b border-cyan-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <User className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">CALLSIGN:</span>
            {editingCallsign ? (
              <form onSubmit={handleSaveCallsign} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newCallsignInput}
                  onChange={(e) => setNewCallsignInput(e.target.value)}
                  maxLength={18}
                  className="bg-slate-900 border border-cyan-500 rounded px-2 py-0.5 text-white font-mono text-xs focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 text-[11px] bg-teal-500 text-slate-950 rounded font-semibold cursor-pointer"
                >
                  Save
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <strong className="text-cyan-200 font-bold">{userCallsign}</strong>
                <button
                  onClick={() => setEditingCallsign(true)}
                  className="text-[10px] text-cyan-500 hover:underline cursor-pointer"
                >
                  [Edit]
                </button>
              </div>
            )}
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-cyan-900/60 text-cyan-200 shadow-sm border border-cyan-700/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('badges')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                activeTab === 'badges'
                  ? 'bg-cyan-900/60 text-cyan-200 shadow-sm border border-cyan-700/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Badges ({unlockedBadgeIds.length}/{BADGES_CATALOG.length})
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'leaderboard' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-12 text-[11px] font-mono uppercase text-slate-500 px-3 pb-1 border-b border-slate-800">
                <span className="col-span-1">Rank</span>
                <span className="col-span-5">Explorer Callsign</span>
                <span className="col-span-2 text-right">Max Depth</span>
                <span className="col-span-2 text-right">Badges</span>
                <span className="col-span-2 text-right">Score</span>
              </div>

              {allEntries.map((entry, idx) => {
                const isCurrentUser = entry.callsign === userCallsign || entry.isCurrentUser;

                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-12 items-center text-xs font-mono p-3 rounded-lg border transition-colors ${
                      isCurrentUser
                        ? 'bg-teal-950/40 border-teal-500/50 text-teal-200 shadow-sm'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="col-span-1 flex items-center font-bold">
                      {idx === 0 ? (
                        <Medal className="w-4 h-4 text-amber-400" />
                      ) : idx === 1 ? (
                        <Medal className="w-4 h-4 text-slate-300" />
                      ) : idx === 2 ? (
                        <Medal className="w-4 h-4 text-amber-600" />
                      ) : (
                        <span className="text-slate-500">#{idx + 1}</span>
                      )}
                    </div>

                    <div className="col-span-5 flex flex-col">
                      <span className="font-semibold text-white truncate">
                        {entry.callsign} {isCurrentUser && <span className="text-[10px] text-teal-400 font-normal">(You)</span>}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        {entry.favoriteStation}
                      </span>
                    </div>

                    <div className="col-span-2 text-right text-cyan-300 font-semibold tabular-nums">
                      {entry.maxDepth}m
                    </div>

                    <div className="col-span-2 text-right text-amber-300 tabular-nums">
                      {entry.badgesCount}
                    </div>

                    <div className="col-span-2 text-right font-bold text-white tabular-nums">
                      {entry.score}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BADGES_CATALOG.map((badge: Badge) => {
                const isUnlocked = unlockedBadgeIds.includes(badge.id);

                return (
                  <div
                    key={badge.id}
                    className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                      isUnlocked
                        ? 'bg-teal-950/30 border-teal-500/40 text-slate-100'
                        : 'bg-slate-900/30 border-slate-800/70 opacity-60 text-slate-400'
                    }`}
                  >
                    <div className="text-2xl shrink-0 p-2 rounded bg-slate-900/80 border border-slate-800">
                      {badge.icon}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-display font-semibold text-sm text-white">
                          {badge.name}
                        </h4>
                        {isUnlocked ? (
                          <span className="text-[10px] font-mono text-teal-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-teal-400" />
                            UNLOCKED
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500">
                            LOCKED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-snug">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#030814] border-t border-cyan-950/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Synced locally & Cloud Oceanographic Vault</span>
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
