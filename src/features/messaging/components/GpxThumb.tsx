'use client';

// src/features/messaging/components/GpxThumb.tsx
//
// Vignette d'une trace GPX partagée : on télécharge le fichier une fois, on en
// extrait les points et on dessine le tracé en SVG (léger, pas de carte WebGL
// dans le fil). La carte interactive reste dans le drawer.

import React, { useEffect, useMemo, useState } from 'react';
import { useResolvedAttachmentUrl } from '../hooks/useAttachmentUrl';

export interface GpxThumbProps {
  content: string;
  width?: number;
  height?: number;
}

function parsePoints(xml: string): [number, number][] {
  const points: [number, number][] = [];
  const re = /<(?:trkpt|rtept|wpt)\b[^>]*\blat="(-?\d+(?:\.\d+)?)"[^>]*\blon="(-?\d+(?:\.\d+)?)"/g;
  let match = re.exec(xml);
  while (match) {
    const lat = Number.parseFloat(match[1]);
    const lon = Number.parseFloat(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lon, lat]);
    match = re.exec(xml);
  }
  return points;
}

/** Distance cumulée en km (haversine). */
function distanceKm(points: [number, number][]): number {
  const R = 6371;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [lon1, lat1] = points[i - 1];
    const [lon2, lat2] = points[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return total;
}

export function GpxThumb({ content, width = 84, height = 58 }: GpxThumbProps) {
  const url = useResolvedAttachmentUrl(content);
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('http'))))
      .then((text) => {
        if (!cancelled) setXml(text);
      })
      .catch(() => {
        if (!cancelled) setXml('');
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const shape = useMemo(() => {
    if (!xml) return null;
    const points = parsePoints(xml);
    if (points.length < 2) return { polyline: '', points: points.length, km: 0 };
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const pad = 6;
    const spanLng = maxLng - minLng || 1e-6;
    const spanLat = maxLat - minLat || 1e-6;
    const scale = Math.min((width - pad * 2) / spanLng, (height - pad * 2) / spanLat);
    const offX = (width - spanLng * scale) / 2;
    const offY = (height - spanLat * scale) / 2;
    const polyline = points
      .map(([lng, lat]) => `${(offX + (lng - minLng) * scale).toFixed(1)},${(offY + (maxLat - lat) * scale).toFixed(1)}`)
      .join(' ');
    return { polyline, points: points.length, km: distanceKm(points) };
  }, [xml, width, height]);

  return (
    <span className="mcard-thumb" style={{ width, height }} aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <defs>
          <linearGradient id="gpxbg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e7efe2" />
            <stop offset="1" stopColor="#d5e3d2" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} rx="12" fill="url(#gpxbg)" />
        {shape?.polyline ? (
          <polyline
            points={shape.polyline}
            fill="none"
            stroke="#2F6B45"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
    </span>
  );
}

export function gpxSummary(points: number, km: number): string {
  if (!points) return 'Trace GPX';
  const distance = km >= 1 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km * 1000)} m`;
  return `${points} points · ${distance}`;
}
