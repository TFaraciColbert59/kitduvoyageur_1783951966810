'use client';

import React from 'react';
import type { OutingPoint } from '@/features/compte/server/sorties';
import type { WeatherIcon } from '@/features/compte/server/weather';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export function formatDate(value: string | null): string {
  if (!value) return 'Date non renseignée';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date non renseignée';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
}

export function formatWeight(grams: number | null): string {
  if (grams === null || grams <= 0) return '—';
  if (grams >= 1000) return `${formatNumber(grams / 1000)} kg`;
  return `${Math.round(grams)} g`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

export function weatherIcon(icon: WeatherIcon, size = 16): React.ReactNode {
  const props = { size, 'aria-hidden': true as const };
  switch (icon) {
    case 'sun':
      return <LKDVIcon name="soleil" {...props} />;
    case 'partly':
      return <LKDVIcon name="meteo" {...props} />;
    case 'cloud':
      return <LKDVIcon name="meteo" {...props} />;
    case 'rain':
      return <LKDVIcon name="pluie" {...props} />;
    case 'snow':
      return <LKDVIcon name="neige" {...props} />;
    case 'storm':
      return <LKDVIcon name="meteo_extreme" {...props} />;
    case 'fog':
      return <LKDVIcon name="meteo" {...props} />;
    default:
      return <LKDVIcon name="meteo" {...props} />;
  }
}

function downsample(points: OutingPoint[], max = 180): OutingPoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

export function TraceMap({ points, className }: { points: OutingPoint[]; className?: string }) {
  const sampled = downsample(points);
  if (sampled.length < 2) {
    return <div className={`lkdv-sortie-trace-empty ${className ?? ''}`}>Aucune trace GPS</div>;
  }
  const lats = sampled.map((point) => point.lat);
  const lngs = sampled.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = Math.max(maxLat - minLat, 1e-6);
  const spanLng = Math.max(maxLng - minLng, 1e-6);
  const scale = Math.min(96 / spanLng, 96 / spanLat);
  const offsetX = (100 - spanLng * scale) / 2;
  const offsetY = (100 - spanLat * scale) / 2;
  const project = (point: OutingPoint) => {
    const x = offsetX + (point.lng - minLng) * scale;
    const y = offsetY + (maxLat - point.lat) * scale;
    return [x, y] as const;
  };
  const path = sampled
    .map((point, index) => {
      const [x, y] = project(point);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  const [startX, startY] = project(sampled[0]);
  const [endX, endY] = project(sampled[sampled.length - 1]);

  return (
    <svg
      className={`lkdv-sortie-map ${className ?? ''}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Aperçu de la trace GPS"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="lkdv-trace-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#17402C" />
          <stop offset="100%" stopColor="#5B8F6A" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="rgba(23,64,44,.16)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path} fill="none" stroke="url(#lkdv-trace-stroke)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={startX} cy={startY} r="2.6" fill="#17402C" />
      <circle cx={startX} cy={startY} r="1.1" fill="#fff" />
      <circle cx={endX} cy={endY} r="2.6" fill="#fff" stroke="#17402C" strokeWidth="1.2" />
    </svg>
  );
}

export function ElevationProfile({ points }: { points: OutingPoint[] }) {
  const sampled = downsample(points, 140).filter((point) => point.elevationM !== null);
  if (sampled.length < 3) {
    return <div className="lkdv-sortie-trace-empty">Profil altimétrique indisponible</div>;
  }
  const elevations = sampled.map((point) => point.elevationM as number);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const span = Math.max(max - min, 1);
  const coords = sampled.map((point, index) => {
    const x = (index / (sampled.length - 1)) * 100;
    const y = 34 - (((point.elevationM as number) - min) / span) * 30;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const area = `${line} L100 36 L0 36 Z`;

  return (
    <div className="lkdv-sortie-elevation">
      <svg viewBox="0 0 100 36" role="img" aria-label={`Profil altimétrique de ${Math.round(min)} à ${Math.round(max)} mètres`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lkdv-elev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(91,143,106,.42)" />
            <stop offset="100%" stopColor="rgba(91,143,106,.04)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lkdv-elev-fill)" />
        <path d={line} fill="none" stroke="#3D7A52" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
      <div className="lkdv-sortie-elevation-labels">
        <span>{Math.round(min)} m</span>
        <span>{Math.round(max)} m</span>
      </div>
    </div>
  );
}
