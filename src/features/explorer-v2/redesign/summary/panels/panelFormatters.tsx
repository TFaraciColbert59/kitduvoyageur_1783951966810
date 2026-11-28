'use client';

import React from 'react';
import type { MetricHonestyBadge } from '../summaryAnalysisEngine';

export function formatPaceMinKm(paceMinPerKm: number | null | undefined): string {
  if (paceMinPerKm === null || paceMinPerKm === undefined || !Number.isFinite(paceMinPerKm) || paceMinPerKm <= 0) {
    return '—';
  }
  const totalSec = Math.round(paceMinPerKm * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDurationShort(totalS: number | null | undefined): string {
  if (totalS === null || totalS === undefined || !Number.isFinite(totalS) || totalS < 0) {
    return '—';
  }
  if (totalS === 0) return '0:00';
  const rounded = Math.round(totalS);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatClockLocal(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return '—';
  }
}

export function HonestyBadge({
  quality,
  label,
}: {
  readonly quality: MetricHonestyBadge;
  readonly label?: string;
}) {
  const text =
    label ??
    (quality === 'measured' ? 'Mesurée' : quality === 'estimated' ? 'Estimée' : 'Non captée');
  return (
    <span className={`xp20-exp-badge is-${quality}`} data-metric-quality={quality}>
      {text}
    </span>
  );
}

export interface RadialGaugeProps {
  readonly value: number | null;
  readonly max?: number;
  readonly displayValue: string;
  readonly unit?: string;
  readonly label: string;
  readonly subLabel?: string;
  readonly tone?: 'forest' | 'amber' | 'sky' | 'coral' | 'violet';
}

const TONE_HEX: Record<NonNullable<RadialGaugeProps['tone']>, string> = {
  forest: '#0e8f5b',
  amber: '#d97706',
  sky: '#0284c7',
  coral: '#dc2626',
  violet: '#7c3aed',
};

export function RadialGauge({
  value,
  max = 100,
  displayValue,
  unit,
  label,
  subLabel,
  tone = 'forest',
}: RadialGaugeProps) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct =
    value !== null && Number.isFinite(value) && max > 0
      ? Math.max(0.04, Math.min(1, value / max))
      : 0;
  const dashOffset = circ * (1 - pct);
  const stroke = TONE_HEX[tone];

  return (
    <div className="xp20-exp-gauge-card">
      <div className="xp20-exp-gauge-ring-wrap">
        <svg viewBox="0 0 70 70" width="68" height="68" aria-hidden="true">
          <circle
            cx="35"
            cy="35"
            r={r}
            fill="none"
            stroke="var(--xp-hud-border, rgba(23, 64, 44, 0.14))"
            strokeWidth="5.5"
          />
          {pct > 0 ? (
            <circle
              cx="35"
              cy="35"
              r={r}
              fill="none"
              stroke={stroke}
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 35 35)"
            />
          ) : null}
        </svg>
        <div className="xp20-exp-gauge-center">
          <strong>{displayValue}</strong>
          {unit ? <small>{unit}</small> : null}
        </div>
      </div>
      <span className="xp20-exp-gauge-label">{label}</span>
      {subLabel ? <span className="xp20-exp-gauge-sub">{subLabel}</span> : null}
    </div>
  );
}
