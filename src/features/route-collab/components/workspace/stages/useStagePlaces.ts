'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { NO_PLACES, type DayPlaces } from '../../../dayReading';
import { fetchPlaces, placesKey, routePlacePoints, stagePlacePoints, type LatLon } from '../../../placesClient';
import type { CollaborativeStage, RouteWorkspaceState } from '../../../types';

/**
 * Lieux réels relevés (nuits, eau, ravitaillement, sorties), gardés le temps de la session et partagés par
 * l'onglet Étapes, le tiroir « Jour » et l'assistant de découpage : une même suite de jalons n'est jamais
 * redemandée. Hors de React pour que deux composants voient la même lecture.
 */
const cache = new Map<string, DayPlaces>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readPlaces(points: readonly LatLon[]): DayPlaces {
  return cache.get(placesKey(points)) ?? NO_PLACES;
}

/** Relève les lieux autour de ces jalons ; sans effet si déjà lus ou en cours (sauf `force`). */
export async function loadPlaces(points: readonly LatLon[], force = false): Promise<DayPlaces> {
  const key = placesKey(points);
  if (points.length === 0) return NO_PLACES;
  if (inflight.has(key)) return cache.get(key) ?? NO_PLACES;
  const known = cache.get(key);
  if (known && !force && known.status !== 'error' && known.status !== 'partial') return known;
  inflight.add(key);
  cache.set(key, { status: 'loading', pois: known?.pois ?? [], fetchedAt: known?.fetchedAt ?? null });
  emit();
  try {
    const res = await fetchPlaces(points);
    cache.set(key, res);
    return res;
  } finally {
    inflight.delete(key);
    emit();
  }
}

export function resetPlacesForTests(): void {
  cache.clear();
  inflight.clear();
  version += 1;
}

const getVersion = () => version;

/** Lieux de la journée (jalons le long de son tracé) et de tout l'itinéraire, avec le déclencheur de relevé. */
export function useStagePlaces(workspace: Pick<RouteWorkspaceState, 'points' | 'sections'>, stage: CollaborativeStage | null) {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const stagePoints = stage ? stagePlacePoints(workspace, stage) : [];
  const places = readPlaces(stagePoints);
  const load = useCallback((force = false) => loadPlaces(stagePoints, force), [stagePoints.map((p) => `${p.lat},${p.lon}`).join(';')]); // eslint-disable-line react-hooks/exhaustive-deps
  return { places, load };
}

/** Lieux pour toutes les journées : `placesByStage` prêt à passer à `readDays`. */
export function usePlacesByStage(workspace: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages'>): Record<string, DayPlaces> {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const out: Record<string, DayPlaces> = {};
  for (const st of workspace.stages) out[st.id] = readPlaces(stagePlacePoints(workspace, st));
  return out;
}

export function useRoutePlaces(workspace: Pick<RouteWorkspaceState, 'points' | 'sections'>) {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const pts = routePlacePoints(workspace);
  const load = useCallback((force = false) => loadPlaces(pts, force), [pts.map((p) => `${p.lat},${p.lon}`).join(';')]); // eslint-disable-line react-hooks/exhaustive-deps
  return { places: readPlaces(pts), load };
}
