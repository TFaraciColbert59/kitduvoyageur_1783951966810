'use client';

// src/features/messaging/components/TraceThumb.tsx
//
// Vignette SVG d'un tracé (bulle de conversation) : légère, sans WebGL, avec
// le même langage que la carte d'aperçu (trait clair + liseré forest, départ
// creux, arrivée pleine). La projection corrige la longitude par cos(latitude)
// et conserve les proportions : le tracé n'est jamais déformé.

import React, { useId, useMemo } from 'react';
import { extractLngLat, projectLngLatToSvg, simplifyLngLat } from '@/lib/geo/traceCoordinates';
import { TRACE_STYLE } from '../lib/traceStyle';
import { TRACE_EMPTY_LABEL } from './TraceMap';

export interface TraceThumbProps {
  /** GeoJSON, tableau de points ou chaîne JSON : lu par `extractLngLat`. */
  geojson: unknown;
  width?: number;
  height?: number;
  /** Bande basse (px) laissée libre pour une légende posée par-dessus. */
  reserveBottom?: number;
  /** Marge interne (px). */
  pad?: number;
  emptyLabel?: string;
  /** Vignette en attente de la lecture du fichier. */
  loading?: boolean;
  className?: string;
}

const MAX_THUMB_POINTS = 400;

export function TraceThumb({
  geojson,
  width = 250,
  height = 160,
  reserveBottom = 0,
  pad = 18,
  emptyLabel = TRACE_EMPTY_LABEL,
  loading = false,
  className,
}: TraceThumbProps) {
  const projected = useMemo(() => {
    const coords = simplifyLngLat(extractLngLat(geojson), MAX_THUMB_POINTS);
    if (coords.length < 2) return null;
    return projectLngLatToSvg(coords, width, Math.max(height - reserveBottom, 24), pad);
  }, [geojson, width, height, reserveBottom, pad]);
  const gradientId = useId();

  return (
    <div
      className={`mtrace-thumb${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'inherit',
        width: '100%',
        height: '100%',
        background: `linear-gradient(180deg, ${TRACE_STYLE.thumbFrom}, ${TRACE_STYLE.thumbTo})`,
      }}
    >
      {projected ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Aperçu du tracé"
          style={{ display: 'block', width: '100%', height: '100%' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={TRACE_STYLE.thumbFrom} />
              <stop offset="1" stopColor={TRACE_STYLE.thumbTo} />
            </linearGradient>
          </defs>
          <rect width={width} height={height} fill={`url(#${gradientId})`} />
          <polyline
            points={projected.polyline}
            fill="none"
            stroke={TRACE_STYLE.casing}
            strokeWidth={TRACE_STYLE.casingWidth * 0.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={projected.polyline}
            fill="none"
            stroke={TRACE_STYLE.line}
            strokeWidth={TRACE_STYLE.lineWidth * 0.65}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={projected.end.x}
            cy={projected.end.y}
            r={TRACE_STYLE.markerRadius * 0.75}
            fill={TRACE_STYLE.endFill}
            stroke={TRACE_STYLE.endRing}
            strokeWidth={TRACE_STYLE.markerRingWidth * 0.7}
          />
          <circle
            cx={projected.start.x}
            cy={projected.start.y}
            r={TRACE_STYLE.markerRadius * 0.75}
            fill={TRACE_STYLE.startFill}
            stroke={TRACE_STYLE.startRing}
            strokeWidth={TRACE_STYLE.markerRingWidth * 0.7}
          />
        </svg>
      ) : (
        <div
          className="mtrace-thumb-empty"
          role="status"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: `0 16px ${reserveBottom}px`,
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: 12,
            lineHeight: 1.3,
          }}
        >
          {loading ? null : <span>{emptyLabel}</span>}
        </div>
      )}
    </div>
  );
}
