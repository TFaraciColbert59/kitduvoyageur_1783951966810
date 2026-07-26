'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ExploreTrail, DIFFICULTY_COLORS, DIFFICULTY_LABELS, DIFFICULTY_BG } from './AdventureScore';
import AdventureScore from './AdventureScore';

interface TrailPanelProps {
  trail: ExploreTrail;
  onClose: () => void;
  isMobile?: boolean;
}

export default function TrailPanel({ trail, onClose, isMobile = false }: TrailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const diffLabel = DIFFICULTY_LABELS[trail.difficulty] || trail.difficulty;
  const diffBg = DIFFICULTY_BG[trail.difficulty] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  const diffColor = DIFFICULTY_COLORS[trail.difficulty] || '#94a3b8';

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const stats = [
    { icon: '📏', label: 'Distance', value: trail.distance_km > 0 ? `${trail.distance_km} km` : '—' },
    { icon: '⏱', label: 'Durée', value: trail.duration_hours > 0 ? `${trail.duration_hours}h` : '—' },
    { icon: '⬆️', label: 'Dénivelé', value: trail.elevation_gain > 0 ? `+${trail.elevation_gain}m` : '—' },
  ];

  const content = (
    <div ref={panelRef} className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-start gap-3">
          {/* Back arrow button */}
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors mt-0.5"
            aria-label="Retour"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diffBg}`}>
                {diffLabel}
              </span>
            </div>
            <h2 className="text-white font-bold text-lg leading-tight">{trail.name}</h2>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Adventure Score */}
        <div className="bg-white/8 rounded-2xl p-4 border border-white/10">
          <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest mb-3">Adventure Score</p>
          <AdventureScore trail={trail} />
        </div>

        {/* Stats grid */}
        <div>
          <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest mb-3">Informations</p>
          <div className="grid grid-cols-2 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/8 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{s.icon}</span>
                  <span className="text-[10px] text-white/50 font-mono uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="text-white font-mono font-bold text-sm">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty bar */}
        <div className="bg-white/8 rounded-xl p-3 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/50 font-mono uppercase tracking-wider">Difficulté</span>
            <span className="text-sm font-bold" style={{ color: diffColor }}>{diffLabel}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: trail.difficulty === 'easy' ? '25%' : trail.difficulty === 'moderate' ? '50%' : trail.difficulty === 'hard' ? '75%' : '100%',
                backgroundColor: diffColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-white/10">
        <Link
          href={`/ai-configurator?trail=${encodeURIComponent(trail.name)}&difficulty=${trail.difficulty}&distance=${trail.distance_km}&elevation=${trail.elevation_gain}`}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#E4501C] hover:bg-[#cc3d10] text-white font-semibold text-sm transition-all duration-200 hover:shadow-lg hover:shadow-[#E4501C]/25 active:scale-[0.98]"
        >
          <span>🎒</span>
          Préparer cette aventure
        </Link>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[2000] max-h-[85vh] bg-[#0f1a16] border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0f1a16] flex flex-col">
      {content}
    </div>
  );
}
