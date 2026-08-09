'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface StatsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  distanceKm: number | null;
  durationSeconds: number | null;
  routeTotalKm?: number | null;
  progressPercent?: number | null;
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  currentSpeedKmH?: number | null;
  averageSpeedKmH?: number | null;
  paceMinPerKm?: number | null;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}m`;
}

function formatPace(paceMinPerKm: number | null | undefined): string {
  if (paceMinPerKm == null || paceMinPerKm <= 0 || !Number.isFinite(paceMinPerKm)) return '—';
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}'${String(secs).padStart(2, '0')}"`;
}

export default function StatsSheet({
  isOpen,
  onClose,
  distanceKm = null,
  durationSeconds = null,
  routeTotalKm = null,
  progressPercent = null,
  elevationGainM = null,
  elevationLossM = null,
  currentSpeedKmH = null,
  averageSpeedKmH = null,
  paceMinPerKm = null,
}: StatsSheetProps) {
  if (!isOpen) return null;

  const hasRoute = routeTotalKm != null && routeTotalKm > 0;

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
              RANDONNÉE EN COURS
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
              {distanceKm != null ? `${distanceKm.toFixed(1)}` : '—'}{' '}
              <em className="font-serif italic font-normal text-sm text-[#17402C]">
                {hasRoute ? `/ ${Number(routeTotalKm).toFixed(1)} km` : 'km'}
              </em>
            </div>
            {hasRoute && progressPercent != null && (
              <div className="text-[10px] font-mono text-[#205238] mt-1">
                {Math.min(100, Math.round(progressPercent))}% effectué
              </div>
            )}
          </div>

          {/* Durée */}
          <div className="p-3.5 bg-[#F4F1EA] rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#6B7A72]">
              Durée
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {formatDuration(durationSeconds)}
            </div>
            <div className="text-[10px] font-mono text-[#6B7A72] mt-1">Temps de déplacement</div>
          </div>

          {/* Allure */}
          <div className="p-3.5 bg-[#F4F1EA] rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#6B7A72]">
              Allure moyenne
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {formatPace(paceMinPerKm)}{' '}
              <em className="font-serif italic font-normal text-sm text-[#17402C]">/km</em>
            </div>
            <div className="text-[10px] font-mono text-[#205238] mt-1">
              {averageSpeedKmH != null && averageSpeedKmH > 0
                ? `Vitesse : ${averageSpeedKmH.toFixed(1)} km/h`
                : currentSpeedKmH != null && currentSpeedKmH > 0
                ? `Vitesse actuelle : ${currentSpeedKmH.toFixed(1)} km/h`
                : 'Vitesse : —'}
            </div>
          </div>

          {/* Dénivelé + */}
          <div className="p-3.5 bg-[#06120C] text-white rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#C6DCBE]">
              Dénivelé +
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              +{elevationGainM != null ? Math.round(elevationGainM) : '—'}{' '}
              <em className="font-serif italic font-normal text-sm text-[#C6DCBE]">m</em>
            </div>
            <div className="text-[10px] font-mono text-[#C6DCBE]/70 mt-1">
              {elevationLossM != null ? `D- : -${Math.round(elevationLossM)} m` : 'D- : —'}
            </div>
          </div>
        </div>

        {/* Voltage Speed card (bonus, data-driven) */}
        <div className="p-4 bg-[#06120C] text-white rounded-3xl space-y-3 shadow-xl">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-medium">
              Vitesse <em className="font-serif italic text-[#C6DCBE]">instantanée</em>
            </div>
            <div className="font-mono text-[10px] text-[#C6DCBE] tracking-wider">
              {currentSpeedKmH != null && currentSpeedKmH > 0 ? `${currentSpeedKmH.toFixed(1)} km/h` : '—'}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}