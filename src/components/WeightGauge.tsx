'use client';

import React, { useEffect, useRef } from 'react';

interface WeightGaugeProps {
  weightG: number;
  maxG?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  recommendedG?: number;
}

const SIZE_CLASS: Record<NonNullable<WeightGaugeProps['size']>, string> = {
  sm: 'h-[3px]',
  md: 'h-[4px]',
  lg: 'h-[6px]',
};

const TEXT_CLASS: Record<NonNullable<WeightGaugeProps['size']>, string> = {
  sm: 'text-[length:var(--lkv-text-caption-2)]',
  md: 'text-[length:var(--lkv-text-caption)]',
  lg: 'text-[length:var(--lkv-text-footnote)]',
};

export default function WeightGauge({
  weightG,
  maxG = 2000,
  showLabel = true,
  size = 'md',
  recommendedG,
}: WeightGaugeProps) {
  const pct = Math.min(100, (weightG / maxG) * 100);
  const displayWeight = weightG >= 1000
    ? `${(weightG / 1000).toFixed(2)} kg`
    : `${weightG} g`;

  const color = pct < 60 ? 'var(--lkv-success)' : pct < 85 ? 'var(--lkv-warning)' : 'var(--lkv-danger)';

  const weightLevel = pct < 33 ? 'léger' : pct < 66 ? 'moyen' : 'lourd';
  const ariaDescription = `Poids ${displayWeight}, ${weightLevel} (${Math.round(pct)}% du maximum de référence ${maxG >= 1000 ? `${(maxG / 1000).toFixed(1)} kg` : `${maxG} g`})`;

  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    el.style.width = '0%';
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'width var(--dur-slow) var(--ease-spring), background-color var(--dur-med) var(--lkv-ease)';
      el.style.width = `${pct}%`;
      el.style.backgroundColor = color;
    });
    return () => cancelAnimationFrame(raf);
  }, [pct, color]);

  const recommendedPct = recommendedG ? Math.min(100, (recommendedG / maxG) * 100) : null;

  return (
    <div
      className="w-full"
      role="meter"
      aria-valuenow={weightG}
      aria-valuemin={0}
      aria-valuemax={maxG}
      aria-label={ariaDescription}
      aria-valuetext={displayWeight}
    >
      {showLabel && (
        <div className="mb-[var(--space-2)] flex items-center justify-between">
          <span
            className={`font-mono ${TEXT_CLASS[size]} uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]`}
            aria-hidden="true"
          >
            POIDS
          </span>
          <span
            className={`font-mono ${TEXT_CLASS[size]} font-semibold`}
            style={{ color }}
            aria-hidden="true"
          >
            {displayWeight}
          </span>
        </div>
      )}
      <div className={`relative overflow-visible rounded-full bg-[color:var(--btn-tint)] ${SIZE_CLASS[size]}`} aria-hidden="true">
        <div
          ref={fillRef}
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        {recommendedPct !== null && (
          <div
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[color:var(--lkv-info)] opacity-60"
            style={{ left: `${recommendedPct}%` }}
            title={`Recommandé: ${recommendedG}g`}
          />
        )}
      </div>
      {size === 'lg' && (
        <div className="mt-[var(--space-1)] flex justify-between">
          <span className={`font-mono ${TEXT_CLASS[size]} text-[color:var(--lkv-text-muted)]`}>0</span>
          <span className={`font-mono ${TEXT_CLASS[size]} font-semibold`} style={{ color }}>{Math.round(pct)}%</span>
          <span className={`font-mono ${TEXT_CLASS[size]} text-[color:var(--lkv-text-muted)]`}>
            {maxG >= 1000 ? `${(maxG / 1000).toFixed(1)} kg` : `${maxG} g`}
          </span>
        </div>
      )}
    </div>
  );
}
