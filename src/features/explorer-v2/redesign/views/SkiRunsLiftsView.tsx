'use client';

import React from 'react';
import { MountainSnow, Snowflake, TrendingDown } from 'lucide-react';

export interface SkiRunsLiftsViewProps {
  runsCount: number;
  verticalDescentM: number;
  liftAscentExcludedM: number;
  maxSpeedKmh: number;
  beraRiskLevel?: number | null;
  currentlyOnLift?: boolean;
}

/**
 * Lot 10 — Vue spécialisée Ski Alpin / Snowboard / Enduro DH :
 * Sépare strictement les descentes skiées (D−) des remontées mécaniques (D+ exclu).
 */
export function SkiRunsLiftsView({
  runsCount,
  verticalDescentM,
  liftAscentExcludedM,
  maxSpeedKmh,
  beraRiskLevel = null,
  currentlyOnLift = false,
}: SkiRunsLiftsViewProps) {
  return (
    <div data-testid="xp20-view-ski-runs-lifts" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between rounded-2xl px-3 py-2 text-[12px] font-extrabold" style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}>
        <span className="inline-flex items-center gap-1.5">
          <Snowflake size={14} aria-hidden="true" />
          {currentlyOnLift ? 'Remontée mécanique détectée (D+ exclu)' : 'Mode Descente actif'}
        </span>
        {beraRiskLevel !== null ? <span>BERA {beraRiskLevel}/5</span> : null}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl p-2.5" style={{ background: 'var(--lkv-surface-elevated, #ffffff)', border: '0.5px solid var(--xp-hud-border)' }}>
          <span className="block text-[10.5px] font-bold uppercase" style={{ color: 'var(--xp-hud-ink-muted)' }}>Descentes</span>
          <strong className="text-[20px] font-black">{runsCount}</strong>
        </div>
        <div className="rounded-2xl p-2.5" style={{ background: 'var(--lkv-surface-elevated, #ffffff)', border: '0.5px solid var(--xp-hud-border)' }}>
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase" style={{ color: 'var(--xp-hud-ink-muted)' }}>
            <TrendingDown size={11} aria-hidden="true" />
            D− skié
          </span>
          <strong className="text-[20px] font-black">−{Math.round(verticalDescentM)} m</strong>
        </div>
        <div className="rounded-2xl p-2.5" style={{ background: 'var(--lkv-surface-elevated, #ffffff)', border: '0.5px solid var(--xp-hud-border)' }}>
          <span className="block text-[10.5px] font-bold uppercase" style={{ color: 'var(--xp-hud-ink-muted)' }}>Vitesse max</span>
          <strong className="text-[20px] font-black">{maxSpeedKmh.toFixed(1)} km/h</strong>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: 'var(--lkv-surface-elevated, #ffffff)', border: '0.5px solid var(--xp-hud-border)' }}>
        <span className="inline-flex items-center gap-1.5">
          <MountainSnow size={14} aria-hidden="true" />
          D+ remontées mécaniques écarté
        </span>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(liftAscentExcludedM)} m</strong>
      </div>
    </div>
  );
}
