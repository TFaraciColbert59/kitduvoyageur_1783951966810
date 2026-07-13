import React from 'react';

interface WeightGaugeProps {
  weightG: number;
  maxG?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function WeightGauge({
  weightG,
  maxG = 2000,
  showLabel = true,
  size = 'md',
}: WeightGaugeProps) {
  const pct = Math.min(100, (weightG / maxG) * 100);
  const displayWeight = weightG >= 1000
    ? `${(weightG / 1000).toFixed(2)} kg`
    : `${weightG} g`;

  const heights = { sm: 'h-[3px]', md: 'h-[4px]', lg: 'h-[6px]' };
  const textSizes = { sm: 'text-[10px]', md: 'text-[11px]', lg: 'text-xs' };

  // Describe weight level for screen readers
  const weightLevel = pct < 33 ? 'léger' : pct < 66 ? 'moyen' : 'lourd';
  const ariaDescription = `Poids ${displayWeight}, ${weightLevel} (${Math.round(pct)}% du maximum de référence ${maxG >= 1000 ? `${(maxG / 1000).toFixed(1)} kg` : `${maxG} g`})`;

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
        <div className="flex items-center justify-between mb-1.5">
          <span
            className={`font-mono-data ${textSizes[size]} text-muted-foreground uppercase tracking-wider`}
            style={{ fontFamily: 'var(--font-mono)' }}
            aria-hidden="true"
          >
            POIDS
          </span>
          <span
            className={`font-mono-data ${textSizes[size]} font-600 text-info`}
            style={{ fontFamily: 'var(--font-mono)' }}
            aria-hidden="true"
          >
            {displayWeight}
          </span>
        </div>
      )}
      <div className={`weight-gauge ${heights[size]}`} aria-hidden="true">
        <div
          className="weight-gauge-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}