'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface TopHUDProps {
  distanceKm: number;
  routeTotalKm?: number | null;
  durationSeconds: number;
  elevationGainM?: number | null;
  currentSpeedKmH?: number | null;
  progressPercent?: number | null;
  routeName?: string | null;
  isOffRoute?: boolean;
  isNightMode?: boolean;
  onBack?: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}m`;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export default function TopHUD({
  distanceKm,
  routeTotalKm = null,
  durationSeconds,
  elevationGainM = null,
  currentSpeedKmH = null,
  progressPercent = null,
  routeName,
  isOffRoute = false,
  isNightMode = false,
  onBack,
}: TopHUDProps) {
  const totalKm = routeTotalKm;
  const computedProgress = progressPercent ?? (totalKm && totalKm > 0 ? Math.min(100, (distanceKm / totalKm) * 100) : 0);

  return (
    <div className="w-full flex flex-col gap-2 p-3 z-30 select-none">
      {/* Top Row: Back Button + Progress Card */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-xl border transition-transform active:scale-95 touch-manipulation cursor-pointer ${
            isNightMode
              ? 'bg-[#0B1F17]/80 border-[#C6DCBE]/15 text-white'
              : 'bg-[#FBFAF6]/85 border-[#0B1F17]/06 text-[#0B1F17]'
          }`}
          aria-label="Retour"
        >
          <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div
          className={`flex-1 px-3.5 py-2.5 rounded-2xl backdrop-blur-2xl border shadow-lg flex items-center gap-2.5 min-w-0 ${
            isNightMode
              ? 'bg-[#0B1F17]/80 border-[#C6DCBE]/15 text-white'
              : 'bg-[#FBFAF6]/85 border-[#0B1F17]/06 text-[#0B1F17]'
          }`}
        >
          {/* GPS Icon */}
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              isOffRoute ? 'bg-[#E8B87A] text-[#7A4A15]' : 'bg-[#A8C8A0] text-[#06120C]'
            }`}
          >
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
            </svg>
          </div>

          {/* Info Column */}
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[9px] tracking-widest uppercase text-[#6B7A72] leading-none">
              {isOffRoute
                ? 'HORS PARCOURS'
                : isNightMode
                ? 'MODE NUIT · SUIVI GPS'
                : 'SUIVI GPS'}
            </div>
            <div className="text-sm sm:text-base font-medium tracking-tight leading-tight mt-0.5 font-sans">
              {formatDistance(distanceKm)}{' '}
              {totalKm != null && totalKm > 0 && (
                <em className="font-serif italic font-normal text-[#17402C]">
                  / {formatDistance(totalKm)}
                </em>
              )}
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full h-1 bg-[#0B1F17]/10 rounded-full mt-1.5 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  isOffRoute ? 'bg-[#C89755]' : isNightMode ? 'bg-[#A8C8A0]' : 'bg-[#17402C]'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, computedProgress))}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3-Cell Mini Stats Grid */}
      <div className="grid grid-cols-3 gap-[1px] bg-[#0B1F17]/06 border border-[#0B1F17]/06 rounded-2xl overflow-hidden shadow-lg">
        {/* Temps */}
        <div
          className={`p-2 text-center backdrop-blur-xl ${
            isNightMode ? 'bg-[#0B1F17]/75 text-white' : 'bg-[#FBFAF6]/90 text-[#0B1F17]'
          }`}
        >
          <div className="font-mono text-[8px] tracking-widest uppercase text-[#6B7A72] leading-none">
            Temps
          </div>
          <div className="text-sm font-medium leading-tight mt-0.5 font-mono">
            {formatDuration(durationSeconds || 0)}
          </div>
        </div>

        {/* Dénivelé */}
        <div
          className={`p-2 text-center backdrop-blur-xl ${
            isNightMode ? 'bg-[#0B1F17]/75 text-white' : 'bg-[#FBFAF6]/90 text-[#0B1F17]'
          }`}
        >
          <div className="font-mono text-[8px] tracking-widest uppercase text-[#6B7A72] leading-none">
            Dénivelé
          </div>
          <div className="text-sm font-medium leading-tight mt-0.5 font-mono text-[#17402C]">
            +{elevationGainM != null ? Math.round(elevationGainM) : '—'}{' '}
            <em className="font-serif italic font-normal text-xs text-[#17402C]">m</em>
          </div>
        </div>

        {/* Vitesse */}
        <div
          className={`p-2 text-center backdrop-blur-xl ${
            isNightMode ? 'bg-[#0B1F17]/75 text-white' : 'bg-[#FBFAF6]/90 text-[#0B1F17]'
          }`}
        >
          <div className="font-mono text-[8px] tracking-widest uppercase text-[#6B7A72] leading-none">
            Vitesse
          </div>
          <div className="text-sm font-medium leading-tight mt-0.5 font-mono">
            {currentSpeedKmH != null && currentSpeedKmH > 0 ? currentSpeedKmH.toFixed(1) : '—'}{' '}
            <em className="font-serif italic font-normal text-xs text-[#17402C]">km/h</em>
          </div>
        </div>
      </div>
    </div>
  );
}
