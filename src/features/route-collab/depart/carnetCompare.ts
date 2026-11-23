/**
 * Carnet « plan contre réel » (9.9) : tracé prévu et tracé enregistré superposés, écarts de temps par jour,
 * sac emporté. Pur. Le plan est la VERSION SUIVIE (jamais altérée par une publication plus récente) ; le réel est
 * la sortie enregistrée (`hike_sessions`). Aucune valeur du réel n'est reprise du plan : sans horodatage, l'écart
 * de temps est inconnu ; une étape que la trace n'atteint pas n'a pas d'écart.
 */
import { orderedLegs, stageLegs, legsStats, trackVertices } from '../insights/shared';
import type { RouteGraph } from '../insights/shared';
import { haversineM } from '../mapGeometry';
import type { CollaborativeKitItem, CollaborativeStage } from '../types';
import type { HandoffKitItem } from './activityHandoff';

export interface RecordedSample {
  readonly lat: number;
  readonly lon: number;
  /** Instant ISO ; `null` quand la trace n'est pas horodatée. */
  readonly t: string | null;
}

export interface RecordedSession {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly distanceKm: number | null;
  readonly durationSeconds: number | null;
  readonly elevationGainM: number | null;
  readonly track: readonly RecordedSample[];
  readonly kitSnapshot: readonly HandoffKitItem[] | null;
  readonly routeRevisionId: string | null;
}

export interface DayCompare {
  readonly stageId: string;
  readonly day: number;
  readonly plannedMin: number | null;
  readonly actualMin: number | null;
  /** Réel moins plan, en minutes ; `null` si l'un des deux est inconnu. */
  readonly deltaMin: number | null;
  readonly reached: boolean;
  readonly reason: string | null;
}

export interface KitCompare {
  readonly planned: number;
  readonly carried: number | null;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  readonly plannedGrams: number | null;
  readonly carriedGrams: number | null;
}

export interface PlanVsActual {
  readonly plannedKm: number | null;
  readonly recordedKm: number | null;
  readonly deltaKm: number | null;
  readonly days: readonly DayCompare[];
  readonly kit: KitCompare;
  readonly method: string;
}

export const REACH_RADIUS_M = 300;
export const STOP_GAP_MS = 2 * 3600_000;
export const COMPARE_METHOD = `Étape atteinte quand la trace passe à moins de ${REACH_RADIUS_M} m de son arrivée ; temps réel = temps horodaté entre deux arrivées, arrêts de plus de 2 h exclus`;

function weight(items: readonly { weightGrams: number | null; quantity: number }[]): number | null {
  if (items.length === 0) return null;
  if (items.some((i) => i.weightGrams == null)) return null;
  return items.reduce((a, i) => a + (i.weightGrams as number) * Math.max(1, i.quantity), 0);
}

/** Temps cumulé (min) entre deux indices de la trace, sans les arrêts de plus de 2 h ; `null` sans horodatage. */
function elapsedMin(track: readonly RecordedSample[], from: number, to: number): number | null {
  let ms = 0;
  for (let i = from + 1; i <= to; i += 1) {
    const a = track[i - 1].t ? Date.parse(track[i - 1].t as string) : NaN;
    const b = track[i].t ? Date.parse(track[i].t as string) : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
    if (b - a <= STOP_GAP_MS) ms += b - a;
  }
  return Math.round(ms / 60000);
}

export function comparePlanToActual(
  plan: RouteGraph & { readonly stages: readonly CollaborativeStage[]; readonly kitSnapshot?: readonly CollaborativeKitItem[] },
  session: RecordedSession,
): PlanVsActual {
  const plannedStats = legsStats(orderedLegs(plan));
  const plannedKm = plan.sections.length > 0 ? plannedStats.distanceKm : null;
  const recordedKm = session.distanceKm;
  const stages = plan.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  const days: DayCompare[] = [];
  let cursor = 0;
  for (const st of stages) {
    const verts = trackVertices(stageLegs(plan, st));
    const plannedMin = legsStats(stageLegs(plan, st)).durationMin;
    const end = verts[verts.length - 1];
    if (!end || session.track.length < 2) {
      days.push({ stageId: st.id, day: st.dayNumber, plannedMin, actualMin: null, deltaMin: null, reached: false, reason: session.track.length < 2 ? 'trace enregistrée absente' : 'arrivée de l’étape inconnue' });
      continue;
    }
    let hit = -1;
    for (let i = cursor; i < session.track.length; i += 1) {
      if (haversineM([session.track[i].lon, session.track[i].lat], [end.lon, end.lat]) <= REACH_RADIUS_M) {
        hit = i;
        break;
      }
    }
    if (hit < 0) {
      days.push({ stageId: st.id, day: st.dayNumber, plannedMin, actualMin: null, deltaMin: null, reached: false, reason: 'arrivée non atteinte par la trace' });
      continue;
    }
    const actualMin = elapsedMin(session.track, cursor, hit);
    days.push({
      stageId: st.id,
      day: st.dayNumber,
      plannedMin,
      actualMin,
      deltaMin: plannedMin != null && actualMin != null ? actualMin - plannedMin : null,
      reached: true,
      reason: actualMin == null ? 'trace sans horodatage' : plannedMin == null ? 'durée prévue inconnue' : null,
    });
    cursor = hit;
  }
  const planned = plan.kitSnapshot ?? [];
  const carried = session.kitSnapshot;
  const plannedIds = new Set(planned.map((i) => i.id));
  const carriedIds = new Set((carried ?? []).map((i) => i.id));
  return {
    plannedKm,
    recordedKm,
    deltaKm: plannedKm != null && recordedKm != null ? Math.round((recordedKm - plannedKm) * 10) / 10 : null,
    days,
    kit: {
      planned: planned.length,
      carried: carried ? carried.length : null,
      missing: carried ? planned.filter((i) => !carriedIds.has(i.id)).map((i) => i.name) : [],
      extra: carried ? carried.filter((i) => !plannedIds.has(i.id)).map((i) => i.name) : [],
      plannedGrams: weight(planned),
      carriedGrams: carried ? weight(carried) : null,
    },
    method: COMPARE_METHOD,
  };
}

/** Deux tracés dans le même cadre (SVG) : le prévu et l'enregistré, sans déformation (même échelle en x et y). */
export function overlayPaths(
  planned: readonly (readonly [number, number])[],
  actual: readonly (readonly [number, number])[],
  width: number,
  height: number,
  pad = 8,
): { plannedPath: string; actualPath: string } | null {
  const all = [...planned, ...actual];
  if (planned.length < 2 && actual.length < 2) return null;
  const lons = all.map((p) => p[0]);
  const lats = all.map((p) => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const kx = Math.cos(midLat);
  const spanX = Math.max(1e-9, (maxLon - minLon) * kx);
  const spanY = Math.max(1e-9, maxLat - minLat);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const toPath = (line: readonly (readonly [number, number])[]) =>
    line.length < 2
      ? ''
      : line.map((p, i) => `${i === 0 ? 'M' : 'L'}${(offX + (p[0] - minLon) * kx * scale).toFixed(1)} ${(height - offY - (p[1] - minLat) * scale).toFixed(1)}`).join(' ');
  return { plannedPath: toPath(planned), actualPath: toPath(actual) };
}
