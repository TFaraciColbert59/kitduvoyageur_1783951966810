/**
 * K1.14 — contrat de recherche de parcours, pur et testable.
 *
 * Les candidats viennent de `compas_search_routes` (catalogue réel). Le
 * filtre ne suppose jamais une contrainte inconnue : un parcours dont le
 * dénivelé n'est pas renseigné ne peut pas prouver `elevationGainM >= 300`
 * et il est écarté avec la raison exacte. La réponse expose toujours les
 * contraintes appliquées et les contraintes inconnues.
 */

import { z } from 'zod';
import {
  AI_ASSISTANT_CONTRACT_VERSION,
  absent,
  formatNumberFr,
  hasValue,
  measured,
  numericDataPoint,
  type DataCitation,
  type DataPoint,
} from '../contracts';

const rangeSchema = z
  .object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .refine((value) => value.min === undefined || value.max === undefined || value.min <= value.max, {
    message: 'min doit être inférieur ou égal à max',
  });

export const routeDiscoveryRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(120).optional(),
    near: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusKm: z.number().min(1).max(500).optional(),
      })
      .optional(),
    constraints: z
      .object({
        distanceKm: rangeSchema.optional(),
        elevationGainM: rangeSchema.optional(),
        durationHours: rangeSchema.optional(),
        difficulty: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
        region: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
      })
      .optional(),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .refine((value) => Boolean(value.query) || Boolean(value.near), {
    message: 'fournir une recherche texte ou une position',
  });

export type RouteDiscoveryRequest = z.output<typeof routeDiscoveryRequestSchema>;

/** Ligne `compas_search_routes` telle que rendue par PostgREST. */
export interface CompasRouteRow {
  route_id: number | string;
  name: string | null;
  ref: string | null;
  region: string | null;
  distance_km: number | string | null;
  elevation_gain_m: number | string | null;
  elevation_loss_m: number | string | null;
  duration_hours: number | string | null;
  difficulty: string | null;
  distance_from_m: number | string | null;
  start_lat: number | string | null;
  start_lng: number | string | null;
  community_sessions: number | string | null;
}

export interface RouteCandidate {
  id: string;
  name: string;
  ref: string | null;
  region: string | null;
  distanceKm: DataPoint<number>;
  elevationGainM: DataPoint<number>;
  elevationLossM: DataPoint<number>;
  durationHours: DataPoint<number>;
  difficulty: DataPoint<string>;
  distanceFromM: DataPoint<number>;
  start: DataPoint<{ lat: number; lng: number }>;
  communitySessions: DataPoint<number>;
  citations: DataCitation[];
}

export interface RouteDiscoveryResult {
  contractVersion: string;
  appliedConstraints: {
    query: string | null;
    near: { lat: number; lng: number; radiusKm: number } | null;
    distanceKm: { min: number | null; max: number | null } | null;
    elevationGainM: { min: number | null; max: number | null } | null;
    durationHours: { min: number | null; max: number | null } | null;
    difficulty: string[] | null;
    region: string[] | null;
  };
  unknownConstraints: string[];
  results: RouteCandidate[];
  excluded: Array<{ id: string; reason: string }>;
  count: number;
}

function numberPoint(
  value: unknown,
  source: string,
  unit: string,
  absentReason: string,
  status: 'measured' | 'calculated' = 'measured'
): DataPoint<number> {
  return numericDataPoint(value, { status, source, unit, absentReason });
}

function textPoint(value: unknown, source: string, absentReason: string): DataPoint<string> {
  return typeof value === 'string' && value.trim().length > 0
    ? measured(value.trim(), source)
    : absent<string>(absentReason);
}

export function toRouteCandidate(row: CompasRouteRow): RouteCandidate {
  const distanceKm = numberPoint(
    row.distance_km,
    'hiking_routes.distance_km',
    'km',
    'distance non renseignée'
  );
  const elevationGainM = numberPoint(
    row.elevation_gain_m,
    'trail_metadata.elevation_gain',
    'm',
    'dénivelé positif non renseigné'
  );
  const elevationLossM = numberPoint(
    row.elevation_loss_m,
    'trail_metadata.elevation_loss',
    'm',
    'dénivelé négatif non renseigné'
  );
  const durationHours = numberPoint(
    row.duration_hours,
    'trail_metadata.duration_hours',
    'h',
    'durée indicative non renseignée'
  );
  const difficulty = textPoint(row.difficulty, 'trail_metadata.difficulty', 'difficulté non renseignée');
  const distanceFromM = numberPoint(
    row.distance_from_m,
    'calculé : distance au point demandé',
    'm',
    'distance au point non calculée'
  );
  const communitySessions = numberPoint(
    row.community_sessions,
    'hike_sessions publiques (compteur agrégé)',
    'sorties',
    'compteur communautaire indisponible'
  );

  const lat = row.start_lat === null || row.start_lat === undefined ? Number.NaN : Number(row.start_lat);
  const lng = row.start_lng === null || row.start_lng === undefined ? Number.NaN : Number(row.start_lng);
  const start =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? measured({ lat, lng }, 'hiking_routes.geom (point de départ)')
      : absent<{ lat: number; lng: number }>('point de départ non disponible');

  const citations: DataCitation[] = [
    {
      field: 'distanceKm',
      label: 'Distance',
      value: hasValue(distanceKm) ? `${formatNumberFr(distanceKm.value, 2)} km` : null,
      status: distanceKm.status,
      source: distanceKm.source,
    },
    {
      field: 'elevationGainM',
      label: 'Dénivelé positif',
      value: hasValue(elevationGainM) ? `${formatNumberFr(elevationGainM.value, 0)} m` : null,
      status: elevationGainM.status,
      source: elevationGainM.source,
    },
    {
      field: 'durationHours',
      label: 'Durée indicative',
      value: hasValue(durationHours) ? `${formatNumberFr(durationHours.value, 1)} h` : null,
      status: durationHours.status,
      source: durationHours.source,
    },
    {
      field: 'difficulty',
      label: 'Difficulté',
      value: hasValue(difficulty) ? difficulty.value : null,
      status: difficulty.status,
      source: difficulty.source,
    },
  ];

  return {
    id: String(row.route_id),
    name: row.name?.trim() || row.ref?.trim() || 'Itinéraire sans nom',
    ref: row.ref?.trim() || null,
    region: row.region?.trim() || null,
    distanceKm,
    elevationGainM,
    elevationLossM,
    durationHours,
    difficulty,
    distanceFromM,
    start,
    communitySessions,
    citations,
  };
}

function inRange(value: number, range: { min?: number; max?: number }): boolean {
  if (range.min !== undefined && value < range.min) return false;
  if (range.max !== undefined && value > range.max) return false;
  return true;
}

function constraintResult(
  point: DataPoint<number>,
  range: { min?: number; max?: number } | undefined,
  label: string
): { accepted: boolean; unknown: boolean; reason?: string } {
  if (!range) return { accepted: true, unknown: false };
  if (!hasValue(point)) {
    return { accepted: false, unknown: true, reason: `${label} inconnu : contrainte non prouvable` };
  }
  if (!inRange(point.value, range)) {
    return {
      accepted: false,
      unknown: false,
      reason: `${label} ${formatNumberFr(point.value, 2)} hors de la plage demandée`,
    };
  }
  return { accepted: true, unknown: false };
}

export function discoverRoutes(
  request: RouteDiscoveryRequest,
  rows: CompasRouteRow[]
): RouteDiscoveryResult {
  const candidates = rows.map(toRouteCandidate);
  const query = request.query?.trim().toLowerCase() ?? null;
  const constraints = request.constraints;
  const unknown = new Set<string>();
  const results: RouteCandidate[] = [];
  const excluded: Array<{ id: string; reason: string }> = [];

  for (const candidate of candidates) {
    if (query) {
      const haystack = [candidate.name, candidate.ref, candidate.region].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) {
        excluded.push({ id: candidate.id, reason: 'ne correspond pas au texte recherché' });
        continue;
      }
    }

    const distance = constraintResult(candidate.distanceKm, constraints?.distanceKm, 'distance');
    const elevation = constraintResult(
      candidate.elevationGainM,
      constraints?.elevationGainM,
      'dénivelé positif'
    );
    const duration = constraintResult(candidate.durationHours, constraints?.durationHours, 'durée');
    for (const check of [distance, elevation, duration]) {
      if (check.unknown) unknown.add(check.reason ?? 'contrainte inconnue');
    }
    if (!distance.accepted || !elevation.accepted || !duration.accepted) {
      excluded.push({
        id: candidate.id,
        reason:
          distance.reason ??
          elevation.reason ??
          duration.reason ??
          'contrainte non satisfaite',
      });
      continue;
    }

    if (constraints?.difficulty && constraints.difficulty.length > 0) {
      if (!hasValue(candidate.difficulty)) {
        unknown.add('difficulté inconnue pour certains parcours : contrainte non prouvable');
        excluded.push({ id: candidate.id, reason: 'difficulté inconnue : contrainte non prouvable' });
        continue;
      }
      const wanted = constraints.difficulty.map((entry) => entry.toLowerCase());
      if (!wanted.includes(candidate.difficulty.value.toLowerCase())) {
        excluded.push({ id: candidate.id, reason: 'difficulté hors de la liste demandée' });
        continue;
      }
    }

    if (constraints?.region && constraints.region.length > 0) {
      if (!candidate.region) {
        unknown.add('région inconnue pour certains parcours : contrainte non prouvable');
        excluded.push({ id: candidate.id, reason: 'région inconnue : contrainte non prouvable' });
        continue;
      }
      const wanted = constraints.region.map((entry) => entry.toLowerCase());
      if (!wanted.includes(candidate.region.toLowerCase())) {
        excluded.push({ id: candidate.id, reason: 'région hors de la liste demandée' });
        continue;
      }
    }

    results.push(candidate);
  }

  const limit = request.limit ?? 12;
  return {
    contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
    appliedConstraints: {
      query,
      near: request.near
        ? { lat: request.near.lat, lng: request.near.lng, radiusKm: request.near.radiusKm ?? 80 }
        : null,
      distanceKm: constraints?.distanceKm
        ? { min: constraints.distanceKm.min ?? null, max: constraints.distanceKm.max ?? null }
        : null,
      elevationGainM: constraints?.elevationGainM
        ? { min: constraints.elevationGainM.min ?? null, max: constraints.elevationGainM.max ?? null }
        : null,
      durationHours: constraints?.durationHours
        ? { min: constraints.durationHours.min ?? null, max: constraints.durationHours.max ?? null }
        : null,
      difficulty: constraints?.difficulty ?? null,
      region: constraints?.region ?? null,
    },
    unknownConstraints: [...unknown],
    results: results.slice(0, limit),
    excluded,
    count: Math.min(results.length, limit),
  };
}
