'use client';

import { useEffect, useMemo, useState } from 'react';
import HubRouteMap, { type HubRoutePoint } from '../HubRouteMap';
import { dayTraceFromSteps, type DayTracePoint } from '@/features/trips/domain/dayTraces';
import { samplePolyline, type TrailPoint } from '@/features/trips/domain/trailToActivity';

/** Marqueur d'étape du jour (terracotta), distinct des extrémités de trace. */
const STEP_MARKER_COLOR = '#A8443A';

type TraceCacheEntry = { ok: true; polyline: TrailPoint[] } | { ok: false };

/**
 * Cache mémoire de session : une polyligne par `route_id`, chargée une seule
 * fois (succès comme absence de géométrie), requêtes concurrentes dédupliquées.
 * Le composant est monté des deux côtés (mobile + desktop) et à chaque
 * changement de jour : le cache évite tout refetch à ces remontages.
 */
const traceCache = new Map<string, TraceCacheEntry>();
const traceInflight = new Map<string, Promise<TraceCacheEntry>>();

function isFinitePoint(point: DayTracePoint | null | undefined): point is DayTracePoint {
  return (
    !!point &&
    typeof point.lat === 'number' &&
    Number.isFinite(point.lat) &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lng)
  );
}

function loadRoutePolyline(routeId: string): Promise<TraceCacheEntry> {
  const cached = traceCache.get(routeId);
  if (cached) return Promise.resolve(cached);
  const inflight = traceInflight.get(routeId);
  if (inflight) return inflight;

  const request = fetch(`/api/hikes/${routeId}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { geojson?: unknown } | null) => {
      const polyline = samplePolyline(data?.geojson ?? null);
      const entry: TraceCacheEntry = polyline.length > 0 ? { ok: true, polyline } : { ok: false };
      traceCache.set(routeId, entry);
      return entry;
    })
    .catch((): TraceCacheEntry => {
      const entry: TraceCacheEntry = { ok: false };
      traceCache.set(routeId, entry);
      return entry;
    })
    .finally(() => {
      traceInflight.delete(routeId);
    });

  traceInflight.set(routeId, request);
  return request;
}

type TraceStatus = 'idle' | 'loading' | 'ready' | 'failed';

function cachedState(routeId: string): { status: TraceStatus; polyline: TrailPoint[] } {
  const cached = traceCache.get(routeId);
  if (!cached) return { status: 'loading', polyline: [] };
  return cached.ok
    ? { status: 'ready', polyline: cached.polyline }
    : { status: 'failed', polyline: [] };
}

/** Charge (ou relit du cache) la polyligne GeoJSON réelle du sentier. */
function useRoutePolyline(routeId: string | null): {
  status: TraceStatus;
  polyline: TrailPoint[];
} {
  const [state, setState] = useState(() =>
    routeId ? cachedState(routeId) : { status: 'idle' as TraceStatus, polyline: [] }
  );

  useEffect(() => {
    if (!routeId) {
      setState({ status: 'idle', polyline: [] });
      return;
    }
    if (traceCache.has(routeId)) {
      setState(cachedState(routeId));
      return;
    }

    let cancelled = false;
    setState({ status: 'loading', polyline: [] });
    loadRoutePolyline(routeId).then((entry) => {
      if (cancelled) return;
      setState(
        entry.ok ? { status: 'ready', polyline: entry.polyline } : { status: 'failed', polyline: [] }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  return state;
}

export interface DayTraceMapProps {
  /** `metadata.route_id` canonique (voir `routeIdFromMetadata`), sinon `null`. */
  routeId: string | null;
  day: number;
  days: number;
  /** Étapes géolocalisées du jour (ordre du roadbook). */
  stepPoints?: DayTracePoint[] | null;
  heightClassName?: string;
  className?: string;
}

/**
 * Carte du jour sélectionné : trace réelle découpée par jour (étapes si elles
 * sont géolocalisées, sinon fractions de la polyligne) via `HubRouteMap`.
 * Chargement discret (squelette) ; échec ou trace absente → aucun rendu.
 */
export function DayTraceMap({
  routeId,
  day,
  days,
  stepPoints,
  heightClassName = 'h-[16rem]',
  className,
}: DayTraceMapProps) {
  const { status, polyline } = useRoutePolyline(routeId);

  const validSteps = useMemo(
    () => (Array.isArray(stepPoints) ? stepPoints.filter(isFinitePoint) : []),
    [stepPoints]
  );

  const dayTrace = useMemo(
    () => dayTraceFromSteps(validSteps, polyline, day, days),
    [validSteps, polyline, day, days]
  );

  const routeCoords = useMemo<Array<[number, number]>>(
    () => dayTrace.map((point) => [point.lat, point.lng]),
    [dayTrace]
  );

  const points = useMemo<HubRoutePoint[]>(
    () =>
      validSteps.map((point) => ({
        lat: point.lat,
        lon: point.lng,
        label: 'Étape du jour',
        color: STEP_MARKER_COLOR,
      })),
    [validSteps]
  );

  if (!routeId) return null;

  if (status === 'loading') {
    return (
      <div
        data-testid="day-trace-map-skeleton"
        aria-hidden="true"
        className={`w-full animate-pulse rounded-2xl border border-white/60 bg-[var(--lkv-surface-raised)] motion-reduce:animate-none ${heightClassName} ${className ?? ''}`}
      />
    );
  }

  if (status === 'failed' || routeCoords.length === 0) return null;

  return (
    <div
      role="img"
      aria-label={`Trace réelle du jour ${day}`}
      data-testid="day-trace-map"
      className={`relative w-full overflow-hidden rounded-2xl border border-white/60 ${heightClassName} ${className ?? ''}`}
    >
      <HubRouteMap routeCoords={routeCoords} points={points} reserveBottom={0} />
    </div>
  );
}

export default DayTraceMap;
