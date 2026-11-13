'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useMeasureFormat } from '@/lib/i18n/useMeasureFormat';

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

import ElevationProfileChart from '@/components/hiking/ElevationProfileChart';

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
  const fmt = useMeasureFormat();
  if (!isOpen) return null;

  const hasRoute = routeTotalKm != null && routeTotalKm > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset text-[color:var(--lkv-text-primary)] rounded-t-[34px] pt-3 pb-10 px-4  max-h-[85vh] overflow-y-auto space-y-5"
      >
        {/* Grabber */}
        <div className="w-10 h-1 bg-[color:var(--lkv-primary)]/14 rounded-full mx-auto" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-2xl font-medium tracking-tight">
              Statistiques <em className="font-serif italic text-[color:var(--lkv-text-primary)]">en direct</em>
            </h2>
            <p className="text-[11px] font-mono text-[color:var(--lkv-text-muted)] tracking-wider mt-0.5">
              RANDONNÉE EN COURS
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[color:var(--lkv-surface-muted)] flex items-center justify-center text-[color:var(--lkv-text-muted)] hover:text-[color:var(--lkv-text-primary)]"
          >
            ✕
          </button>
        </div>

        {/* Interactive Elevation Profile Curve Chart */}
        <ElevationProfileChart
          totalDistanceKm={routeTotalKm || distanceKm || 12.5}
          totalElevationGainM={elevationGainM || 650}
          totalElevationLossM={elevationLossM || 620}
          currentProgressKm={distanceKm || 0}
          units={fmt.prefs}
          locale={fmt.locale}
        />

        {/* 4 Stat Cells Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Distance */}
          <div className="p-3.5 bg-[color:var(--lkv-surface-muted)] rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
              Distance
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {fmt.distanceValue(distanceKm)}{' '}
              <em className="font-serif italic font-normal text-sm text-[color:var(--lkv-text-primary)]">
                {hasRoute ? `/ ${fmt.distance(routeTotalKm)}` : fmt.distanceUnit}
              </em>
            </div>
            {hasRoute && progressPercent != null && (
              <div className="text-[10px] font-mono text-[color:var(--lkv-primary-hover)] mt-1">
                {Math.min(100, Math.round(progressPercent))}% effectué
              </div>
            )}
          </div>

          {/* Durée */}
          <div className="p-3.5 bg-[color:var(--lkv-surface-muted)] rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
              Durée
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {formatDuration(durationSeconds)}
            </div>
            <div className="text-[10px] font-mono text-[color:var(--lkv-text-muted)] mt-1">Temps de déplacement</div>
          </div>

          {/* Allure */}
          <div className="p-3.5 bg-[color:var(--lkv-surface-muted)] rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
              Allure moyenne
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              {fmt.paceValue(paceMinPerKm != null ? paceMinPerKm * 60 : null)}{' '}
              <em className="font-serif italic font-normal text-sm text-[color:var(--lkv-text-primary)]">/{fmt.distanceUnit}</em>
            </div>
            <div className="text-[10px] font-mono text-[color:var(--lkv-primary-hover)] mt-1">
              {averageSpeedKmH != null && averageSpeedKmH > 0
                ? `Vitesse : ${fmt.speed(averageSpeedKmH)}`
                : currentSpeedKmH != null && currentSpeedKmH > 0
                ? `Vitesse actuelle : ${fmt.speed(currentSpeedKmH)}`
                : 'Vitesse : —'}
            </div>
          </div>

          {/* Dénivelé + */}
          <div className="p-3.5 bg-[color:var(--lkv-forest-950)] text-white rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[color:var(--lkv-forest-100)]">
              Dénivelé +
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1">
              +{fmt.elevationValue(elevationGainM)}{' '}
              <em className="font-serif italic font-normal text-sm text-[color:var(--lkv-forest-100)]">{fmt.elevationUnit}</em>
            </div>
            <div className="text-[10px] font-mono text-[color:var(--lkv-forest-100)]/70 mt-1">
              {elevationLossM != null ? `D- : -${fmt.elevation(elevationLossM)}` : 'D- : —'}
            </div>
          </div>
        </div>

        {/* Voltage Speed card (bonus, data-driven) */}
        <div className="p-4 bg-[color:var(--lkv-forest-950)] text-white rounded-[var(--lkv-radius-sm)] space-y-3 ">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-medium">
              Vitesse <em className="font-serif italic text-[color:var(--lkv-forest-100)]">instantanée</em>
            </div>
            <div className="font-mono text-[10px] text-[color:var(--lkv-forest-100)] tracking-wider">
              {currentSpeedKmH != null && currentSpeedKmH > 0 ? fmt.speed(currentSpeedKmH) : '—'}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}