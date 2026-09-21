'use client';

import React from 'react';

interface WaypointItem {
  id: string;
  name: string;
  italicPart?: string;
  meta: string;
  status: 'done' | 'current' | 'future';
  iconType?: 'check' | 'dot' | 'photo' | 'summit';
}

interface DesktopLeftPanelProps {
  distanceKm?: number;
  totalDistanceKm?: number;
  progressPercent?: number;
  startTime?: string;
  etaTime?: string;
  elapsedTimeStr?: string;
  maxAltitudeM?: number;
  waypoints?: WaypointItem[];
}

export default function DesktopLeftPanel({
  distanceKm = 0,
  totalDistanceKm = 0,
  progressPercent = 0,
  startTime = '--:--',
  etaTime,
  elapsedTimeStr = '00m',
  waypoints = [],
}: DesktopLeftPanelProps) {
  const pct = totalDistanceKm > 0
    ? Math.min(100, Math.max(0, progressPercent ?? (distanceKm / totalDistanceKm) * 100))
    : 0;

  return (
    <div className="hidden md:flex absolute top-[96px] left-5 w-[320px] max-h-[calc(100%-180px)] flex-col gap-3.5 z-30 select-none overflow-y-auto custom-scrollbar">
      {/* 1. Progression Panel */}
      <div className="bg-[color:var(--lkv-surface)]/92 backdrop-blur-2xl border border-[color:var(--lkv-primary)]/07 rounded-2xl shadow-xl overflow-hidden p-4">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-semibold">
            Progression
          </span>
          <span className="font-mono text-[10px] text-[color:var(--lkv-ink-300)] tracking-wide">
            <em className="font-serif italic font-normal text-[color:var(--lkv-primary)] text-xs">{elapsedTimeStr}</em> écoulées
          </span>
        </div>

        <div className="flex justify-between items-baseline mb-2">
          <div className="text-2xl font-medium tracking-tight text-[color:var(--lkv-primary)]">
            {distanceKm.toFixed(1)}
            <em className="font-serif italic font-normal text-sm text-[color:var(--lkv-primary)] ml-0.5">
              / {totalDistanceKm.toFixed(1)} km
            </em>
          </div>
          <div className="font-mono text-[11px] font-semibold text-[color:var(--lkv-primary)] tracking-wide px-2 py-0.5 bg-[color:var(--lkv-forest-100)]/40 rounded">
            {Math.round(pct)} %
          </div>
        </div>

        {/* Progress Bar with End Glow Dot */}
        <div className="h-1 bg-[color:var(--lkv-primary)]/08 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-[color:var(--lkv-primary)] rounded-full relative transition-all duration-500"
            style={{ width: `${pct}%` }}
          >
            <div className="absolute -right-1.5 -top-0.5 w-2 h-2 rounded-full bg-[color:var(--lkv-primary)] shadow-md" />
          </div>
        </div>

        <div className="mt-2.5 flex justify-between font-mono text-[10px] text-[color:var(--lkv-text-muted)] tracking-wide">
          <span>DÉPART · {startTime}</span>
          <span>ETA · {etaTime}</span>
        </div>
      </div>

      {/* 2. Waypoints List Panel */}
      <div className="bg-[color:var(--lkv-surface)]/92 backdrop-blur-2xl border border-[color:var(--lkv-primary)]/07 rounded-2xl shadow-xl overflow-hidden p-4 space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-semibold">
            Itinéraire · {waypoints.length} étapes
          </span>
        </div>

        {/* Waypoints Timeline */}
        <div className="relative pl-1 space-y-2">
          {/* Connecting Vertical Line */}
          <div className="absolute left-[19px] top-3 bottom-5 w-[2px] bg-gradient-to-b from-[color:var(--lkv-primary)] via-[color:var(--lkv-primary)] to-[color:var(--lkv-primary)]/15" />

          {waypoints.map((wp) => (
            <div
              key={wp.id}
              className={`flex items-start gap-3 p-2 rounded-xl relative z-10 transition-colors ${
                wp.status === 'current' ? 'bg-[color:var(--lkv-forest-200)]/20' : ''
              }`}
            >
              {/* Dot Icon */}
              <div
                className={`w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs z-10 ${
                  wp.status === 'done'
                    ? 'bg-[color:var(--lkv-primary)] border-[color:var(--lkv-primary)] text-[color:var(--lkv-forest-100)]'
                    : wp.status === 'current'
                    ? 'bg-[color:var(--lkv-forest-200)] border-[color:var(--lkv-primary)] text-[color:var(--lkv-forest-950)] shadow-sm'
                    : 'bg-[color:var(--lkv-surface)] border-[color:var(--lkv-primary)]/20 text-[color:var(--lkv-ink-300)]'
                }`}
              >
                {wp.status === 'done' ? (
                  <svg className="w-3 h-3 stroke-current stroke-[2.6] fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                  </svg>
                ) : wp.status === 'current' ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--lkv-forest-950)]" />
                ) : wp.iconType === 'photo' ? (
                  <svg className="w-2.5 h-2.5 stroke-current stroke-[1.8] fill-none" viewBox="0 0 24 24">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5 stroke-current stroke-[1.8] fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l3-9h12l3 9M6 12l6-8 6 8" />
                  </svg>
                )}
              </div>

              {/* Waypoint Text */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div
                  className={`text-xs font-medium leading-tight ${
                    wp.status === 'future' ? 'text-[color:var(--lkv-text-muted)]' : 'text-[color:var(--lkv-primary)]'
                  }`}
                >
                  {wp.name}{' '}
                  {wp.italicPart && (
                    <em className="font-serif italic font-normal text-[color:var(--lkv-primary)]">{wp.italicPart}</em>
                  )}
                </div>
                <div
                  className={`font-mono text-[10px] tracking-wide mt-0.5 ${
                    wp.status === 'current' ? 'text-[color:var(--lkv-primary)] font-semibold' : 'text-[color:var(--lkv-text-muted)]'
                  }`}
                >
                  {wp.meta}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
