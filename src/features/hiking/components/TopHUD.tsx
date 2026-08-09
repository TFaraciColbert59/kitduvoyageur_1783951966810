'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface TopHUDProps {
  distanceKm: number;
  routeTotalKm?: number | null;
  durationSeconds: number;
  elevationGainM?: number | null;
  progressPercent?: number | null;
  routeName?: string | null;
  batteryLevel?: number | null;
  weatherTempC?: number | null;
  weatherCondition?: string | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export default function TopHUD({
  distanceKm,
  routeTotalKm,
  durationSeconds,
  elevationGainM,
  progressPercent,
  routeName,
  batteryLevel,
  weatherTempC,
  weatherCondition,
}: TopHUDProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-[#0d1a12]/92 backdrop-blur-xl border-b border-[#2D5A27]/30 px-4 pt-3 pb-3 text-white shadow-2xl"
    >
      {/* Route title & Status badges */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#4E9F3D] animate-pulse flex-shrink-0" />
          <p className="font-semibold text-xs text-[#A3C4A3] truncate font-serif italic">
            {routeName || 'Randonnée Active'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {weatherTempC != null && (
            <span className="text-[11px] font-mono text-[#A3C4A3] bg-[#17402C]/60 px-2 py-0.5 rounded-full border border-[#2D5A27]/30">
              {weatherCondition || '☀️'} {weatherTempC}°C
            </span>
          )}
          {batteryLevel != null && (
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
              batteryLevel <= 20
                ? 'text-red-400 bg-red-950/60 border-red-500/40 animate-pulse'
                : 'text-[#A3C4A3] bg-[#17402C]/60 border-[#2D5A27]/30'
            }`}>
              🔋 {batteryLevel}%
            </span>
          )}
        </div>
      </div>

      {/* Main Stats Grid — 4 Columns */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {/* Distance */}
        <div className="bg-[#17402C]/40 border border-[#2D5A27]/30 rounded-xl p-2 flex flex-col justify-center">
          <span className="text-[10px] text-[#A3C4A3] font-mono uppercase tracking-widest">Distance</span>
          <span className="font-bold text-sm sm:text-base font-mono text-white leading-tight mt-0.5">
            {formatDistance(distanceKm)}
          </span>
          {routeTotalKm && (
            <span className="text-[9px] text-[#A3C4A3]/70 font-mono">
              / {formatDistance(routeTotalKm)}
            </span>
          )}
        </div>

        {/* Temps */}
        <div className="bg-[#17402C]/40 border border-[#2D5A27]/30 rounded-xl p-2 flex flex-col justify-center">
          <span className="text-[10px] text-[#A3C4A3] font-mono uppercase tracking-widest">Temps</span>
          <span className="font-bold text-sm sm:text-base font-mono text-white leading-tight mt-0.5">
            {formatDuration(durationSeconds)}
          </span>
        </div>

        {/* Dénivelé */}
        <div className="bg-[#17402C]/40 border border-[#2D5A27]/30 rounded-xl p-2 flex flex-col justify-center">
          <span className="text-[10px] text-[#A3C4A3] font-mono uppercase tracking-widest">Dénivelé</span>
          <span className="font-bold text-sm sm:text-base font-mono text-[#4E9F3D] leading-tight mt-0.5">
            {elevationGainM != null ? `+${Math.round(elevationGainM)} m` : '—'}
          </span>
        </div>

        {/* Progression */}
        <div className="bg-[#17402C]/40 border border-[#2D5A27]/30 rounded-xl p-2 flex flex-col justify-center">
          <span className="text-[10px] text-[#A3C4A3] font-mono uppercase tracking-widest">Progrès</span>
          <span className="font-bold text-sm sm:text-base font-mono text-white leading-tight mt-0.5">
            {progressPercent != null ? `${Math.round(progressPercent)}%` : '—'}
          </span>
        </div>
      </div>

      {/* Barre de progression visuelle */}
      {progressPercent != null && (
        <div className="w-full bg-[#17402C]/50 h-1.5 rounded-full mt-2.5 overflow-hidden border border-[#2D5A27]/20">
          <motion.div
            className="h-full bg-gradient-to-r from-[#2D6A4F] to-[#4E9F3D] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      )}
    </motion.div>
  );
}
