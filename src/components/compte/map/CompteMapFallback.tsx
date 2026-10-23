'use client';

import React from 'react';
import { boundsOf } from '@/features/compte/map/geometry';
import type { MapMassif, MapTrack } from '@/features/compte/map/types';

const WIDTH = 320;
const HEIGHT = 180;
const PAD = 16;

/** Une seule projection pour toutes les traces : deux sorties ne doivent pas
    être étirées chacune dans son propre cadre. */
function projector(tracks: MapTrack[], massifs: MapMassif[]) {
  const all = [
    ...tracks.flatMap((track) => track.coordinates),
    ...massifs.map((massif) => massif.center),
  ];
  const bounds = boundsOf(all) ?? [-5, 41, 10, 51];
  const [west, south, east, north] = bounds;
  const dx = Math.max(east - west, 1e-6);
  const dy = Math.max(north - south, 1e-6);
  return (point: { lng: number; lat: number }) => ({
    x: PAD + ((point.lng - west) / dx) * (WIDTH - PAD * 2),
    y: HEIGHT - PAD - ((point.lat - south) / dy) * (HEIGHT - PAD * 2),
  });
}

export function CompteMapFallback({
  tracks,
  massifs,
}: {
  tracks: MapTrack[];
  massifs: MapMassif[];
}) {
  const project = projector(tracks, massifs);
  return (
    <div className="lkdv-map-fallback" role="img" aria-label="Carte simplifiée de tes sorties">
      <svg viewBox="0 0 320 180" aria-hidden="true">
        <defs>
          <linearGradient id="lkdv-fallback-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#16241b" />
            <stop offset="1" stopColor="#0b101b" />
          </linearGradient>
        </defs>
        <rect width="320" height="180" fill="url(#lkdv-fallback-bg)" />
        {tracks.map((track) => {
          const points = track.coordinates.map(project);
          return (
            <polyline
              key={track.id}
              points={points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="#A6C1A0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          );
        })}
        {massifs.map((massif) => {
          const { x, y } = project(massif.center);
          return (
            <circle
              key={massif.id}
              cx={x}
              cy={y}
              r="3"
              fill="#C89A3B"
              stroke="#fff"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <span>Carte simplifiée</span>
    </div>
  );
}

export default CompteMapFallback;
