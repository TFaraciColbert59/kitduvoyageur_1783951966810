/**
 * Phase 4 — Étape 5 du pipeline : déduplication des parcours.
 *
 * Deux parcours sont considérés doublons :
 *   • empreinte exacte identique (nom normalisé + coordonnées) ;
 *   • même nom normalisé ET mêmes points de départ/arrivée à ~100 m près.
 * Aucune suppression silencieuse : les doublons sont retournés pour audit.
 */
import type { LatLng, NormalizedRoute } from './types';
import { haversineMeters } from './metrics';

export interface DuplicateReport {
  route: NormalizedRoute;
  duplicateOf: string;
  reason: 'identical' | 'near';
}

export interface DedupeResult {
  unique: NormalizedRoute[];
  duplicates: DuplicateReport[];
}

const NEAR_DUPLICATE_M = 100;

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** FNV-1a 32 bits (déterministe, pure — pas de dépendance crypto). */
function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function routeFingerprint(route: NormalizedRoute): string {
  const payload = [
    normalizeName(route.name),
    ...route.points.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`),
  ].join('|');
  return fnv1a(payload);
}

function sameEndpoints(a: NormalizedRoute, b: NormalizedRoute): boolean {
  if (a.points.length === 0 || b.points.length === 0) return false;
  const aStart = a.points[0];
  const aEnd = a.points[a.points.length - 1];
  const bStart = b.points[0];
  const bEnd = b.points[b.points.length - 1];
  return (
    haversineMeters(aStart, bStart) <= NEAR_DUPLICATE_M &&
    haversineMeters(aEnd, bEnd) <= NEAR_DUPLICATE_M
  );
}

export function dedupeRoutes(routes: readonly NormalizedRoute[]): DedupeResult {
  const unique: NormalizedRoute[] = [];
  const duplicates: DuplicateReport[] = [];
  const byFingerprint = new Map<string, NormalizedRoute>();
  const byName = new Map<string, NormalizedRoute>();

  for (const route of routes) {
    const fingerprint = routeFingerprint(route);
    const exact = byFingerprint.get(fingerprint);
    if (exact) {
      duplicates.push({ route, duplicateOf: exact.externalId, reason: 'identical' });
      continue;
    }

    const name = normalizeName(route.name);
    const sameName = byName.get(name);
    if (sameName && sameEndpoints(sameName, route)) {
      duplicates.push({ route, duplicateOf: sameName.externalId, reason: 'near' });
      continue;
    }

    byFingerprint.set(fingerprint, route);
    if (!byName.has(name)) byName.set(name, route);
    unique.push(route);
  }

  return { unique, duplicates };
}

export type { LatLng };
