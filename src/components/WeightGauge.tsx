import React, { useEffect, useRef } from 'react';

interface WeightGaugeProps {
  weightG: number;
  maxG?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  recommendedG?: number;
}

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

  const heights = { sm: 'h-[3px]', md: 'h-[4px]', lg: 'h-[6px]' };
  const textSizes = { sm: 'text-[10px]', md: 'text-[11px]', lg: 'text-xs' };

  // Color based on threshold
  const color = pct < 60 ? '#22c55e' : pct < 85 ? '#f59e0b' : '#ef4444';

  // Describe weight level for screen readers
  const weightLevel = pct < 33 ? 'léger' : pct < 66 ? 'moyen' : 'lourd';
  const ariaDescription = `Poids ${displayWeight}, ${weightLevel} (${Math.round(pct)}% du maximum de référence ${maxG >= 1000 ? `${(maxG / 1000).toFixed(1)} kg` : `${maxG} g`})`;

  const fillRef = useRef<HTMLDivElement>(null);

  // Animate on mount and value change
  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    // Start from 0 then animate to target
    el.style.width = '0%';
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'width 400ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 300ms ease';
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
        <div className="flex items-center justify-between mb-1.5">
          <span
            className={`font-mono-data ${textSizes[size]} text-muted-foreground uppercase tracking-wider`}
            style={{ fontFamily: 'var(--font-mono)' }}
            aria-hidden="true"
          >
            POIDS
          </span>
          <span
            className={`font-mono-data ${textSizes[size]} font-600`}
            style={{ fontFamily: 'var(--font-mono)', color }}
            aria-hidden="true"
          >
            {displayWeight}
          </span>
        </div>
      )}
      <div className={`relative weight-gauge ${heights[size]} bg-muted rounded-full overflow-visible`} aria-hidden="true">
        <div
          ref={fillRef}
          className={`absolute left-0 top-0 h-full rounded-full`}
          style={{ width: `${pct}%`, backgroundColor: color, transition: 'width 400ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 300ms ease' }}
        />
        {/* Recommended marker */}
        {recommendedPct !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-info opacity-60"
            style={{ left: `${recommendedPct}%` }}
            title={`Recommandé: ${recommendedG}g`}
          />
        )}
      </div>
      {size === 'lg' && (
        <div className="flex justify-between mt-1">
          <span className="font-mono-data text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>0</span>
          <span className="font-mono-data text-[10px]" style={{ fontFamily: 'var(--font-mono)', color }}>{Math.round(pct)}%</span>
          <span className="font-mono-data text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
            {maxG >= 1000 ? `${(maxG / 1000).toFixed(1)} kg` : `${maxG} g`}
          </span>
        </div>
      )}
    </div>
  );
}