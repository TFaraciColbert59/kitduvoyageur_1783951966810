'use client';

import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ElevationSample {
  distanceKm: number;
  altitudeM: number;
  gradePct?: number;
}

export interface GpsElevationLiveViewProps {
  samples: ReadonlyArray<ElevationSample>;
  onScrubIndex?: (index: number | null) => void;
  height?: number;
}

/**
 * Lot 07 — Profil altimétrique live scrubbable (Recharts), synchronisable avec le curseur carte.
 */
export function GpsElevationLiveView({
  samples,
  onScrubIndex,
  height = 140,
}: GpsElevationLiveViewProps) {
  const data = useMemo(
    () =>
      samples.map((s, idx) => ({
        idx,
        km: Number(s.distanceKm.toFixed(2)),
        ele: Math.round(s.altitudeM),
        grade: s.gradePct !== undefined ? Number(s.gradePct.toFixed(1)) : 0,
      })),
    [samples],
  );

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl p-4 text-[12px] font-semibold"
        style={{
          height,
          background: 'var(--lkv-surface-muted, #edf1ea)',
          color: 'var(--xp-hud-ink-muted)',
        }}
      >
        Profil altimétrique en cours d’acquisition…
      </div>
    );
  }

  return (
    <div
      data-testid="xp20-live-elevation-view"
      data-base-ui-swipe-ignore="x"
      className="w-full rounded-2xl p-2"
      style={{
        height: height + 16,
        background: 'var(--lkv-surface-elevated, #ffffff)',
        border: '0.5px solid var(--xp-hud-border)',
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
          onMouseMove={(state) => {
            if (typeof state?.activeTooltipIndex === 'number') {
              onScrubIndex?.(state.activeTooltipIndex);
            }
          }}
          onMouseLeave={() => onScrubIndex?.(null)}
        >
          <defs>
            <linearGradient id="xp20EleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--xp-hud-accent, #226148)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--xp-hud-accent, #226148)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <XAxis dataKey="km" tick={{ fontSize: 10 }} unit=" km" />
          <YAxis tick={{ fontSize: 10 }} unit=" m" domain={['dataMin - 20', 'dataMax + 20']} />
          <Tooltip
            formatter={(val: unknown, name: unknown) =>
              name === 'ele' ? [`${val} m`, 'Altitude'] : [`${val} %`, 'Pente']
            }
            labelFormatter={(label) => `${label} km`}
          />
          <Area
            type="monotone"
            dataKey="ele"
            stroke="var(--xp-hud-accent, #226148)"
            strokeWidth={2}
            fill="url(#xp20EleGrad)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
