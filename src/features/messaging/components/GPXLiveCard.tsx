'use client';

import React, { useId } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { GPXSnapshot } from '../types/outdoorObjects.types';

export interface GPXLiveCardProps {
  snapshot: GPXSnapshot;
  isMine?: boolean;
  onOpenMap?: (snapshot: GPXSnapshot) => void;
}

function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export const GPXLiveCard: React.FC<GPXLiveCardProps> = React.memo(({
  snapshot,
  isMine = false,
  onOpenMap,
}) => {
  const { haptic } = useHapticFeedback();
  const reactId = useId().replace(/:/g, '');
  const gradId = `gpx-grad-${snapshot.id ? `${snapshot.id}-${reactId}` : reactId}`;

  // Safe router instance resilient to SSR & unit tests without App Router mock
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }

  const handleCardClick = () => {
    haptic('light');
    if (onOpenMap) {
      onOpenMap(snapshot);
    } else if (snapshot.id) {
      const destination = `/explorer?trail=${snapshot.id}`;
      if (router) {
        router.push(destination);
      } else if (typeof window !== 'undefined') {
        window.location.assign(destination);
      }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic('medium');
  };

  return (
    <article
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      aria-label={`Tracé GPX : ${snapshot.title}`}
      className={`group relative my-1.5 flex w-full max-w-[320px] cursor-pointer flex-col overflow-hidden rounded-2xl border p-3.5 transition-all active:scale-[0.98] ${
        isMine
          ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]'
          : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-secondary)]/20 text-[color:var(--lkv-primary)]">
            <Icon name="navigation" size={14} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-xs font-semibold leading-tight">
              {snapshot.title || 'Tracé GPX'}
            </h4>
            <span className="font-mono text-[10px] opacity-70">Trace vectorielle</span>
          </div>
        </div>

        {snapshot.gpxFileUrl || snapshot.gpxUrl ? (
          <a
            href={snapshot.gpxFileUrl || snapshot.gpxUrl}
            download={`${snapshot.title || 'trace'}.gpx`}
            onClick={handleDownload}
            aria-label="Télécharger le fichier GPX"
            className="flex size-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-[color:var(--lkv-text-secondary)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none"
          >
            <Icon name="download" size={16} aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {/* SVG Polyline Vector Rendering — 0 Network Fetch, Instant Mount */}
      <div className="relative mt-2 h-20 w-full overflow-hidden rounded-xl bg-black/[0.03] p-1 dark:bg-white/[0.03]">
        <svg
          viewBox="0 0 240 80"
          className="size-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          role="presentation"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--lkv-secondary)" />
              <stop offset="100%" stopColor="var(--lkv-primary)" />
            </linearGradient>
          </defs>
          {/* Contrast halo */}
          <polyline
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={snapshot.svgPolylinePath}
          />
          {/* Primary polyline path */}
          <polyline
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={snapshot.svgPolylinePath}
          />
        </svg>

        <div className="pointer-events-none absolute bottom-1 right-2 font-mono text-[9px] font-semibold opacity-50">
          Aperçu 2D
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-2.5 grid grid-cols-3 divide-x divide-black/[0.06] border-t border-black/[0.06] py-2 text-center dark:divide-white/[0.08] dark:border-white/[0.08]">
        <div className="px-1">
          <span className="block text-[9px] font-medium uppercase tracking-wider opacity-60">
            Distance
          </span>
          <span className="font-mono text-xs font-bold tabular-nums">
            {snapshot.distanceKm.toFixed(1)} km
          </span>
        </div>
        <div className="px-1">
          <span className="block text-[9px] font-medium uppercase tracking-wider opacity-60">
            Dénivelé
          </span>
          <span className="font-mono text-xs font-bold tabular-nums text-[color:var(--lkv-action)]">
            +{Math.round(snapshot.elevationGainM)} m
          </span>
        </div>
        <div className="px-1">
          <span className="block text-[9px] font-medium uppercase tracking-wider opacity-60">
            Durée
          </span>
          <span className="font-mono text-xs font-bold tabular-nums">
            {formatDuration(snapshot.estimatedDurationMinutes)}
          </span>
        </div>
      </div>

      {/* Action CTA Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleCardClick();
        }}
        className="mt-2 flex h-[44px] min-h-[44px] w-full items-center justify-center rounded-xl bg-[color:var(--lkv-primary)] text-xs font-medium text-[color:var(--lkv-text-inverted)] transition-transform active:scale-95"
        aria-label="Voir la trace détaillée"
      >
        Voir la trace détaillée
      </button>
    </article>
  );
});

GPXLiveCard.displayName = 'GPXLiveCard';
