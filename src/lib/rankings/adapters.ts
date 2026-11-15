import type {
  ChallengeCriterionType,
  ChallengeRule,
  GpsTrackPoint,
  PeakDefinition,
  RankingActivityRecord,
  RankingUserProfile,
} from '@/features/rankings/types';
import type { LegendTargetOption } from './types';

/**
 * Couche d'adaptation entre les tables réelles LKDV et le contrat G03.
 * Tout ce qui est inconnu reste `null` ; aucune coordonnée n'est fabriquée et
 * une visibilité non reconnue devient `private` (fail-closed).
 */

export interface HikeSessionRow {
  id: string;
  user_id: string;
  route_id: number | string | null;
  started_at: string | null;
  distance_km: number | string | null;
  duration_seconds: number | null;
  elevation_gain_m: number | string | null;
  positions_geojson: unknown;
  visibility: string | null;
  processing_status: string | null;
  track_quality: unknown;
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  /** `private` est un refus explicite de paraître publiquement (P01). */
  profile_visibility?: string | null;
  /** Les comptes de démonstration sont exclus des classements réels. */
  is_demo?: boolean | null;
}

export interface SummitRow {
  id: string;
  name: string | null;
  altitude_m: number | string | null;
  lat: number | string | null;
  lng: number | string | null;
  region: string | null;
  massif: string | null;
}

export interface ProgressionChallengeRow {
  id: string;
  title: string;
  description: string | null;
  points_reward: number | null;
  target_progress: number | null;
  unit: string | null;
}

export interface SeasonRow {
  starts_at: string;
  ends_at: string;
}

export interface RouteRow {
  id: number | string;
  name: string | null;
  ref: string | null;
}

export interface SegmentRow {
  id: number | string;
  name: string | null;
}

const VALID_VISIBILITIES = new Set(['public', 'followers', 'club', 'private']);

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function coerceVisibility(value: unknown): RankingActivityRecord['visibility'] {
  return typeof value === 'string' && VALID_VISIBILITIES.has(value)
    ? (value as RankingActivityRecord['visibility'])
    : 'private';
}

/**
 * GeoJSON LineString, tableau [lng, lat] ou tableau d'objets { lat, lng }.
 * Retourne `null` si la trace n'est pas exploitable : on ne complète jamais
 * un point manquant par une coordonnée inventée.
 */
export function parseGpsTrack(value: unknown): GpsTrackPoint[] | null {
  if (!value) return null;
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  const container = parsed as { type?: string; coordinates?: unknown; points?: unknown } | null;
  const raw =
    Array.isArray(parsed)
      ? parsed
      : container?.type === 'LineString' && Array.isArray(container.coordinates)
        ? container.coordinates
        : Array.isArray(container?.coordinates)
          ? container.coordinates
          : Array.isArray(container?.points)
            ? container.points
            : null;

  if (!raw) return null;

  const points: GpsTrackPoint[] = [];
  const readPoint = (item: unknown): void => {
    if (Array.isArray(item)) {
      const lng = finiteNumber(item[0]);
      const lat = finiteNumber(item[1]);
      if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      points.push({
        lat,
        lng,
        elevationMeters: finiteNumber(item[2]),
        timestamp: typeof item[3] === 'string' ? item[3] : undefined,
      });
      return;
    }
    if (item && typeof item === 'object') {
      const candidate = item as { lat?: unknown; lng?: unknown; lon?: unknown; elevation?: unknown; timestamp?: unknown };
      const lat = finiteNumber(candidate.lat);
      const lng = finiteNumber(candidate.lng ?? candidate.lon);
      if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      points.push({
        lat,
        lng,
        elevationMeters: finiteNumber(candidate.elevation),
        timestamp: typeof candidate.timestamp === 'string' ? candidate.timestamp : undefined,
      });
    }
  };

  // Plafond mémoire : une trace de plusieurs dizaines de milliers de points
  // est sous-échantillonnée, le dernier point restant toujours inclus.
  const MAX_POINTS = 20_000;
  const step = Math.max(1, Math.ceil(raw.length / MAX_POINTS));
  for (let index = 0; index < raw.length; index += step) {
    readPoint(raw[index]);
  }
  if (raw.length > 1 && (raw.length - 1) % step !== 0) {
    readPoint(raw[raw.length - 1]);
  }

  return points.length > 0 ? points : null;
}

export function mapHikeSessionRow(
  row: HikeSessionRow,
  options: { includeGps?: boolean } = {}
): RankingActivityRecord | null {
  if (!row?.id || !row.user_id || !row.started_at) return null;
  const started = new Date(row.started_at);
  if (Number.isNaN(started.getTime())) return null;

  const distanceKm = finiteNumber(row.distance_km);
  const durationSec = finiteNumber(row.duration_seconds);
  const elevation = finiteNumber(row.elevation_gain_m);
  const quality = row.track_quality && typeof row.track_quality === 'object'
    ? (row.track_quality as { flagged?: unknown })
    : null;
  const isFlagged = quality?.flagged === true;
  const processingStatus = row.processing_status ?? 'processed';

  return {
    id: row.id,
    userId: row.user_id,
    sport: 'hiking',
    startedAt: started.toISOString(),
    durationSec: durationSec !== null && durationSec >= 0 ? Math.round(durationSec) : null,
    distanceMeters: distanceKm !== null && distanceKm >= 0 ? Math.round(distanceKm * 1000) : null,
    elevationGainMeters: elevation !== null && elevation >= 0 ? Math.round(elevation) : null,
    visibility: coerceVisibility(row.visibility),
    isValid: processingStatus !== 'failed',
    isFlagged,
    moderationStatus: 'clean',
    deleted: false,
    routeIds: row.route_id === null || row.route_id === undefined ? [] : [String(row.route_id)],
    gpsTrack: options.includeGps ? parseGpsTrack(row.positions_geojson) ?? undefined : undefined,
  };
}

export function mapProfileRow(row: ProfileRow): RankingUserProfile | null {
  if (!row?.id) return null;
  const displayName = (row.full_name || '').trim() || (row.handle || '').trim() || 'Voyageur LKDV';
  const privateProfile = row.profile_visibility === 'private' || row.is_demo === true;
  return {
    userId: row.id,
    displayName,
    avatarUrl: row.avatar_url || null,
    rankingsOptOut: privateProfile,
    localLegendsOptOut: privateProfile,
    peerComparisonOptOut: privateProfile,
  };
}

export function mapSummitRow(row: SummitRow): PeakDefinition | null {
  if (!row?.id) return null;
  const lat = finiteNumber(row.lat);
  const lng = finiteNumber(row.lng);
  const elevation = finiteNumber(row.altitude_m);
  if (lat === null || lng === null || elevation === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    id: row.id,
    name: (row.name || '').trim() || 'Sommet',
    elevationMeters: Math.round(elevation),
    lat,
    lng,
    validationRadiusMeters: 50,
    region: row.region || row.massif || undefined,
  };
}

const ACTIVITY_UNITS = new Set([
  'sentier',
  'sentiers',
  'sortie',
  'sorties',
  'activité',
  'activités',
  'activite',
  'activites',
  'activity',
  'activities',
]);
const DISTANCE_KM_UNITS = new Set(['km', 'kilomètre', 'kilomètres', 'kilometre', 'kilometres']);
const ELEVATION_UNITS = new Set(['m', 'mètre', 'mètres', 'metre', 'metres', 'd+']);
const DURATION_HOURS_UNITS = new Set(['h', 'heure', 'heures', 'hour', 'hours']);

export interface MappedChallenge {
  rule: ChallengeRule;
  trackable: boolean;
}

/**
 * Les défis historiques `progression_challenges` ne portent pas tous une
 * grandeur mesurable par une activité GPS. Ceux qui ne le sont pas restent
 * listés, mais `trackable: false` : l'UI affiche « suivi indisponible », jamais
 * une progression à zéro inventée.
 */
export function mapProgressionChallengeRow(
  row: ProgressionChallengeRow,
  season: SeasonRow
): MappedChallenge | null {
  if (!row?.id || !row.title) return null;
  const rawUnit = (row.unit || '').trim().toLowerCase();
  const rawTarget = finiteNumber(row.target_progress);
  const target = rawTarget !== null && rawTarget > 0 ? rawTarget : 1;

  let criterion: ChallengeCriterionType = 'activity_count';
  let targetValue = target;
  let displayUnit = row.unit || 'actions';
  let trackable = true;

  if (ACTIVITY_UNITS.has(rawUnit)) {
    criterion = 'activity_count';
    targetValue = target;
    displayUnit = row.unit || 'actions';
  } else if (DISTANCE_KM_UNITS.has(rawUnit)) {
    criterion = 'distance_meters';
    targetValue = target * 1000;
    // La progression est calculée en mètres : l'unité affichée suit la mesure.
    displayUnit = 'm';
  } else if (ELEVATION_UNITS.has(rawUnit)) {
    criterion = 'elevation_gain_meters';
    targetValue = target;
    displayUnit = 'm';
  } else if (DURATION_HOURS_UNITS.has(rawUnit)) {
    criterion = 'duration_sec';
    targetValue = target * 3600;
    displayUnit = 's';
  } else {
    // Unités non mesurables par le contrat G03 (kit, carnet, avis, prêt…).
    trackable = false;
  }

  return {
    trackable,
    rule: {
      id: row.id,
      version: 1,
      kind: 'public',
      title: row.title,
      description: row.description || row.title,
      sport: 'all',
      criterion,
      targetValue,
      unit: displayUnit,
      startsAt: season.starts_at,
      endsAt: season.ends_at,
      rewardBadgeId: `badge:${row.id}`,
      rewardTitle: row.title,
      rewardPoints: Math.max(0, Math.round(finiteNumber(row.points_reward) ?? 0)),
    },
  };
}

/** Construit les cibles Local Legends à partir des activités réellement vues. */
export function buildLegendTargets(
  activities: readonly RankingActivityRecord[],
  routes: readonly RouteRow[],
  segments: readonly SegmentRow[],
  sinceIso: string,
  limit = 40
): LegendTargetOption[] {
  const sinceMs = Date.parse(sinceIso);
  const routeNames = new Map(routes.map((r) => [String(r.id), (r.name || r.ref || '').trim()]));
  const segmentNames = new Map(segments.map((s) => [String(s.id), (s.name || '').trim()]));
  const counts = new Map<string, { type: 'route' | 'segment'; id: string; effortCount: number }>();

  for (const activity of activities) {
    const startedMs = Date.parse(activity.startedAt);
    if (Number.isNaN(startedMs) || startedMs < sinceMs) continue;

    for (const id of activity.routeIds ?? []) {
      const key = `route:${id}`;
      const current = counts.get(key);
      if (current) current.effortCount += 1;
      else counts.set(key, { type: 'route', id, effortCount: 1 });
    }
    for (const id of activity.segmentIds ?? []) {
      const key = `segment:${id}`;
      const current = counts.get(key);
      if (current) current.effortCount += 1;
      else counts.set(key, { type: 'segment', id, effortCount: 1 });
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.effortCount - a.effortCount || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((target) => {
      const name = target.type === 'route'
        ? routeNames.get(target.id) || `Itinéraire #${target.id}`
        : segmentNames.get(target.id) || `Segment #${target.id}`;
      return {
        targetId: target.id,
        targetType: target.type,
        name,
        sport: 'hiking' as const,
        effortCount: target.effortCount,
      };
    });
}
