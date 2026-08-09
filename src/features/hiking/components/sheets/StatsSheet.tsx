'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface StatsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  distanceKm: number;
  durationSeconds: number;
  elevationGainM?: number | null;
  currentSpeedKmH?: number | null;
  averageSpeedKmH?: number | null;
  paceMinPerKm?: number | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}m`;
}

export default function StatsSheet({
  isOpen,
  onClose,
  distanceKm = 6.8,
  durationSeconds = 8280,
  elevationGainM = 420,
  currentSpeedKmH = 3.4,
  averageSpeedKmH = 3.0,
  paceMinPerKm = 18.6,
}: StatsSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[#FBFAF6] text-[#0B1F17] rounded-t-[34px] pt-3 pb-10 px-4 shadow-2xl max-h-[85vh] overflow-y-auto space-y-5"
      >
        {/* Grabber */}
        <div className="w-10 h-1 bg-[#0B1F17]/14 rounded-full mx-auto" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-2xl font-medium tracking-tight">
              Statistiques <em className="font-serif italic text-[#17402C]">en direct</em>
            </h2>
            <p className="text-[11px] font-mono text-[#6B7A72] tracking-wider mt-0.5">
              PARCOURS EN COURS · DÉPART 08:30
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E9E4D9] flex items-center justify-center text-[#6B7A72] hover:text-[#0B1F17]"
          >
            ✕
          </button>
        </div>

        {/* 4 Stat Cells Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Distance */}
          <div className="p-3.5 bg-[#F4F1EA] rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#6B7A72]">
              Distance
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {distanceKm.toFixed(1)}{' '}
              <em className="font-serif italic font-normal text-sm text-[#17402C]">/ 14,2 km</em>
            </div>
            <div className="text-[10px] font-mono text-[#205238] mt-1">48% effectué</div>
          </div>

          {/* Durée */}
          <div className="p-3.5 bg-[#F4F1EA] rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#6B7A72]">
              Durée
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {formatDuration(durationSeconds)}
            </div>
            <div className="text-[10px] font-mono text-[#6B7A72] mt-1">Pause: 14 min</div>
          </div>

          {/* Allure */}
          <div className="p-3.5 bg-[#F4F1EA] rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#6B7A72]">
              Allure moyenne
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {Math.floor(paceMinPerKm || 18)}&apos;{Math.round(((paceMinPerKm || 18) % 1) * 60)}&quot;{' '}
              <em className="font-serif italic font-normal text-sm text-[#17402C]">/km</em>
            </div>
            <div className="text-[10px] font-mono text-[#205238] mt-1">
              Vitesse : {(averageSpeedKmH || 3.0).toFixed(1)} km/h
            </div>
          </div>

          {/* Dénivelé + */}
          <div className="p-3.5 bg-[#06120C] text-white rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#C6DCBE]">
              Dénivelé +
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              +{elevationGainM || 420}{' '}
              <em className="font-serif italic font-normal text-sm text-[#C6DCBE]">m</em>
            </div>
            <div className="text-[10px] font-mono text-[#C6DCBE]/70 mt-1">D- : -45 m</div>
          </div>
        </div>

        {/* Altitude Profile Graph Card */}
        <div className="p-4 bg-[#06120C] text-white rounded-3xl space-y-3 shadow-xl">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-medium">
              Profil <em className="font-serif italic text-[#C6DCBE]">altimétrique</em>
            </div>
            <div className="font-mono text-[10px] text-[#C6DCBE] tracking-wider">
              MAX: 1 842 m
            </div>
          </div>

          {/* SVG Graph */}
          <svg className="w-full h-28 overflow-visible" viewBox="0 0 340 100">
            <defs>
              <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A8C8A0" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#17402C" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            <line x1="0" y1="20" x2="340" y2="20" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
            <line x1="0" y1="60" x2="340" y2="60" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
            {/* Area & Line */}
            <path
              d="M0,90 Q60,75 120,40 T240,25 T340,50 L340,100 L0,100 Z"
              fill="url(#elevGrad)"
            />
            <path
              d="M0,90 Q60,75 120,40 T240,25 T340,50"
              fill="none"
              stroke="#A8C8A0"
              strokeWidth="2.5"
            />
            {/* Current Position Marker */}
            <circle cx="160" cy="32" r="5" fill="#E8B87A" stroke="#06120C" strokeWidth="2" />
          </svg>

          {/* Scale Labels */}
          <div className="flex justify-between font-mono text-[9px] text-white/50 tracking-wider">
            <span>0 km</span>
            <span className="text-[#E8B87A]">6,8 km (ici)</span>
            <span>14,2 km</span>
          </div>
        </div>

        {/* Km Splits Progress Bars */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#6B7A72]">
            Intermédiaires (Splits)
          </h3>
          {[
            { km: 'Km 1', pace: '16\'20"', pct: 85 },
            { km: 'Km 2', pace: '18\'40"', pct: 95 },
            { km: 'Km 3', pace: '17\'10"', pct: 88 },
            { km: 'Km 4', pace: '21\'05"', pct: 100 },
            { km: 'Km 5', pace: '19\'30"', pct: 92 },
          ].map((s) => (
            <div
              key={s.km}
              className="flex items-center gap-3 p-2.5 bg-[#FBFAF6] border border-[#0B1F17]/06 rounded-xl text-xs"
            >
              <span className="font-mono text-[11px] font-semibold text-[#6B7A72] w-10">
                {s.km}
              </span>
              <div className="flex-1 h-2 bg-[#F4F1EA] rounded-full overflow-hidden">
                <div className="h-full bg-[#17402C] rounded-full" style={{ width: `${s.pct}%` }} />
              </div>
              <span className="font-mono text-[11px] font-semibold text-[#0B1F17]">
                {s.pace}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
