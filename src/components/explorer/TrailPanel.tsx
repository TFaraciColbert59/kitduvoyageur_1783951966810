'use client';

import React, { useEffect, useRef } from 'react';
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
    { icon: '🗺', label: 'Terrain', value: trail.terrain_type || '—' },
  ];

  const pois = [
    { show: trail.water, icon: '💧', label: "Point d'eau" },
    { show: trail.refuge, icon: '🏕', label: 'Refuge' },
    { show: trail.camping, icon: '⛺', label: 'Camping' },
    { show: trail.viewpoint, icon: '📷', label: 'Panorama' },
    { show: trail.peak, icon: '▲', label: 'Sommet' },
    { show: trail.parking, icon: '🅿️', label: 'Parking' },
  ].filter((p) => p.show);

  const content = (
    <div ref={panelRef} className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diffBg}`}>
                {diffLabel}
              </span>
              {trail.family_friendly && (
                <span className="text-[10px] text-emerald-400/70 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  👨‍👩‍👧 Famille
                </span>
              )}
            </div>
            <h2 className="text-white font-bold text-lg leading-tight">{trail.name}</h2>
            {trail.season && (
              <p className="text-white/35 text-xs font-mono mt-1">🗓 {trail.season}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
            aria-label="Fermer"
          >
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Adventure Score */}
        <div className="bg-white/4 rounded-2xl p-4 border border-white/8">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">Adventure Score</p>
          <AdventureScore trail={trail} />
        </div>

        {/* AI Description */}
        {trail.ai_description && (
          <div className="bg-[#E4501C]/6 rounded-2xl p-4 border border-[#E4501C]/15">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs">✨</span>
              <p className="text-[10px] font-mono text-[#E4501C]/60 uppercase tracking-widest">Description</p>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">{trail.ai_description}</p>
          </div>
        )}

        {/* Stats grid */}
        <div>
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">Informations</p>
          <div className="grid grid-cols-2 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/4 rounded-xl p-3 border border-white/6">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{s.icon}</span>
                  <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="text-white font-mono font-bold text-sm">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty bar */}
        <div className="bg-white/4 rounded-xl p-3 border border-white/6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">Difficulté</span>
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

        {/* POI */}
        {pois.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">Points d&apos;intérêt</p>
            <div className="flex flex-wrap gap-2">
              {pois.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/4 border border-white/8 rounded-xl"
                >
                  <span className="text-sm">{p.icon}</span>
                  <span className="text-white/60 text-xs">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-white/8">
        <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#E4501C] hover:bg-[#cc3d10] text-white font-semibold text-sm transition-all duration-200 hover:shadow-lg hover:shadow-[#E4501C]/25 active:scale-[0.98]">
          <span>🎒</span>
          Préparer cette aventure
        </button>
        <p className="text-center text-[10px] text-white/20 font-mono mt-2">Bientôt disponible</p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[2000] max-h-[85vh] bg-[#0f1a16]/98 border-t border-white/10 rounded-t-3xl shadow-2xl backdrop-blur-md flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0f1a16]/98 border-l border-white/8 flex flex-col backdrop-blur-md">
      {content}
    </div>
  );
}
