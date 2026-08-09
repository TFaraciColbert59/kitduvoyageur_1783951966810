'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface HighlightItem {
  icon: string;
  title: string;
  subtitle: string;
}

interface CompletionViewProps {
  routeName?: string | null;
  dateStr?: string;
  timeRangeStr?: string;
  distanceKm?: number | null;
  durationSeconds?: number | null;
  elevationGainM?: number | null;
  averageSpeedKmH?: number | null;
  maxAltitudeM?: number | null;
  highlights?: HighlightItem[];
  onViewCarnet: () => void;
  onShare?: () => void;
  onEditCarnet?: () => void;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}m`;
}

export default function CompletionView({
  routeName = null,
  dateStr,
  timeRangeStr,
  distanceKm = 0,
  durationSeconds = 0,
  elevationGainM = null,
  averageSpeedKmH = null,
  maxAltitudeM = null,
  highlights = [],
  onViewCarnet,
  onShare,
  onEditCarnet,
}: CompletionViewProps) {
  const displayDate = dateStr || new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const displayTimeRange = timeRangeStr || '';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-[#17402C] via-[#0B1F17] to-[#06120C] text-white overflow-y-auto select-none flex flex-col items-center py-10 px-4"
    >
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_20%,rgba(168,200,160,0.25)_0%,transparent_60%)]" />

      <div className="relative z-10 w-full max-w-md space-y-6 my-auto">
        {/* Celebration Badge Icon */}
        <div className="relative w-24 h-24 rounded-full mx-auto bg-gradient-to-br from-[#A8C8A0] to-[#C6DCBE] text-[#06120C] flex items-center justify-center shadow-[0_0_50px_rgba(168,200,160,0.4)]">
          <svg className="w-11 h-11 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l3-9h12l3 9M6 12l6-8 6 8M9 17l2 2 4-4" />
          </svg>
          <div className="absolute -inset-1.5 rounded-full border-2 border-dashed border-[#C6DCBE]/40" />
        </div>

        {/* Header Titles */}
        <div className="text-center space-y-1">
          <div className="font-mono text-[10px] tracking-[0.24em] uppercase text-[#C6DCBE]">
            Randonnée · terminée
          </div>
          <h1 className="text-3xl font-medium tracking-tight leading-tight">
            {routeName || 'Randonnée'} <br />
            <em className="font-serif italic font-normal text-[#C6DCBE]">c&apos;est fait.</em>
          </h1>
          <p className="font-mono text-xs text-white/70 tracking-wider">
            {displayDate}
            {displayTimeRange ? ` · ${displayTimeRange}` : ''}
          </p>
        </div>

        {/* 4-Stat Overview Grid */}
        <div className="bg-white/5 border border-[#C6DCBE]/15 rounded-2xl p-1 grid grid-cols-2 gap-[1px]">
          <div className="p-3.5 border-r border-b border-[#C6DCBE]/10">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#C6DCBE]/70">
              Distance
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {distanceKm != null ? distanceKm.toFixed(1) : '—'}{' '}
              <em className="font-serif italic font-normal text-sm text-[#A8C8A0]">km</em>
            </div>
            <div className="font-mono text-[9px] text-white/50 mt-0.5">Parcours complet</div>
          </div>

          <div className="p-3.5 border-b border-[#C6DCBE]/10">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#C6DCBE]/70">
              Dénivelé +
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              +{elevationGainM != null ? Math.round(elevationGainM) : '—'}{' '}
              <em className="font-serif italic font-normal text-sm text-[#A8C8A0]">m</em>
            </div>
            <div className="font-mono text-[9px] text-white/50 mt-0.5">
              Max · {maxAltitudeM != null ? Math.round(maxAltitudeM) : '—'} m
            </div>
          </div>

          <div className="p-3.5 border-r border-[#C6DCBE]/10">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#C6DCBE]/70">
              Durée
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {formatDuration(durationSeconds)}
            </div>
            <div className="font-mono text-[9px] text-white/50 mt-0.5">Avec pauses</div>
          </div>

          <div className="p-3.5">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#C6DCBE]/70">
              Allure moyenne
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {(averageSpeedKmH != null && averageSpeedKmH > 0 ? averageSpeedKmH : 0).toFixed(1)}{' '}
              <em className="font-serif italic font-normal text-sm text-[#A8C8A0]">km/h</em>
            </div>
            <div className="font-mono text-[9px] text-white/50 mt-0.5">Rythme régulier</div>
          </div>
        </div>

        {/* Mini Elevation Track Card */}
        <div className="h-32 rounded-2xl border border-[#C6DCBE]/15 bg-gradient-to-br from-[#2D6B4A]/40 to-[#06120C]/60 relative overflow-hidden p-3 flex flex-col justify-between">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 380 140" preserveAspectRatio="none">
            <g fill="none" stroke="#C6DCBE" strokeWidth="0.5" opacity="0.25">
              <path d="M0,120 Q80,80 160,90 T340,60 T400,50" />
              <ellipse cx="200" cy="70" rx="120" ry="35" />
            </g>
            <path
              d="M30,120 Q80,90 130,80 T220,55 T290,35 L340,25"
              fill="none"
              stroke="#A8C8A0"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx="30" cy="120" r="4" fill="#C6DCBE" />
            <circle cx="340" cy="25" r="5" fill="#A8C8A0" stroke="#06120C" strokeWidth="2" />
          </svg>
          <div className="relative z-10 self-start px-2.5 py-1 rounded-full bg-[#06120C]/80 backdrop-blur-md font-mono text-[10px] text-[#A8C8A0] tracking-wider border border-[#C6DCBE]/10">
            {maxAltitudeM != null ? `${Math.round(maxAltitudeM)} M · ` : ''}{(routeName || 'RANDONNÉE').toUpperCase()}
          </div>
        </div>

        {/* Highlights Section */}
        {highlights && highlights.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#A8C8A0]">
              Moments forts · {highlights.length}
            </h3>
            <div className="space-y-2">
              {highlights.map((hl, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white/5 border border-[#C6DCBE]/10 rounded-2xl flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#A8C8A0] text-[#06120C] flex items-center justify-center text-lg flex-shrink-0 font-bold">
                    {hl.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                      {hl.title}
                    </div>
                    <div className="font-mono text-[10px] text-white/60 tracking-wide mt-0.5 truncate">
                      {hl.subtitle}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main CTA Button: Voir mon aventure */}
        <button
          onClick={onViewCarnet}
          className="w-full py-4 bg-[#A8C8A0] text-[#06120C] font-semibold text-sm rounded-2xl shadow-xl flex items-center justify-between px-5 transition-transform active:scale-98"
        >
          <span>
            Voir mon <em className="font-serif italic font-normal text-[#17402C]">aventure</em>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px] opacity-75 uppercase">CARNET GÉNÉRÉ</span>
            <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </button>

        {/* Secondary Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onShare}
            className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-[#C6DCBE]/15 rounded-xl font-medium text-xs text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <span>🔗</span> Partager
          </button>
          <button
            onClick={onEditCarnet || onViewCarnet}
            className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-[#C6DCBE]/15 rounded-xl font-medium text-xs text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <span>📝</span> Éditer le carnet
          </button>
        </div>
      </div>
    </motion.div>
  );
}
