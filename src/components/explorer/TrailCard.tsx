'use client';

import React from 'react';
import { ExploreTrail, DIFFICULTY_COLORS, DIFFICULTY_LABELS, DIFFICULTY_BG } from './AdventureScore';
import AdventureScore from './AdventureScore';

interface TrailCardProps {
  trail: ExploreTrail;
  selected?: boolean;
  onClick: (trail: ExploreTrail) => void;
}

export default function TrailCard({ trail, selected, onClick }: TrailCardProps) {
  const diffColor = DIFFICULTY_COLORS[trail.difficulty] || '#94a3b8';
  const diffLabel = DIFFICULTY_LABELS[trail.difficulty] || trail.difficulty;
  const diffBg = DIFFICULTY_BG[trail.difficulty] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';

  return (
    <button
      onClick={() => onClick(trail)}
      className={`w-full text-left rounded-2xl border transition-all duration-200 overflow-hidden group ${
        selected
          ? 'border-[#17402C]/60 bg-[#17402C]/8 shadow-lg shadow-[#17402C]/10'
          : 'border-white/8 bg-white/4 hover:border-white/20 hover:bg-white/6'
      }`}
    >
      {/* Difficulty bar */}
      <div className="h-0.5 w-full" style={{ backgroundColor: diffColor, opacity: selected ? 1 : 0.5 }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2 group-hover:text-white/90">
              {trail.name}
            </h3>
          </div>
          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${diffBg}`}>
            {diffLabel}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3">
          {trail.distance_km > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-white/30 text-[10px]">📏</span>
              <span className="text-white/70 text-xs font-mono">{trail.distance_km} km</span>
            </div>
          )}
          {trail.duration_hours > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-white/30 text-[10px]">⏱</span>
              <span className="text-white/70 text-xs font-mono">{trail.duration_hours}h</span>
            </div>
          )}
          {trail.elevation_gain > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-white/30 text-[10px]">⬆️</span>
              <span className="text-white/70 text-xs font-mono">+{trail.elevation_gain}m</span>
            </div>
          )}
        </div>

        {/* Adventure Score compact */}
        <AdventureScore trail={trail} compact />
      </div>
    </button>
  );
}
