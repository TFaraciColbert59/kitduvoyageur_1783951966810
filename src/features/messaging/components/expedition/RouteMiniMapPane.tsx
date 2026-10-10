'use client';

import React from 'react';
import type { GPXSnapshot } from '../../types/outdoorObjects.types';

export interface RouteMiniMapPaneProps {
  snapshot?: {
    title?: string;
    distanceKm?: number;
    elevationGainM?: number;
    svgPolylinePath?: string;
    estimatedDurationMinutes?: number;
    bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  } | null;
  gpxTrackUrl?: string | null;
  title?: string;
  onOpenExplorer?: () => void;
  className?: string;
}

export const RouteMiniMapPane: React.FC<RouteMiniMapPaneProps> = ({
  snapshot,
  gpxTrackUrl,
  title = 'Tracé GPX de l\'Expédition',
  onOpenExplorer,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <h3 className="text-xs font-semibold text-[color:var(--lkv-text-primary)]">{title}</h3>
      {snapshot ? (
        <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] p-3 shadow-elevation-1">
          <div className="flex items-center justify-between text-xs text-[color:var(--lkv-text-primary)]">
            <span className="font-semibold">{snapshot.title}</span>
            <span className="text-[color:var(--lkv-text-secondary)]">
              {snapshot.distanceKm} km · +{snapshot.elevationGainM} m
            </span>
          </div>

          {snapshot.svgPolylinePath && (
            <svg viewBox="0 0 240 90" className="mt-2 h-20 w-full" aria-hidden="true">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                points={snapshot.svgPolylinePath}
              />
            </svg>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--glass-border)] pt-2 text-xs">
            {snapshot.estimatedDurationMinutes ? (
              <span className="text-[color:var(--lkv-text-secondary)]">
                Durée estimée : {Math.floor(snapshot.estimatedDurationMinutes / 60)}h
                {snapshot.estimatedDurationMinutes % 60 > 0
                  ? `${snapshot.estimatedDurationMinutes % 60}m`
                  : ''}
              </span>
            ) : (
              <span className="text-[color:var(--lkv-text-secondary)]">Trace vectorielle</span>
            )}

            <div className="flex items-center gap-2">
              {gpxTrackUrl && (
                <a
                  href={gpxTrackUrl}
                  download={`${snapshot.title || 'trace'}.gpx`}
                  className="flex h-[44px] min-h-[44px] items-center justify-center rounded-xl px-3 text-xs font-medium text-[color:var(--lkv-primary)] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none"
                >
                  Télécharger GPX
                </a>
              )}
              {onOpenExplorer && (
                <button
                  type="button"
                  onClick={onOpenExplorer}
                  className="flex h-[44px] min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--lkv-primary)] px-3 text-xs font-medium text-white shadow-sm hover:opacity-95 focus-visible:outline-none"
                >
                  Explorer
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-[color:var(--lkv-text-secondary)]">Aucun tracé associé</div>
      )}
    </div>
  );
};
