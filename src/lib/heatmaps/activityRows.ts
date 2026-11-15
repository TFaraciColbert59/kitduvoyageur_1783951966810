/**
 * Projection des lignes Supabase vers le contrat pur `HeatmapActivityRecord`.
 *
 * Cette couche est volontairement défensive : une séance non terminée, un sport
 * inconnu, un point hors bornes ou une date invalide est ignoré. Elle ne décide
 * jamais de la publication — le moteur C02 applique ensuite consentement,
 * visibilité, zones et k-anonymat.
 */

import { isValidLatLng } from '@/features/heatmaps/privacyMask';
import type {
  HeatmapActivityRecord,
  HeatmapActivityVisibility,
  HeatmapTrackPoint,
  Sport,
} from '@/features/heatmaps/types';

export interface ActivitySessionRow {
  id: string;
  user_id: string;
  sport: string;
  status: string;
  share_level?: string | null;
  started_at: string;
  ended_at?: string | null;
}

export interface ActivityPointRow {
  session_id: string;
  t: string;
  lat: number | string;
  lng: number | string;
  ele?: number | string | null;
}

export type ActivityBuildMode = 'personal' | 'community';

const SPORT_SET: ReadonlySet<string> = new Set<Sport>([
  'course',
  'rando',
  'velo',
  'kayak',
  'trail',
  'ski',
  'escalade',
  'famille',
  'bivouac',
]);

const VISIBILITY_BY_SHARE_LEVEL: Record<string, HeatmapActivityVisibility> = {
  none: 'private',
  followers: 'followers_only',
  group: 'collective_anonymized',
};

function toSport(value: string): Sport | null {
  return SPORT_SET.has(value) ? (value as Sport) : null;
}

function toFinite(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPoint(row: ActivityPointRow): HeatmapTrackPoint | null {
  const lat = toFinite(row.lat);
  const lng = toFinite(row.lng);
  if (lat === null || lng === null || !isValidLatLng(lat, lng)) return null;
  if (!Number.isFinite(Date.parse(row.t))) return null;
  const elevation = toFinite(row.ele);
  return {
    lat,
    lng,
    timestamp: row.t,
    elevationM: elevation,
  };
}

function groupPoints(points: readonly ActivityPointRow[]): Map<string, ActivityPointRow[]> {
  const bySession = new Map<string, ActivityPointRow[]>();
  for (const point of points) {
    const list = bySession.get(point.session_id);
    if (list) list.push(point);
    else bySession.set(point.session_id, [point]);
  }
  return bySession;
}

/**
 * Construit les activités d'une heatmap.
 *
 * - `personal` conserve la visibilité réelle de la séance (la vue personnelle
 *   inclut les sorties privées du propriétaire, par contrat).
 * - `community` ne reçoit que des séances déjà filtrées par consentement
 *   explicite ; elles sont marquées `collective_anonymized` pour le moteur.
 */
export function mapActivityRows(
  sessions: readonly ActivitySessionRow[],
  points: readonly ActivityPointRow[],
  mode: ActivityBuildMode
): HeatmapActivityRecord[] {
  const pointsBySession = groupPoints(points);
  const records: HeatmapActivityRecord[] = [];

  for (const session of sessions) {
    if (session.status !== 'finished') continue;
    if (!session.id || !session.user_id) continue;

    const sport = toSport(session.sport);
    if (!sport) continue;
    if (!Number.isFinite(Date.parse(session.started_at))) continue;

    const sessionPoints = (pointsBySession.get(session.id) ?? [])
      .map(toPoint)
      .filter((point): point is HeatmapTrackPoint => point !== null)
      .sort((a, b) => Date.parse(a.timestamp ?? '') - Date.parse(b.timestamp ?? ''));

    if (sessionPoints.length === 0) continue;

    const visibility =
      mode === 'community'
        ? 'collective_anonymized'
        : (VISIBILITY_BY_SHARE_LEVEL[session.share_level ?? 'none'] ?? 'private');

    records.push({
      activityId: session.id,
      userId: session.user_id,
      sport,
      visibility,
      isPrivate: mode === 'community' ? false : visibility === 'private',
      excludeFromHeatmap: false,
      sessionFinished: true,
      deletedAt: null,
      startedAt: session.started_at,
      endedAt: session.ended_at ?? null,
      points: sessionPoints,
    });
  }

  return records;
}
