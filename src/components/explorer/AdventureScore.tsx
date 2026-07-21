'use client';

import React from 'react';

export interface ExploreTrail {
  id: string;
  name: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][] | number[][][][];
  } | null;
  distance_km: number;
  duration_hours: number;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  elevation_gain: number;
  adventure_score: number;
  nature_score: number;
  panorama_score: number;
  accessibility_score: number;
  challenge_score: number;
  services_score: number;
  start_lat?: number;
  start_lng?: number;
  bbox_min_lat?: number;
  bbox_min_lng?: number;
  bbox_max_lat?: number;
  bbox_max_lng?: number;
  // Extra metadata from OSM tables
  ref?: string | null;
  network?: string | null;
  terrain_type?: string | null;
  family_friendly?: boolean | null;
  season?: string | null;
  ai_description?: string | null;
}

export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  moderate: '#f97316',
  hard: '#ef4444',
  expert: '#7c3aed',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  moderate: 'Modérée',
  hard: 'Difficile',
  expert: 'Expert',
};

export const DIFFICULTY_BG: Record<string, string> = {
  easy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  moderate: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  hard: 'bg-red-500/15 text-red-400 border-red-500/30',
  expert: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

interface AdventureScoreProps {
  trail: ExploreTrail;
  compact?: boolean;
}

export default function AdventureScore({ trail, compact = false }: AdventureScoreProps) {
  const score = trail.adventure_score;

  const scoreColor = score >= 85 ? '#22c55e' : score >= 70 ? '#f97316' : score >= 50 ? '#eab308' : '#94a3b8';

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-amber-400 text-xs">⭐</span>
        <span className="font-mono text-sm font-bold" style={{ color: scoreColor }}>
          {score}
        </span>
        <span className="text-white/30 text-xs">/100</span>
      </div>
    );
  }

  const subScores = [
    { icon: '🌲', label: 'Nature', value: trail.nature_score },
    { icon: '🏔', label: 'Panorama', value: trail.panorama_score },
    { icon: '🥾', label: 'Défi', value: trail.challenge_score },
    { icon: '💧', label: 'Services', value: trail.services_score },
  ];

  return (
    <div className="space-y-3">
      {/* Main score */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-amber-400">⭐</span>
          <span className="font-mono text-2xl font-bold" style={{ color: scoreColor }}>
            {score}
          </span>
          <span className="text-white/40 text-sm">/100</span>
        </div>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score}%`, backgroundColor: scoreColor }}
          />
        </div>
      </div>

      {/* Sub scores */}
      <div className="grid grid-cols-2 gap-2">
        {subScores.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="text-sm">{s.icon}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-white/50 font-mono uppercase tracking-wider">{s.label}</span>
                <span className="text-[10px] text-white/70 font-mono font-bold">{s.value}</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.value}%`, backgroundColor: scoreColor, opacity: 0.7 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
