'use client';

// src/features/messaging/components/TraceThumb.tsx
//
// Vignette SVG d'un tracé (bulle de conversation) : légère, sans WebGL, avec
// le même langage que la carte d'aperçu (trait clair + liseré forest, départ
// creux, arrivée pleine). La projection corrige la longitude par cos(latitude)
// et conserve les proportions : le tracé n'est jamais déformé.

import React, { useId, useMemo } from 'react';
import { geometrySegments, projectSegmentsToSvg, simplifySegments } from '@/lib/geo/traceCoordinates';
import { TRACE_EMPTY_LABEL, TRACE_STYLE } from '../lib/traceStyle';

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
  /** Mention posée sur la vignette (« Indicatif » pour un tracé schématique). */
  badge?: string;
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
  badge,
  className,
}: TraceThumbProps) {
  const projected = useMemo(() => {
    // Segments séparés : une polyline par segment, jamais de droite entre deux segments.
    const segments = simplifySegments(geometrySegments(geojson), MAX_THUMB_POINTS);
    if (segments.length === 0) return null;
    return projectSegmentsToSvg(segments, width, Math.max(height - reserveBottom, 24), pad);
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
          {projected.polylines.map((points, index) => (
            <polyline
              key={`c${index}`}
              points={points}
              fill="none"
              stroke={TRACE_STYLE.casing}
              strokeWidth={TRACE_STYLE.casingWidth * 0.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {projected.polylines.map((points, index) => (
            <polyline
              key={`l${index}`}
              points={points}
              fill="none"
              stroke={TRACE_STYLE.line}
              strokeWidth={TRACE_STYLE.lineWidth * 0.65}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
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
      {badge && projected ? (
        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.9)',
            color: '#56665d',
            fontSize: 10,
            fontWeight: 650,
            lineHeight: 1.4,
          }}
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}
