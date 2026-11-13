'use client';

import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { ElevationPoint } from '@/features/carnet/detail/types';

export interface CarnetAltitudeProps {
  points: ElevationPoint[];
  height?: number;
  interactive?: boolean;
  onScrub?: (point: ElevationPoint | null) => void;
  label?: string;
}

/**
 * Profil altimétrique réel : sparkline des altitudes mesurées, curseur
 * tactile/clavier qui donne l'altitude et la distance du point choisi.
 *
 * Sans deux mesures réelles, le composant ne rend rien : il n'invente ni
 * altitude, ni courbe, ni dénivelé.
 */
export function CarnetAltitude({
  points,
  height = 28,
  interactive = false,
  onScrub,
  label = 'Profil d’altitude',
}: CarnetAltitudeProps) {
  const gradientId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const total = points[points.length - 1].distanceKm || 1;
    const elevations = points.map((point) => point.elevationM);
    const min = Math.min(...elevations);
    const max = Math.max(...elevations);
    const span = max - min || 1;
    const coords = points.map((point) => ({
      x: (point.distanceKm / total) * 100,
      y: 100 - ((point.elevationM - min) / span) * 100,
    }));
    /*
     * Un chemin par morceau : `segmentIndex` vient du serveur. Sans lui, tout
     * le profil reste un seul morceau. On ne relie jamais deux index
     * différents, même si la distance cumulée est continue.
     */
    const groups = new Map<number, number[]>();
    points.forEach((point, index) => {
      const segmentIndex = point.segmentIndex ?? 0;
      const list = groups.get(segmentIndex) ?? [];
      list.push(index);
      groups.set(segmentIndex, list);
    });
    const segments = [...groups.entries()].map(([segmentIndex, indexes]) => {
      const segmentCoords = indexes.map((index) => coords[index]);
      const line = segmentCoords
        .map(
          (coord, index) =>
            `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`
        )
        .join(' ');
      const firstX = segmentCoords[0]?.x ?? 0;
      const lastX = segmentCoords[segmentCoords.length - 1]?.x ?? 0;
      return {
        segmentIndex,
        coords: segmentCoords,
        line,
        area: `${line} L${lastX.toFixed(2)},100 L${firstX.toFixed(2)},100 Z`,
      };
    });
    return { total, min, max, coords, segments };
  }, [points]);

  const selectAt = useCallback(
    (ratio: number) => {
      if (!geometry) return;
      const clamped = Math.min(1, Math.max(0, ratio));
      let nearest = 0;
      let best = Infinity;
      geometry.coords.forEach((coord, index) => {
        const delta = Math.abs(coord.x / 100 - clamped);
        if (delta < best) {
          best = delta;
          nearest = index;
        }
      });
      setCursor(nearest);
      onScrub?.(points[nearest] ?? null);
    },
    [geometry, onScrub, points]
  );

  const ratioFromEvent = useCallback((clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return (clientX - rect.left) / rect.width;
  }, []);

  if (!geometry) return null;

  const selected = cursor !== null ? geometry.coords[cursor] : null;
  const selectedPoint = cursor !== null ? points[cursor] : null;

  return (
    <svg
      ref={svgRef}
      className={`lkdv-altitude${interactive ? ' is-interactive' : ''}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ height }}
      role={interactive ? 'slider' : 'img'}
      aria-label={label}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? points.length - 1 : undefined}
      aria-valuenow={interactive ? (cursor ?? 0) : undefined}
      aria-valuetext={
        interactive && selectedPoint
          ? `${Math.round(selectedPoint.elevationM)} mètres à ${selectedPoint.distanceKm.toFixed(1)} kilomètres`
          : undefined
      }
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={(event) => {
        if (!interactive) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        selectAt(ratioFromEvent(event.clientX));
      }}
      onPointerMove={(event) => {
        if (!interactive || event.buttons === 0) return;
        selectAt(ratioFromEvent(event.clientX));
      }}
      onPointerLeave={() => {
        if (!interactive) return;
        setCursor(null);
        onScrub?.(null);
      }}
      onKeyDown={(event) => {
        if (!interactive) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const current = cursor ?? 0;
        const next = Math.min(
          points.length - 1,
          Math.max(0, current + (event.key === 'ArrowRight' ? 1 : -1))
        );
        setCursor(next);
        onScrub?.(points[next] ?? null);
      }}
    >
      <defs>
        <linearGradient id={`alt-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--good, #3d7a52)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--good, #3d7a52)" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {geometry.segments.map((segment) => (
        <g key={segment.segmentIndex} data-altitude-segment={segment.segmentIndex}>
          <path d={segment.area} fill={`url(#alt-${gradientId})`} />
          <path
            d={segment.line}
            fill="none"
            stroke="var(--good, #3d7a52)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            data-altitude-line={segment.segmentIndex}
          />
        </g>
      ))}
      {selected ? (
        <>
          <line
            x1={selected.x}
            x2={selected.x}
            y1="0"
            y2="100"
            stroke="var(--tint, #17402c)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            opacity="0.55"
          />
          <circle
            cx={selected.x}
            cy={selected.y}
            r="2.6"
            fill="var(--tint-ink, #fff)"
            stroke="var(--tint, #17402c)"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}
    </svg>
  );
}
