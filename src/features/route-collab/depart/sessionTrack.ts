/**
 * Trace d'une sortie enregistrée (`hike_sessions`) pour le carnet « plan contre réel » (9.9) : échantillons
 * horodatés quand la sortie en a (`positions_timed`), sinon la ligne simplifiée (`positions_geojson`) sans heure.
 * Bornée pour l'envoi au navigateur. Pur.
 */
import type { HandoffKitItem } from './activityHandoff';
import type { RecordedSample, RecordedSession } from './carnetCompare';

export const MAX_TRACK_SAMPLES = 400;

function thin<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return items.slice();
  const out: T[] = [];
  for (let i = 0; i < max; i += 1) out.push(items[Math.round((i / (max - 1)) * (items.length - 1))]);
  return out;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function trackOfSession(timed: unknown, geojson: unknown): RecordedSample[] {
  if (Array.isArray(timed) && timed.length >= 2) {
    const samples: RecordedSample[] = [];
    for (const s of timed as Array<{ lat?: unknown; lng?: unknown; timestamp?: unknown }>) {
      const lat = num(s?.lat);
      const lon = num(s?.lng);
      if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      const t = typeof s.timestamp === 'string' && Number.isFinite(Date.parse(s.timestamp)) ? s.timestamp : null;
      samples.push({ lat, lon, t });
    }
    if (samples.length >= 2) return thin(samples, MAX_TRACK_SAMPLES);
  }
  const coords = (geojson as { coordinates?: unknown } | null)?.coordinates;
  if (Array.isArray(coords)) {
    const samples: RecordedSample[] = [];
    for (const c of coords as unknown[]) {
      if (!Array.isArray(c)) continue;
      const lon = num(c[0]);
      const lat = num(c[1]);
      if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      samples.push({ lat, lon, t: null });
    }
    return thin(samples, MAX_TRACK_SAMPLES);
  }
  return [];
}

export function kitSnapshotOfRow(value: unknown): HandoffKitItem[] | null {
  if (!Array.isArray(value)) return null;
  return (value as Array<Partial<HandoffKitItem>>)
    .filter((i) => i && typeof i.id === 'string' && typeof i.name === 'string')
    .slice(0, 200)
    .map((i) => ({
      id: String(i.id),
      name: String(i.name).slice(0, 160),
      category: typeof i.category === 'string' ? i.category : 'divers',
      weightGrams: num(i.weightGrams),
      quantity: Math.max(1, Math.floor(num(i.quantity) ?? 1)),
      shared: i.shared === true,
      assigneeUserId: typeof i.assigneeUserId === 'string' ? i.assigneeUserId : null,
    }));
}

export interface HikeSessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  elevation_gain_m: number | null;
  positions_timed: unknown;
  positions_geojson: unknown;
  route_revision_id: string | null;
  kit_snapshot: unknown;
}

export function recordedSessionOf(row: HikeSessionRow): RecordedSession {
  return {
    sessionId: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceKm: num(row.distance_km),
    durationSeconds: num(row.duration_seconds),
    elevationGainM: num(row.elevation_gain_m),
    track: trackOfSession(row.positions_timed, row.positions_geojson),
    kitSnapshot: kitSnapshotOfRow(row.kit_snapshot),
    routeRevisionId: row.route_revision_id,
  };
}
