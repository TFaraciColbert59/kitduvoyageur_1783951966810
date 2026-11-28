'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Clock,
  Flame,
  Gauge,
  HeartPulse,
  Mountain,
  Radio,
  Route,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { ActivityProfileSpec } from '../../specs/activityProfileSpec.types';
import { formatPrimarySpeedMetric } from '../../specs/resolveActivityProfile';
import { ExplorerNestedSubDrawer } from '../primitives/ExplorerNestedSubDrawer';
import type { HudContrastVariant } from '../primitives/ExplorerNonModalSheet';

export interface LiveSplitRow {
  kmIndex: number;
  paceLabel: string;
  speedKmh?: number;
  elevDeltaM: number;
  avgHrBpm?: number | null;
}

export interface LiveTelemetrySample {
  t: number;
  distanceM: number;
  altitudeM: number;
  speedKmh: number;
}

export interface GpsTelemetrySubDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ActivityProfileSpec;
  distanceM?: number;
  movingS?: number;
  elevGainM?: number;
  altitudeM?: number | null;
  speedKmh?: number | null;
  gpsAccuracyM?: number | null;
  isDeadReckoning?: boolean;
  units?: 'metric' | 'imperial';
  samples?: ReadonlyArray<LiveTelemetrySample>;
  heartRateBpm?: number | null;
  hrZoneSharesPct?: readonly [number, number, number, number, number];
  gradePct?: number;
  power3sW?: number | null;
  normalizedPowerW?: number | null;
  riderWeightKg?: number | null;
  splits?: ReadonlyArray<LiveSplitRow>;
  contrast?: HudContrastVariant;
  glovesMode?: boolean;
}

const EFFORT_ZONES = [
  { id: 'z1', label: 'Calme', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.14)' },
  { id: 'z2', label: 'Endurance', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.14)' },
  { id: 'z3', label: 'Rythme', color: '#EAB308', bg: 'rgba(234, 179, 8, 0.16)' },
  { id: 'z4', label: 'Soutenu', color: '#F97316', bg: 'rgba(249, 115, 22, 0.16)' },
  { id: 'z5', label: 'Max', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
] as const;

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDistanceCompact(meters: number, units: 'metric' | 'imperial'): string {
  const safe = Math.max(0, Number.isFinite(meters) ? meters : 0);
  if (units === 'imperial') {
    const mi = safe / 1609.344;
    return `${mi.toFixed(2).replace('.', ',')} mi`;
  }
  if (safe < 1000) return `${Math.round(safe)} m`;
  return `${(safe / 1000).toFixed(2).replace('.', ',')} km`;
}

function estimateCaloriesKcal(
  profile: ActivityProfileSpec,
  distanceM: number,
  movingS: number,
  elevGainM: number,
): number {
  const hours = Math.max(0, movingS) / 3600;
  const distKm = Math.max(0, distanceM) / 1000;
  const family = profile.identity.familyId;
  const baseMet =
    family === 'running_trail'
      ? 9.5
      : family === 'cycling'
        ? 8.0
        : family === 'snow_winter'
          ? 7.5
          : family === 'water_nautic'
            ? 7.0
            : family === 'vertical_alpinism'
              ? 8.2
              : 5.5;
  const timeKcal = baseMet * 70 * hours;
  const workKcal = distKm * 52 + Math.max(0, elevGainM) * 0.45;
  return Math.max(0, Math.round(Math.max(timeKcal * 0.65, workKcal)));
}

function resolveSlopeState(gradePct: number): {
  label: string;
  color: string;
  bg: string;
  angleDeg: number;
} {
  const clamped = Math.max(-22, Math.min(22, Number.isFinite(gradePct) ? gradePct : 0));
  const angleDeg = -clamped * 1.15;
  if (clamped >= 9) return { label: 'Forte côte', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)', angleDeg };
  if (clamped >= 3.5) return { label: 'Montée', color: '#D97706', bg: 'rgba(217, 119, 6, 0.13)', angleDeg };
  if (clamped <= -8) return { label: 'Descente raide', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.12)', angleDeg };
  if (clamped <= -3) return { label: 'Descente', color: '#0284C7', bg: 'rgba(2, 132, 199, 0.12)', angleDeg };
  return { label: 'Terrain plat', color: '#16A34A', bg: 'rgba(22, 163, 74, 0.12)', angleDeg };
}

function resolveGpsBars(accuracyM: number | null, isDeadReckoning: boolean): {
  bars: number;
  label: string;
  color: string;
} {
  if (isDeadReckoning) return { bars: 1, label: 'Estimé', color: '#D97706' };
  if (accuracyM === null || !Number.isFinite(accuracyM)) {
    return { bars: 1, label: 'Recherche', color: '#D97706' };
  }
  if (accuracyM <= 8) return { bars: 4, label: 'Excellent', color: '#16A34A' };
  if (accuracyM <= 18) return { bars: 3, label: 'Bon', color: '#22C55E' };
  if (accuracyM <= 35) return { bars: 2, label: 'Moyen', color: '#D97706' };
  return { bars: 1, label: 'Faible', color: '#DC2626' };
}

function RadialGauge({
  progress,
  accentFrom,
  accentTo,
  trackColor,
  value,
  unit,
  label,
  subLabel,
  icon,
  gradId,
}: {
  progress: number;
  accentFrom: string;
  accentTo: string;
  trackColor: string;
  value: string;
  unit: string;
  label: string;
  subLabel: string;
  icon: React.ReactNode;
  gradId: string;
}) {
  const clamped = Math.max(0.03, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.76; // 274 deg modern Apple Watch open ring
  const totalArc = circumference * arcFraction;
  const dashOffset = totalArc * (1 - clamped);

  return (
    <div
      className="xp20-card-press flex flex-col items-center rounded-[22px] p-3"
      style={{
        background: 'var(--lkv-surface-elevated, rgba(255, 255, 255, 0.94))',
        border: '0.5px solid var(--xp-hud-border)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 6px 18px rgba(16, 32, 25, 0.05)',
      }}
    >
      <div className="relative flex items-center justify-center" style={{ width: 108, height: 100 }}>
        <svg viewBox="0 0 104 104" width={104} height={104} aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={accentFrom} />
              <stop offset="100%" stopColor={accentTo} />
            </linearGradient>
          </defs>
          <g transform="rotate(133 52 52)">
            <circle
              cx="52"
              cy="52"
              r={radius}
              fill="none"
              stroke={trackColor}
              strokeWidth="8.5"
              strokeLinecap="round"
              strokeDasharray={`${totalArc} ${circumference}`}
            />
            <circle
              cx="52"
              cy="52"
              r={radius}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="8.5"
              strokeLinecap="round"
              strokeDasharray={`${totalArc} ${circumference}`}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 420ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1 text-center">
          <span style={{ color: accentFrom, marginBottom: 2 }}>{icon}</span>
          <strong
            className="text-[20px] font-black leading-none tracking-tight"
            style={{ color: 'var(--xp-hud-ink)', fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </strong>
          <span
            className="mt-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: 'var(--xp-hud-ink-muted)' }}
          >
            {unit}
          </span>
        </div>
      </div>

      <span className="mt-0.5 text-[12px] font-extrabold" style={{ color: 'var(--xp-hud-ink)' }}>
        {label}
      </span>
      <span
        className="text-[10.5px] font-semibold"
        style={{ color: 'var(--xp-hud-ink-muted)', fontVariantNumeric: 'tabular-nums' }}
      >
        {subLabel}
      </span>
    </div>
  );
}

function LiveAreaSparkChart({
  values,
  unit,
  color,
  fillFrom,
  fillTo,
  gradId,
}: {
  values: ReadonlyArray<number>;
  unit: string;
  color: string;
  fillFrom: string;
  fillTo: string;
  gradId: string;
}) {
  const safeValues = values.length >= 2 ? values : [values[0] ?? 0, values[0] ?? 0];
  const minVal = Math.min(...safeValues);
  const maxVal = Math.max(...safeValues);
  const currentVal = safeValues[safeValues.length - 1] ?? 0;
  const span = Math.max(1, maxVal - minVal);

  const w = 300;
  const h = 92;
  const padX = 8;
  const padTop = 12;
  const padBot = 10;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBot;

  const coords = safeValues.map((v, i) => {
    const x = padX + (i / Math.max(1, safeValues.length - 1)) * innerW;
    const norm = maxVal === minVal ? 0.5 : (v - minVal) / span;
    const y = padTop + (1 - norm) * innerH;
    return { x, y };
  });

  const linePath = coords
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(h - padBot).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(h - padBot).toFixed(1)} Z`;
  const last = coords[coords.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full overflow-visible"
        style={{ height: 96 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={fillFrom} stopOpacity="0.34" />
            <stop offset="100%" stopColor={fillTo} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Subtle horizontal guide lines */}
        <line x1={padX} y1={padTop} x2={w - padX} y2={padTop} stroke="rgba(23, 64, 44, 0.08)" strokeDasharray="3 4" />
        <line x1={padX} y1={padTop + innerH / 2} x2={w - padX} y2={padTop + innerH / 2} stroke="rgba(23, 64, 44, 0.08)" strokeDasharray="3 4" />
        <line x1={padX} y1={h - padBot} x2={w - padX} y2={h - padBot} stroke="rgba(23, 64, 44, 0.12)" />

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />

        {/* Live glowing head point */}
        <circle cx={last.x} cy={last.y} r="7" fill={color} opacity="0.2" />
        <circle cx={last.x} cy={last.y} r="3.6" fill="#FFFFFF" stroke={color} strokeWidth="2.2" />
      </svg>

      <div
        className="mt-1.5 flex items-center justify-between text-[11px] font-bold"
        style={{ color: 'var(--xp-hud-ink-muted)', fontVariantNumeric: 'tabular-nums' }}
      >
        <span>Min {unit === 'm' ? Math.round(minVal) : minVal.toFixed(1).replace('.', ',')} {unit}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
          style={{ background: `${color}1A`, color }}
        >
          Actuel {unit === 'm' ? Math.round(currentVal) : currentVal.toFixed(1).replace('.', ',')} {unit}
        </span>
        <span>Max {unit === 'm' ? Math.round(maxVal) : maxVal.toFixed(1).replace('.', ',')} {unit}</span>
      </div>
    </div>
  );
}

export function GpsTelemetrySubDrawer({
  open,
  onOpenChange,
  profile,
  distanceM = 0,
  movingS = 0,
  elevGainM = 0,
  altitudeM = 0,
  speedKmh = 0,
  gpsAccuracyM = null,
  isDeadReckoning = false,
  units = 'metric',
  samples = [],
  heartRateBpm = null,
  hrZoneSharesPct,
  gradePct = 0,
  power3sW = null,
  splits = [],
  contrast = 'standard',
  glovesMode = false,
}: GpsTelemetrySubDrawerProps) {
  const [chartTab, setChartTab] = useState<'altitude' | 'speed'>('altitude');

  const safeSpeedKmh = Math.max(0, Number.isFinite(speedKmh ?? 0) ? (speedKmh ?? 0) : 0);
  const safeAltM = Number.isFinite(altitudeM ?? 0) ? (altitudeM ?? 0) : 0;
  const safeDistM = Math.max(0, Number.isFinite(distanceM) ? distanceM : 0);
  const safeMovingS = Math.max(0, Number.isFinite(movingS) ? movingS : 0);
  const safeElevGainM = Math.max(0, Math.round(Number.isFinite(elevGainM) ? elevGainM : 0));

  const primaryAvg = useMemo(
    () =>
      formatPrimarySpeedMetric(profile, {
        distanceM: safeDistM,
        movingS: safeMovingS,
        elevGainM: safeElevGainM,
        units,
      }),
    [profile, safeDistM, safeMovingS, safeElevGainM, units],
  );

  const maxSpeedRef =
    profile.identity.familyId === 'cycling'
      ? 45
      : profile.identity.familyId === 'snow_winter'
        ? 55
        : profile.identity.familyId === 'running_trail'
          ? 18
          : 10;
  const speedRatio = Math.min(1, safeSpeedKmh / maxSpeedRef);

  const liveSpeedDisplay = useMemo(() => {
    if (profile.algorithms.primarySpeedUnit === 'min_per_km' && safeSpeedKmh > 0.6) {
      const secPerKm = Math.round(3600 / safeSpeedKmh);
      const min = Math.floor(secPerKm / 60);
      const sec = secPerKm % 60;
      return { value: `${min}:${String(sec).padStart(2, '0')}`, unit: 'min/km', label: 'Allure live' };
    }
    if (units === 'imperial') {
      return {
        value: (safeSpeedKmh * 0.621371).toFixed(1).replace('.', ','),
        unit: 'mph',
        label: 'Vitesse live',
      };
    }
    return {
      value: safeSpeedKmh.toFixed(1).replace('.', ','),
      unit: 'km/h',
      label: 'Vitesse live',
    };
  }, [profile.algorithms.primarySpeedUnit, safeSpeedKmh, units]);

  const caloriesKcal = useMemo(
    () => estimateCaloriesKcal(profile, safeDistM, safeMovingS, safeElevGainM),
    [profile, safeDistM, safeMovingS, safeElevGainM],
  );

  // Effort score 0..100 for intuitive visual ring (real HR if available, else speed+slope intensity)
  const effortPct = useMemo(() => {
    if (heartRateBpm && heartRateBpm > 40) {
      return Math.max(5, Math.min(100, Math.round(((heartRateBpm - 55) / 135) * 100)));
    }
    const slopeBoost = Math.max(0, gradePct) * 3.2;
    return Math.max(0, Math.min(100, Math.round(speedRatio * 72 + slopeBoost)));
  }, [heartRateBpm, gradePct, speedRatio]);

  const activeZoneIdx =
    effortPct >= 85 ? 4 : effortPct >= 68 ? 3 : effortPct >= 48 ? 2 : effortPct >= 24 ? 1 : 0;
  const activeZone = EFFORT_ZONES[activeZoneIdx];

  // Dynamic zone distribution: uses real HR zone shares if provided, otherwise clean 0% or active zone highlight
  const zoneShares = useMemo<readonly [number, number, number, number, number]>(() => {
    if (hrZoneSharesPct) return hrZoneSharesPct;
    if (safeMovingS < 5 && !heartRateBpm) return [0, 0, 0, 0, 0];
    const base: [number, number, number, number, number] = [10, 20, 10, 5, 0];
    base[activeZoneIdx] = Math.min(100, base[activeZoneIdx] + 55);
    const total = base.reduce((acc, v) => acc + v, 0) || 1;
    return [
      Math.round((base[0] / total) * 100),
      Math.round((base[1] / total) * 100),
      Math.round((base[2] / total) * 100),
      Math.round((base[3] / total) * 100),
      Math.round((base[4] / total) * 100),
    ];
  }, [hrZoneSharesPct, safeMovingS, heartRateBpm, activeZoneIdx]);

  const slopeInfo = resolveSlopeState(gradePct);
  const gpsSignal = resolveGpsBars(gpsAccuracyM, isDeadReckoning);
  const vamMh = safeMovingS >= 20 ? Math.round((safeElevGainM / safeMovingS) * 3600) : 0;

  const altSeries = useMemo(() => {
    if (samples.length >= 2) return samples.map((s) => s.altitudeM);
    return [safeAltM, safeAltM];
  }, [samples, safeAltM]);

  const speedSeries = useMemo(() => {
    if (samples.length >= 2) return samples.map((s) => s.speedKmh);
    return [safeSpeedKmh, safeSpeedKmh];
  }, [samples, safeSpeedKmh]);

  const nextKmProgressPct = Math.min(100, Math.round(((safeDistM % 1000) / 1000) * 100));
  const nextKmRemainingM = Math.max(0, 1000 - Math.round(safeDistM % 1000));

  const cardSurface: React.CSSProperties = {
    background: 'var(--lkv-surface-elevated, rgba(255, 255, 255, 0.94))',
    border: '0.5px solid var(--xp-hud-border)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 6px 18px rgba(16, 32, 25, 0.045)',
  };

  return (
    <ExplorerNestedSubDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Télémétrie en direct"
      subtitle={`${profile.identity.labelFr} · Tableau de bord visuel`}
      contrast={contrast}
      glovesMode={glovesMode}
    >
      <div className="flex flex-col gap-3 pb-2">
        {/* 1. Hero Dual Radial Gauges (Allure/Vitesse + Effort/Cardio) */}
        <motion.section
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="grid grid-cols-2 gap-2.5"
        >
          <RadialGauge
            gradId="xp20-speed-gauge"
            progress={speedRatio}
            accentFrom="#17402C"
            accentTo="#34D399"
            trackColor="rgba(23, 64, 44, 0.1)"
            value={liveSpeedDisplay.value}
            unit={liveSpeedDisplay.unit}
            label={liveSpeedDisplay.label}
            subLabel={`Moy. ${primaryAvg.valueText} ${primaryAvg.unitLabel}`}
            icon={<Gauge size={14} aria-hidden="true" />}
          />

          <RadialGauge
            gradId="xp20-effort-gauge"
            progress={effortPct / 100}
            accentFrom={activeZone.color}
            accentTo={effortPct >= 60 ? '#EF4444' : '#34D399'}
            trackColor="rgba(23, 64, 44, 0.1)"
            value={heartRateBpm ? `${Math.round(heartRateBpm)}` : `${effortPct}`}
            unit={heartRateBpm ? 'bpm' : '% effort'}
            label={heartRateBpm ? 'Rythme cardiaque' : 'Intensité'}
            subLabel={`Zone ${activeZone.label}`}
            icon={<HeartPulse size={14} aria-hidden="true" />}
          />
        </motion.section>

        {/* 2. 4 Visual Stat Tiles (Distance / Temps / D+ / Calories) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32, delay: 0.04 }}
          className="grid grid-cols-2 gap-2"
        >
          {[
            {
              label: 'Distance',
              value: formatDistanceCompact(safeDistM, units),
              color: '#17402C',
              bg: 'rgba(23, 64, 44, 0.11)',
              icon: <Route size={15} aria-hidden="true" />,
            },
            {
              label: 'Temps actif',
              value: formatClock(safeMovingS),
              color: '#2563EB',
              bg: 'rgba(37, 99, 235, 0.11)',
              icon: <Clock size={15} aria-hidden="true" />,
            },
            {
              label: 'Dénivelé +',
              value: `+${safeElevGainM} m`,
              color: '#D97706',
              bg: 'rgba(217, 119, 6, 0.12)',
              icon: <TrendingUp size={15} aria-hidden="true" />,
            },
            {
              label: 'Énergie est.',
              value: `${caloriesKcal} kcal`,
              color: '#E11D48',
              bg: 'rgba(225, 29, 72, 0.11)',
              icon: <Flame size={15} aria-hidden="true" />,
            },
          ].map((tile) => (
            <div
              key={tile.label}
              className="xp20-card-press flex items-center gap-2.5 rounded-[18px] px-3 py-2.5"
              style={cardSurface}
            >
              <span
                aria-hidden="true"
                className="grid shrink-0 place-items-center rounded-[12px]"
                style={{ width: 34, height: 34, background: tile.bg, color: tile.color }}
              >
                {tile.icon}
              </span>
              <div className="min-w-0">
                <span
                  className="block text-[10.5px] font-bold"
                  style={{ color: 'var(--xp-hud-ink-muted)' }}
                >
                  {tile.label}
                </span>
                <strong
                  className="block truncate text-[15px] font-black leading-tight"
                  style={{ color: 'var(--xp-hud-ink)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {tile.value}
                </strong>
              </div>
            </div>
          ))}
        </motion.section>

        {/* 3. Live Interactive Visual Curve (Altitude / Vitesse) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32, delay: 0.08 }}
          className="rounded-[22px] p-3"
          style={cardSurface}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-[12px] font-extrabold"
              style={{ color: 'var(--xp-hud-ink)' }}
            >
              {chartTab === 'altitude' ? (
                <Mountain size={14} color="#17402C" aria-hidden="true" />
              ) : (
                <Zap size={14} color="#0284C7" aria-hidden="true" />
              )}
              {chartTab === 'altitude' ? 'Courbe d’altitude' : 'Courbe de vitesse'}
            </span>

            <div
              role="tablist"
              aria-label="Choisir la courbe"
              className="inline-flex rounded-full p-0.5"
              style={{ background: 'rgba(23, 64, 44, 0.08)' }}
            >
              {(
                [
                  { id: 'altitude', label: 'Altitude' },
                  { id: 'speed', label: 'Vitesse' },
                ] as const
              ).map((tab) => {
                const active = chartTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className="xp20-tactile rounded-full px-2.5 py-1 text-[11px] font-bold"
                    onClick={() => setChartTab(tab.id)}
                    style={{
                      background: active ? '#FFFFFF' : 'transparent',
                      color: active ? '#17402C' : 'var(--xp-hud-ink-muted)',
                      boxShadow: active ? '0 2px 6px rgba(16, 32, 25, 0.1)' : 'none',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {chartTab === 'altitude' ? (
            <LiveAreaSparkChart
              gradId="xp20-alt-area"
              values={altSeries}
              unit="m"
              color="#17402C"
              fillFrom="#22C55E"
              fillTo="#22C55E"
            />
          ) : (
            <LiveAreaSparkChart
              gradId="xp20-spd-area"
              values={speedSeries}
              unit="km/h"
              color="#0284C7"
              fillFrom="#38BDF8"
              fillTo="#38BDF8"
            />
          )}
        </motion.section>

        {/* 4. Visual Slope Clinometer + Visual GPS Signal Strength */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32, delay: 0.12 }}
          className="grid grid-cols-2 gap-2.5"
        >
          {/* Visual Slope Clinometer */}
          <div className="flex flex-col justify-between rounded-[20px] p-3" style={cardSurface}>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold" style={{ color: 'var(--xp-hud-ink-muted)' }}>
                Pente
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: slopeInfo.bg, color: slopeInfo.color }}
              >
                {slopeInfo.label}
              </span>
            </div>

            <div className="my-2 flex items-center justify-between gap-2">
              <svg viewBox="0 0 64 38" width={64} height={38} aria-hidden="true">
                <g
                  transform={`rotate(${slopeInfo.angleDeg.toFixed(1)} 32 24)`}
                  style={{ transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                >
                  <line
                    x1="6"
                    y1="26"
                    x2="58"
                    y2="26"
                    stroke={slopeInfo.color}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <polygon points="32,12 40,22 24,22" fill={slopeInfo.color} opacity="0.88" />
                </g>
              </svg>

              <div className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <strong className="block text-[20px] font-black leading-none" style={{ color: 'var(--xp-hud-ink)' }}>
                  {gradePct >= 0 ? `+${gradePct.toFixed(1).replace('.', ',')}` : gradePct.toFixed(1).replace('.', ',')}%
                </strong>
                <span className="mt-0.5 block text-[10.5px] font-bold" style={{ color: 'var(--xp-hud-ink-muted)' }}>
                  {vamMh} m/h
                </span>
              </div>
            </div>
          </div>

          {/* Visual GPS Signal Bars + Altitude */}
          <div className="flex flex-col justify-between rounded-[20px] p-3" style={cardSurface}>
            <div className="flex items-center justify-between gap-1">
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold"
                style={{ color: 'var(--xp-hud-ink-muted)' }}
              >
                <Radio size={12} color={gpsSignal.color} aria-hidden="true" />
                Signal GPS
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: `${gpsSignal.color}1C`, color: gpsSignal.color }}
              >
                {gpsSignal.label}
              </span>
            </div>

            <div className="my-2 flex items-end justify-between gap-2">
              {/* 4 visual signal strength bars */}
              <div className="flex items-end gap-1" aria-hidden="true" style={{ height: 28 }}>
                {[10, 15, 21, 27].map((barH, idx) => {
                  const lit = idx < gpsSignal.bars;
                  return (
                    <span
                      key={barH}
                      style={{
                        width: 6,
                        height: barH,
                        borderRadius: 999,
                        background: lit ? gpsSignal.color : 'rgba(23, 64, 44, 0.12)',
                        transition: 'background-color 240ms ease',
                      }}
                    />
                  );
                })}
              </div>

              <div className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <strong className="block text-[18px] font-black leading-none" style={{ color: 'var(--xp-hud-ink)' }}>
                  {gpsAccuracyM !== null && Number.isFinite(gpsAccuracyM) ? `±${Math.round(gpsAccuracyM)} m` : '±0 m'}
                </strong>
                <span className="mt-0.5 block text-[10.5px] font-bold" style={{ color: 'var(--xp-hud-ink-muted)' }}>
                  Alt. {Math.round(safeAltM)} m
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 5. 5-Color Effort Distribution Bar + Optional Power Pill */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32, delay: 0.16 }}
          className="rounded-[22px] p-3"
          style={cardSurface}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-[12px] font-extrabold"
              style={{ color: 'var(--xp-hud-ink)' }}
            >
              <HeartPulse size={14} color="#E11D48" aria-hidden="true" />
              Répartition de l’effort
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
              style={{
                background: activeZone.bg,
                color: activeZone.color,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {heartRateBpm ? `${Math.round(heartRateBpm)} bpm` : power3sW ? `${Math.round(power3sW)} W` : '0 bpm'}
            </span>
          </div>

          {/* Unified segmented rainbow progress bar */}
          <div
            className="flex h-3.5 w-full overflow-hidden rounded-full"
            style={{ background: 'rgba(23, 64, 44, 0.08)', gap: 2 }}
          >
            {EFFORT_ZONES.map((zone, idx) => {
              const pct = Math.max(0, zoneShares[idx] ?? 0);
              return (
                <div
                  key={zone.id}
                  style={{
                    width: `${pct}%`,
                    minWidth: pct > 0 ? 6 : 0,
                    background: zone.color,
                    transition: 'width 360ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              );
            })}
          </div>

          {/* Compact colored legend pills */}
          <div className="mt-2.5 grid grid-cols-5 gap-1 text-center">
            {EFFORT_ZONES.map((zone, idx) => {
              const pct = Math.round(zoneShares[idx] ?? 0);
              const isCurrent = idx === activeZoneIdx;
              return (
                <div
                  key={zone.id}
                  className="rounded-[12px] py-1"
                  style={{
                    background: isCurrent ? zone.bg : 'transparent',
                    transition: 'background-color 200ms ease',
                  }}
                >
                  <span
                    className="mx-auto mb-0.5 block rounded-full"
                    style={{ width: 8, height: 8, background: zone.color }}
                  />
                  <span
                    className="block text-[11px] font-black leading-tight"
                    style={{ color: 'var(--xp-hud-ink)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {pct}%
                  </span>
                  <span
                    className="block truncate text-[9.5px] font-bold"
                    style={{ color: 'var(--xp-hud-ink-muted)' }}
                  >
                    {zone.label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* 6. Visual Km Splits Bar Chart (or Next-Km Progress Bar) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32, delay: 0.2 }}
          className="rounded-[22px] p-3"
          style={cardSurface}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-[12px] font-extrabold"
              style={{ color: 'var(--xp-hud-ink)' }}
            >
              <Activity size={14} color="#17402C" aria-hidden="true" />
              Rythme par kilomètre
            </span>
            <span
              className="text-[11px] font-bold"
              style={{ color: 'var(--xp-hud-ink-muted)', fontVariantNumeric: 'tabular-nums' }}
            >
              {splits.length > 0 ? `${splits.length} km validé${splits.length > 1 ? 's' : ''}` : `Km 1 · ${nextKmProgressPct}%`}
            </span>
          </div>

          {splits.length === 0 ? (
            <div className="flex flex-col gap-1.5">
              <div
                className="h-3 w-full overflow-hidden rounded-full"
                style={{ background: 'rgba(23, 64, 44, 0.09)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, nextKmProgressPct)}%`,
                    background: 'linear-gradient(90deg, #17402C, #34D399)',
                    transition: 'width 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </div>
              <div
                className="flex items-center justify-between text-[11px] font-bold"
                style={{ color: 'var(--xp-hud-ink-muted)', fontVariantNumeric: 'tabular-nums' }}
              >
                <span>{Math.round(safeDistM % 1000)} m parcourus</span>
                <span>Encore {nextKmRemainingM} m pour le 1er split</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {splits.map((row) => {
                const barWidth = Math.max(
                  24,
                  Math.min(100, Math.round(((row.speedKmh ?? 6) / maxSpeedRef) * 100)),
                );
                return (
                  <div
                    key={row.kmIndex}
                    className="flex items-center gap-2 text-[12px]"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    <span
                      className="grid shrink-0 place-items-center rounded-full text-[11px] font-black"
                      style={{
                        width: 26,
                        height: 26,
                        background: 'rgba(23, 64, 44, 0.1)',
                        color: '#17402C',
                      }}
                    >
                      {row.kmIndex}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div
                        className="h-2.5 w-full overflow-hidden rounded-full"
                        style={{ background: 'rgba(23, 64, 44, 0.08)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${barWidth}%`,
                            background: 'linear-gradient(90deg, #17402C, #34D399)',
                          }}
                        />
                      </div>
                    </div>

                    <strong className="w-16 shrink-0 text-right font-extrabold" style={{ color: 'var(--xp-hud-ink)' }}>
                      {row.paceLabel}
                    </strong>

                    <span
                      className="inline-flex w-14 shrink-0 items-center justify-end gap-0.5 text-[11px] font-bold"
                      style={{ color: row.elevDeltaM >= 0 ? '#D97706' : '#0284C7' }}
                    >
                      {row.elevDeltaM >= 0 ? (
                        <TrendingUp size={11} aria-hidden="true" />
                      ) : (
                        <TrendingDown size={11} aria-hidden="true" />
                      )}
                      {row.elevDeltaM >= 0 ? `+${row.elevDeltaM}` : row.elevDeltaM} m
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>
    </ExplorerNestedSubDrawer>
  );
}
