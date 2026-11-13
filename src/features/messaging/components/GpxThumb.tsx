'use client';

// src/features/messaging/components/GpxThumb.tsx
//
// Vignette d'une trace GPX partagée dont le tracé n'est pas dans les
// métadonnées du message (envois anciens) : on télécharge le fichier une fois
// (mis en cache pour la session), on en lit le tracé (trkpt, sinon rtept) et on
// le dessine en SVG via `TraceThumb`. Aucun tracé de remplacement : un fichier
// illisible ou sans trace montre « Tracé indisponible ».

import React, { useEffect, useState } from 'react';
import { GPXEngine } from '@/features/hiking/gpx/GPXEngine';
import type { LngLat } from '@/lib/geo/traceCoordinates';
import { readLimitedText } from '../lib/gpxFetch';
import { useResolvedAttachmentUrl } from '../hooks/useAttachmentUrl';
import { TraceThumb } from './TraceThumb';

export interface GpxThumbProps {
  content: string;
  width?: number;
  height?: number;
  reserveBottom?: number;
}

const MAX_GPX_POINTS = 20_000;
const CACHE_LIMIT = 40;
const trackCache = new Map<string, Promise<LngLat[][]>>();

/** Segments du tracé d'un GPX distant (≤ 5 Mo), mémorisés par URL (un échec n'est pas mémorisé). */
export function loadGpxTrack(url: string): Promise<LngLat[][]> {
  const hit = trackCache.get(url);
  if (hit) return hit;
  const pending = fetch(url)
    .then((r) => (r.ok ? readLimitedText(r) : Promise.reject(new Error('http'))))
    .then((text) => GPXEngine.extractTrack(text, MAX_GPX_POINTS).segments.map((segment) => segment.coordinates as LngLat[]));
  trackCache.set(url, pending);
  if (trackCache.size > CACHE_LIMIT) {
    const oldest = trackCache.keys().next().value;
    if (oldest !== undefined) trackCache.delete(oldest);
  }
  pending.catch(() => trackCache.delete(url));
  return pending;
}

export function GpxThumb({ content, width = 250, height = 160, reserveBottom = 0 }: GpxThumbProps) {
  const url = useResolvedAttachmentUrl(content);
  const [coords, setCoords] = useState<LngLat[][] | null>(null);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    loadGpxTrack(url)
      .then((track) => {
        if (!cancelled) setCoords(track);
      })
      .catch(() => {
        if (!cancelled) setCoords([]);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <TraceThumb
      geojson={coords}
      width={width}
      height={height}
      reserveBottom={reserveBottom}
      loading={coords === null}
      emptyLabel="Tracé illisible dans ce fichier"
    />
  );
}

export function gpxSummary(points: number, km: number): string {
  if (!points) return 'Trace GPX';
  const distance = km >= 1 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km * 1000)} m`;
  return `${points} points · ${distance}`;
}
