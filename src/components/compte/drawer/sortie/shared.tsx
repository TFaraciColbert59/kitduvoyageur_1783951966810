'use client';

import React from 'react';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react';
import type { OutingDetail, OutingPoint } from '@/features/compte/server/sorties';
import {
  isOutingMetricVisible,
  type OutingMetricKey,
} from '@/features/compte/domain/metricVisibility';
import type { WeatherIcon } from '@/features/compte/server/weather';

/** Morceaux visibles d'une sortie ; `points` n'est qu'un repli de compatibilité. */
export function visibleTraceSegments(
  detail: Pick<OutingDetail, 'traceSegments' | 'points'>
): OutingPoint[][] {
  const segments = Array.isArray(detail.traceSegments)
    ? detail.traceSegments
    : detail.traceSegments === undefined
      ? [detail.points]
      : [];
  return segments.filter((segment) => segment.length >= 2);
}

/** Points visibles aplatis, pour les statistiques (jamais pour recoller un tracé). */
export function visibleTracePoints(
  detail: Pick<OutingDetail, 'traceSegments' | 'points'>
): OutingPoint[] {
  return visibleTraceSegments(detail).flat();
}

export function hasVisibleTrace(
  detail: Pick<OutingDetail, 'traceSegments' | 'points'>
): boolean {
  return visibleTraceSegments(detail).length > 0;
}

/**
 * Libellé honnête quand aucune trace n'est dessinable. Une trace totalement
 * masquée ou refusée n'est pas « absente » : le message ne doit pas affirmer
 * que la sortie n'en a jamais eu.
 */
export function traceUnavailableState(
  detail: Pick<OutingDetail, 'traceMasked' | 'traceFullyMasked' | 'traceError'>
): { title: string; body: string } {
  if (detail.traceFullyMasked) {
    return {
      title: 'Trace non partageable',
      body:
        'Cette sortie est privée : sa trace reste réservée à son propriétaire. Le résumé et le matériel restent consultables.',
    };
  }
  if (detail.traceError === 'unpublishable_geometry') {
    return {
      title: 'Trace trop courte pour être partagée',
      body:
        'Les extrémités masquées ne laissent pas assez de trace publiable. Aucune portion n’est inventée pour compenser.',
    };
  }
  if (detail.traceError) {
    return {
      title: 'Trace non disponible',
      body:
        'La géométrie enregistrée n’a pas pu être publiée en sécurité. Aucune donnée brute n’est affichée à la place.',
    };
  }
  return {
    title: 'Aucune trace GPS rattachée',
    body:
      'Cette sortie a bien été enregistrée, mais aucune trace n’est disponible. Tu peux toujours consulter le résumé et le matériel.',
  };
}

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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Vrai seulement si le serveur a explicitement autorisé cette métrique. */
export function outingMetricVisible(
  detail: Pick<OutingDetail, 'metricVisibility'>,
  key: OutingMetricKey
): boolean {
  return isOutingMetricVisible(detail.metricVisibility, key);
}

/** Libellé honnête : « masqué » n'est pas « zéro » ni « non renseigné ». */
export function metricDisplay(
  detail: Pick<OutingDetail, 'metricVisibility'>,
  key: OutingMetricKey,
  value: number | null,
  formatter: (value: number) => string
): string {
  if (!outingMetricVisible(detail, key)) return 'Masqué';
  if (!isFiniteNumber(value)) return '—';
  return formatter(value);
}

/**
 * Texte de partage : uniquement les métriques que le serveur a rendues
 * visibles. Une métrique masquée ne doit jamais être réintroduite par le
 * client au moment de partager.
 */
export function shareableOutingText(detail: OutingDetail): string {
  const parts = [detail.title];
  const distanceKm = detail.km;
  const elevationGainM = detail.dplus;
  const maxAltitudeM = detail.maxAlt;
  const durationS = detail.durationS;
  if (outingMetricVisible(detail, 'distance') && isFiniteNumber(distanceKm)) {
    parts.push(`${formatNumber(distanceKm)} km`);
  }
  if (outingMetricVisible(detail, 'elevationGain') && isFiniteNumber(elevationGainM)) {
    parts.push(`+${formatNumber(elevationGainM)} m`);
  }
  if (outingMetricVisible(detail, 'maxAltitude') && isFiniteNumber(maxAltitudeM)) {
    parts.push(`${formatNumber(maxAltitudeM)} m alt. max`);
  }
  if (outingMetricVisible(detail, 'duration') && isFiniteNumber(durationS)) {
    parts.push(formatDuration(durationS));
  }
  return parts.join(' · ');
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
      return <Sun {...props} />;
    case 'partly':
      return <CloudSun {...props} />;
    case 'cloud':
      return <Cloud {...props} />;
    case 'rain':
      return <CloudRain {...props} />;
    case 'snow':
      return <CloudSnow {...props} />;
    case 'storm':
      return <CloudLightning {...props} />;
    case 'fog':
      return <CloudFog {...props} />;
    default:
      return <Cloud {...props} />;
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

export function TraceMap({
  segments,
  className,
}: {
  segments: OutingPoint[][];
  className?: string;
}) {
  const prepared = segments
    .map((segment) => downsample(segment))
    .filter((segment) => segment.length >= 2);
  const sampled = prepared.flat();
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
  /* Un chemin SVG par morceau : aucune commande ne relie la fin d'un morceau
     au début du suivant, donc une zone masquée reste un trou visible. */
  const paths = prepared.map((segment) =>
    segment
      .map((point, index) => {
        const [x, y] = project(point);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ')
  );
  const [startX, startY] = project(prepared[0][0]);
  const lastSegment = prepared[prepared.length - 1];
  const [endX, endY] = project(lastSegment[lastSegment.length - 1]);

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
      {paths.map((path, index) => (
        <React.Fragment key={`trace-${index}`}>
          <path d={path} fill="none" stroke="rgba(23,64,44,.16)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={path} fill="none" stroke="url(#lkdv-trace-stroke)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </React.Fragment>
      ))}
      <circle cx={startX} cy={startY} r="2.6" fill="#17402C" />
      <circle cx={startX} cy={startY} r="1.1" fill="#fff" />
      <circle cx={endX} cy={endY} r="2.6" fill="#fff" stroke="#17402C" strokeWidth="1.2" />
    </svg>
  );
}

export function ElevationProfile({ segments }: { segments: OutingPoint[][] }) {
  const prepared = segments
    .map((segment) => downsample(segment, 140).filter((point) => point.elevationM !== null))
    .filter((segment) => segment.length >= 2);
  const all = prepared.flat();
  if (all.length < 3) {
    return <div className="lkdv-sortie-trace-empty">Profil altimétrique indisponible</div>;
  }
  const elevations = all.map((point) => point.elevationM as number);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const span = Math.max(max - min, 1);
  const indexByPoint = new Map(all.map((point, index) => [point, index] as const));
  const lines = prepared.map((segment) =>
    segment
      .map((point) => {
        const x = ((indexByPoint.get(point) ?? 0) / (all.length - 1)) * 100;
        const y = 34 - (((point.elevationM as number) - min) / span) * 30;
        return [x, y] as const;
      })
      .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' ')
  );

  return (
    <div className="lkdv-sortie-elevation">
      <svg viewBox="0 0 100 36" role="img" aria-label={`Profil altimétrique de ${Math.round(min)} à ${Math.round(max)} mètres`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lkdv-elev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(91,143,106,.42)" />
            <stop offset="100%" stopColor="rgba(91,143,106,.04)" />
          </linearGradient>
        </defs>
        {lines.map((line, index) => {
          const segment = prepared[index];
          const firstX = ((indexByPoint.get(segment[0]) ?? 0) / (all.length - 1)) * 100;
          const lastX =
            ((indexByPoint.get(segment[segment.length - 1]) ?? 0) / (all.length - 1)) * 100;
          return (
            <React.Fragment key={`elev-${index}`}>
              <path d={`${line} L${lastX.toFixed(2)} 36 L${firstX.toFixed(2)} 36 Z`} fill="url(#lkdv-elev-fill)" />
              <path d={line} fill="none" stroke="#3D7A52" strokeWidth="1.1" strokeLinejoin="round" />
            </React.Fragment>
          );
        })}
      </svg>
      <div className="lkdv-sortie-elevation-labels">
        <span>{Math.round(min)} m</span>
        <span>{Math.round(max)} m</span>
      </div>
    </div>
  );
}
