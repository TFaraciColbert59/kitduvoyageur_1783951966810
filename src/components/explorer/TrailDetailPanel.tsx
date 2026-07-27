'use client';

import React, { useEffect } from 'react';
import type { MapTrail } from './types';
import {
  getTrailImage,
  getDifficultyColor,
  getDifficultyLabel,
  formatDistance,
  formatDuration,
} from './types';

interface Props {
  trail: MapTrail;
  onClose: () => void;
}

const SCORE_LABELS: { key: keyof MapTrail; label: string; icon: string }[] = [
  { key: 'adventure_score', label: 'Aventure', icon: '⛰️' },
  { key: 'nature_score', label: 'Nature', icon: '🌿' },
  { key: 'panorama_score', label: 'Panorama', icon: '🔭' },
];

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-[#E8E4D8] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 bg-[#F5F2EA] rounded-xl py-3 px-2 text-center">
      <div className="text-[#1C2620]">{icon}</div>
      <span className="text-[10px] text-[#7A8A7D] font-mono uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold text-[#1C2620] leading-tight">{value}</span>
    </div>
  );
}

export default function TrailDetailPanel({ trail, onClose }: Props) {
  const imgUrl = getTrailImage(trail.id);
  const diffColor = getDifficultyColor(trail.difficulty);
  const diffLabel = getDifficultyLabel(trail.difficulty);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[600] bg-black/30 backdrop-blur-[2px] animate-fadeIn"
        onClick={onClose}
      />

      {/* Panel — slides in from right */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[420px] z-[700] flex flex-col bg-white shadow-2xl animate-slideInRight overflow-hidden">
        {/* Hero image */}
        <div className="relative w-full h-52 flex-shrink-0 bg-[#E7E3D6]">
          <img
            src={imgUrl}
            alt={trail.name}
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Difficulty badge */}
          <div
            className="absolute top-4 left-4 px-2.5 py-1 rounded-full text-white text-xs font-bold shadow"
            style={{ backgroundColor: diffColor }}
          >
            {diffLabel}
          </div>

          {/* Trail name over image */}
          <div className="absolute bottom-4 left-4 right-12">
            <h2 className="text-white font-bold text-lg leading-tight drop-shadow-lg line-clamp-3">
              {trail.name}
            </h2>
            {trail.terrain_type && (
              <p className="text-white/75 text-xs mt-0.5">{trail.terrain_type}{trail.ref ? ` · ${trail.ref}` : ''}</p>
            )}
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Quick stats chips */}
          <div className="flex gap-2 p-4">
            <InfoChip
              icon={
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                </svg>
              }
              label="Distance"
              value={formatDistance(trail.distance_km)}
            />
            <InfoChip
              icon={
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              }
              label="Durée"
              value={formatDuration(trail.duration_hours)}
            />
            <InfoChip
              icon={
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="17 3 21 3 21 7" /><polyline points="10 14 21 3" />
                  <polyline points="21 16 21 21 16 21" /><polyline points="3 21 3 3" />
                </svg>
              }
              label="Dénivelé"
              value={trail.elevation_gain !== null && trail.elevation_gain !== undefined ? `+${trail.elevation_gain} m` : '—'}
            />
          </div>

          {/* Separator */}
          <div className="h-px bg-[#E8E4D8] mx-4" />

          {/* Tags */}
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {trail.season && (
              <span className="px-2.5 py-1 bg-[#F5F2EA] text-[#3A4A3D] text-xs rounded-full border border-[#E4E0D4]">
                📅 {trail.season}
              </span>
            )}
            {trail.family_friendly && (
              <span className="px-2.5 py-1 bg-[#EDF7F0] text-[#2D6A4F] text-xs rounded-full border border-[#B7E4C7]">
                👨‍👩‍👧 Famille
              </span>
            )}
            {trail.network && (
              <span className="px-2.5 py-1 bg-[#F5F2EA] text-[#3A4A3D] text-xs rounded-full border border-[#E4E0D4] font-mono uppercase">
                {trail.network}
              </span>
            )}
          </div>

          {/* AI Description */}
          {trail.ai_description && (
            <>
              <div className="h-px bg-[#E8E4D8] mx-4" />
              <div className="px-4 py-4">
                <h3 className="text-xs font-bold text-[#1C2620] uppercase tracking-widest mb-2">Description</h3>
                <p className="text-sm text-[#5A6A5D] leading-relaxed">{trail.ai_description}</p>
              </div>
            </>
          )}

          {/* Scores */}
          {SCORE_LABELS.some((s) => trail[s.key] !== null && trail[s.key] !== undefined) && (
            <>
              <div className="h-px bg-[#E8E4D8] mx-4" />
              <div className="px-4 py-4">
                <h3 className="text-xs font-bold text-[#1C2620] uppercase tracking-widest mb-3">Scores</h3>
                <div className="space-y-3">
                  {SCORE_LABELS.map((s) => {
                    const val = trail[s.key] as number | null | undefined;
                    if (val === null || val === undefined) return null;
                    const pct = Math.round(val);
                    return (
                      <div key={s.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#5A6A5D]">
                            {s.icon} {s.label}
                          </span>
                          <span className="text-xs font-bold text-[#1C2620]">{pct}/100</span>
                        </div>
                        <ScoreBar value={pct} color={pct >= 70 ? '#22c55e' : pct >= 40 ? '#f97316' : '#ef4444'} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Bottom padding */}
          <div className="h-6" />
        </div>

        {/* Footer CTA */}
        <div className="flex-shrink-0 p-4 border-t border-[#E8E4D8] bg-white">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#1C2620] text-white text-sm font-semibold rounded-xl hover:bg-[#2D3F35] active:scale-[0.98] transition-all"
          >
            Retour à la carte
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease; }
        .animate-slideInRight { animation: slideInRight 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
      `}</style>
    </>
  );
}
