'use client';

/**
 * Pente réelle d'un itinéraire, calculée par le service DEM existant
 * (`POST /api/explorer/v2/profile`, AWS Terrarium).
 *
 * Aucun appel n'est fait tant que la couche n'est pas demandée. Le résultat
 * ne remplace jamais la géométrie de l'itinéraire : il ne fournit que les
 * arrêts de dégradé et la synthèse (D+, altitudes).
 */

import { useEffect, useMemo, useState } from 'react';
import type { TrailRouteSnapshot } from '../state/types';
import {
  buildSlopeGradient,
  geometryOf,
  routePositions,
  summarizeSlope,
  type SlopeLayer,
  type SlopeProfilePoint,
  type SlopeSummary,
} from '../map/slope';

export type RouteSlopeState = 'idle' | 'loading' | 'ready' | 'error' | 'empty';

interface ProfilePayload {
  points: SlopeProfilePoint[];
  distance_m: number;
  gain_m: number;
  loss_m: number;
  min_m: number | null;
  max_m: number | null;
  source: string;
}

export interface RouteSlopeResult {
  state: RouteSlopeState;
  layer: SlopeLayer | null;
  summary: SlopeSummary | null;
  source: string | null;
  /** Nombre de points réellement envoyés au service (diagnostic). */
  sampleCount: number;
}

const EMPTY_RESULT: RouteSlopeResult = {
  state: 'idle',
  layer: null,
  summary: null,
  source: null,
  sampleCount: 0,
};

/**
 * Calcule la couche de pente d'un itinéraire prêt.
 *
 * `enabled` est le seul interrupteur : si l'utilisateur masque la couche, le
 * calcul est annulé et le résultat précédent est oublié. Une réponse tardive
 * ne peut donc pas rallumer une couche masquée.
 */
export function useRouteSlope(
  route: TrailRouteSnapshot | null | undefined,
  enabled: boolean,
): RouteSlopeResult {
  const positions = useMemo(() => {
    if (!route || route.status !== 'ready' || !route.geojson) return [];
    return routePositions(route.geojson);
  }, [route]);

  const revision = positions.length > 1 ? `${route?.id ?? ''}:${positions.length}` : '';
  const [result, setResult] = useState<RouteSlopeResult>(EMPTY_RESULT);

  useEffect(() => {
    if (!enabled || !route || route.status !== 'ready' || !revision) {
      setResult(EMPTY_RESULT);
      return;
    }

    const controller = new AbortController();
    const activeRoute = route;
    let cancelled = false;
    setResult({
      state: 'loading',
      layer: null,
      summary: null,
      source: null,
      sampleCount: positions.length,
    });

    void fetch('/api/explorer/v2/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`profil ${response.status}`);
        return (await response.json()) as ProfilePayload;
      })
      .then((payload) => {
        if (cancelled) return;
        const points = Array.isArray(payload.points) ? payload.points : [];
        const stops = buildSlopeGradient(points, payload.distance_m);
        const summary = summarizeSlope(points, payload.distance_m) ?? (
          typeof payload.distance_m === 'number' &&
          typeof payload.gain_m === 'number' &&
          typeof payload.loss_m === 'number' &&
          typeof payload.min_m === 'number' &&
          typeof payload.max_m === 'number'
            ? {
                distanceM: Math.round(payload.distance_m),
                gainM: Math.round(payload.gain_m),
                lossM: Math.round(payload.loss_m),
                minM: Math.round(payload.min_m),
                maxM: Math.round(payload.max_m),
              }
            : null
        );
        if (stops.length < 2 || !summary) {
          setResult({
            state: 'empty',
            layer: null,
            summary: null,
            source: payload.source ?? null,
            sampleCount: positions.length,
          });
          return;
        }
        const numericId = Number(activeRoute.id);
        setResult({
          state: 'ready',
          layer: {
            id: Number.isSafeInteger(numericId) ? numericId : -1,
            geojson: geometryOf(activeRoute.geojson),
            stops,
            summary,
          },
          summary,
          source: payload.source ?? null,
          sampleCount: positions.length,
        });
      })
      .catch(() => {
        if (cancelled || controller.signal.aborted) return;
        setResult({
          state: 'error',
          layer: null,
          summary: null,
          source: null,
          sampleCount: positions.length,
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, revision, route, positions]);

  return result;
}
