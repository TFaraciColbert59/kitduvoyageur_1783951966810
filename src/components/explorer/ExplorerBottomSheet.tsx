'use client';

import React, { useRef } from 'react';
import type { ExploreTrail } from './AdventureScore';
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from './AdventureScore';

interface ExplorerBottomSheetProps {
  trails: ExploreTrail[];
  loading: boolean;
  expanded: boolean;
  onExpandChange: (v: boolean) => void;
  onTrailSelect: (trail: ExploreTrail) => void;
  selectedTrailId: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  easy: '🥾',
  moderate: '⛰',
  hard: '🏔',
  expert: '🧗',
};

export default function ExplorerBottomSheet({
  trails,
  loading,
  expanded,
  onExpandChange,
  onTrailSelect,
  selectedTrailId,
}: ExplorerBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartExpanded = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartExpanded.current = expanded;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = dragStartY.current - e.changedTouches[0].clientY;
    if (delta > 40) onExpandChange(true);
    else if (delta < -40) onExpandChange(false);
    dragStartY.current = null;
  };

  return (
    <div
      ref={sheetRef}
      className={`absolute left-0 right-0 bottom-0 z-[1200] transition-all duration-500 ease-out`}
      style={{
        height: expanded ? '75vh' : '30vh',
        minHeight: expanded ? '300px' : '160px',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sheet background */}
      <div className="absolute inset-0 bg-[#0d1a12]/95 backdrop-blur-2xl border-t border-[#2D5A27]/25 rounded-t-3xl shadow-2xl" />

      {/* Drag handle */}
      <div className="relative z-10 flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
        <div className="w-10 h-1 bg-[#2D5A27]/50 rounded-full" />
      </div>

      {/* Header */}
      <div className="relative z-10 px-5 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base leading-tight">Explorer autour de vous</h2>
          <p className="text-[#8BAF7C]/50 text-xs mt-0.5">
            {loading ? 'Chargement…' : `${trails.length} aventures disponibles`}
          </p>
        </div>
        <button
          onClick={() => onExpandChange(!expanded)}
          className="w-8 h-8 rounded-xl bg-[#2D5A27]/20 border border-[#2D5A27]/30 flex items-center justify-center transition-all active:scale-95"
        >
          <svg
            className={`w-4 h-4 text-[#8BAF7C] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-hidden" style={{ height: 'calc(100% - 90px)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-[#2D5A27]/30 border-t-[#2D5A27] rounded-full animate-spin" />
          </div>
        ) : expanded ? (
          /* Expanded: vertical scrollable list */
          <div className="h-full overflow-y-auto px-4 pb-8 space-y-3">
            {trails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <span className="text-4xl">🗺</span>
                <p className="text-[#8BAF7C]/40 text-sm text-center">Aucune aventure trouvée</p>
              </div>
            ) : (
              trails.map((trail) => (
                <AdventureListCard
                  key={trail.id}
                  trail={trail}
                  selected={selectedTrailId === trail.id}
                  onClick={onTrailSelect}
                />
              ))
            )}
          </div>
        ) : (
          /* Collapsed: horizontal scroll */
          <div className="h-full overflow-x-auto overflow-y-hidden px-4 pb-4">
            <div className="flex gap-3 h-full items-start pt-1" style={{ width: 'max-content' }}>
              {trails.length === 0 && !loading ? (
                <div className="flex items-center justify-center w-64 h-24">
                  <p className="text-[#8BAF7C]/40 text-sm">Aucune aventure trouvée</p>
                </div>
              ) : (
                trails.slice(0, 20).map((trail) => (
                  <AdventureHorizontalCard
                    key={trail.id}
                    trail={trail}
                    selected={selectedTrailId === trail.id}
                    onClick={onTrailSelect}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdventureHorizontalCard({
  trail,
  selected,
  onClick,
}: {
  trail: ExploreTrail;
  selected: boolean;
  onClick: (t: ExploreTrail) => void;
}) {
  const diffColor = DIFFICULTY_COLORS[trail.difficulty] || '#94a3b8';
  const diffLabel = DIFFICULTY_LABELS[trail.difficulty] || trail.difficulty;
  const icon = TYPE_ICONS[trail.difficulty] || '🥾';

  return (
    <button
      onClick={() => onClick(trail)}
      className={`flex-shrink-0 w-52 rounded-2xl border overflow-hidden text-left transition-all duration-200 active:scale-[0.97] ${
        selected
          ? 'border-[#4A8A3F]/80 bg-[#2D5A27]/20 shadow-lg shadow-[#2D5A27]/20'
          : 'border-[#2D5A27]/20 bg-[#111f14]/80 hover:border-[#2D5A27]/50'
      }`}
    >
      {/* Gradient image area */}
      <div
        className="h-28 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${diffColor}22 0%, #0d1a1280 100%)`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl opacity-60">{icon}</span>
        </div>
        {/* Difficulty badge */}
        <div className="absolute top-2 right-2">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${diffColor}25`, color: diffColor, border: `1px solid ${diffColor}40` }}
          >
            {diffLabel}
          </span>
        </div>
        {/* Score */}
        {trail.adventure_score > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <span className="text-amber-400 text-[10px]">⭐</span>
            <span className="text-white text-[10px] font-mono font-bold">{trail.adventure_score}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-white font-semibold text-xs leading-tight line-clamp-2 mb-2">
          {trail.name}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {trail.distance_km > 0 && (
            <span className="text-[#8BAF7C]/60 text-[10px] font-mono">{trail.distance_km} km</span>
          )}
          {trail.duration_hours > 0 && (
            <span className="text-[#8BAF7C]/60 text-[10px] font-mono">{trail.duration_hours}h</span>
          )}
          {trail.elevation_gain > 0 && (
            <span className="text-[#8BAF7C]/60 text-[10px] font-mono">+{trail.elevation_gain}m</span>
          )}
        </div>
      </div>
    </button>
  );
}

function AdventureListCard({
  trail,
  selected,
  onClick,
}: {
  trail: ExploreTrail;
  selected: boolean;
  onClick: (t: ExploreTrail) => void;
}) {
  const diffColor = DIFFICULTY_COLORS[trail.difficulty] || '#94a3b8';
  const diffLabel = DIFFICULTY_LABELS[trail.difficulty] || trail.difficulty;
  const icon = TYPE_ICONS[trail.difficulty] || '🥾';

  return (
    <button
      onClick={() => onClick(trail)}
      className={`w-full rounded-2xl border overflow-hidden text-left transition-all duration-200 active:scale-[0.99] flex ${
        selected
          ? 'border-[#4A8A3F]/80 bg-[#2D5A27]/15'
          : 'border-[#2D5A27]/20 bg-[#111f14]/60 hover:border-[#2D5A27]/40'
      }`}
    >
      {/* Icon area */}
      <div
        className="w-20 flex-shrink-0 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${diffColor}18 0%, transparent 100%)` }}
      >
        <span className="text-3xl">{icon}</span>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-white font-semibold text-sm leading-tight line-clamp-1 flex-1">{trail.name}</h3>
          <span
            className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${diffColor}20`, color: diffColor, border: `1px solid ${diffColor}35` }}
          >
            {diffLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {trail.distance_km > 0 && (
            <span className="text-[#8BAF7C]/55 text-[10px] font-mono">{trail.distance_km} km</span>
          )}
          {trail.duration_hours > 0 && (
            <span className="text-[#8BAF7C]/55 text-[10px] font-mono">{trail.duration_hours}h</span>
          )}
          {trail.elevation_gain > 0 && (
            <span className="text-[#8BAF7C]/55 text-[10px] font-mono">+{trail.elevation_gain}m</span>
          )}
          {trail.adventure_score > 0 && (
            <span className="text-amber-400/70 text-[10px] font-mono ml-auto">⭐ {trail.adventure_score}</span>
          )}
        </div>
      </div>
    </button>
  );
}
