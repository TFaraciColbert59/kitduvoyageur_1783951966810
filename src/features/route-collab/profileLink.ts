/**
 * Profil et carte liés (2.6) : un modèle unique (distance, altitude, coordonnée, jour) d'où l'on lit,
 * dans les deux sens, « où suis-je sur le tracé ? » (carte → profil) et « où est ce kilomètre ? » (profil → carte).
 * Une donnée absente reste `null` (« inconnue »), jamais 0.
 */
import { cumulativeMeters, projectOnPolyline, sectionDayMap, type LonLat } from './mapGeometry';
import type { CollaborativeRoutePoint, CollaborativeRouteSection, CollaborativeStage } from './types';

export interface ProfilePoint {
  readonly lon: number;
  readonly lat: number;
  readonly distanceM: number;
  readonly elevationM: number | null;
  readonly sectionId: string;
  readonly day: number | null;
}

export interface ProfileModel {
  readonly points: readonly ProfilePoint[];
  readonly totalM: number;
  readonly hasElevation: boolean;
  /** Durée cumulée (min) au début de chaque tronçon, dans la journée, `null` si une durée manque. */
  readonly sectionStartMinInDay: ReadonlyMap<string, number | null>;
  readonly sectionDurationMin: ReadonlyMap<string, number | null>;
  readonly departureByDay: ReadonlyMap<number, string>;
}

export interface ProfileInput {
  readonly orderedPoints: readonly CollaborativeRoutePoint[];
  readonly sections: readonly CollaborativeRouteSection[];
  readonly stages: readonly CollaborativeStage[];
}

/** Même indexation que `buildElevationProfile` : un échantillon par coordonnée de chaque tronçon, à la suite. */
export function buildProfileModel(input: ProfileInput): ProfileModel {
  const days = sectionDayMap(input.orderedPoints, input.sections, input.stages);
  const pts: ProfilePoint[] = [];
  const byId = new Map(input.orderedPoints.map((p) => [p.id, p]));
  let offset = 0;
  let hasElevation = false;
  const sectionStartMinInDay = new Map<string, number | null>();
  const sectionDurationMin = new Map<string, number | null>();
  let runningDay: number | null = null;
  let runningMin: number | null = 0;

  for (const s of input.sections) {
    const coords = s.geometry.coordinates;
    if (coords.length === 0) continue;
    const cum = cumulativeMeters(coords);
    const ele = s.elevationSamples;
    const day = days.get(s.id) ?? null;
    if (day !== runningDay) {
      runningDay = day;
      runningMin = 0;
    }
    sectionStartMinInDay.set(s.id, runningMin);
    sectionDurationMin.set(s.id, s.durationMin);
    runningMin = runningMin == null || s.durationMin == null ? null : runningMin + s.durationMin;

    const from = byId.get(s.fromPointId);
    const to = byId.get(s.toPointId);
    for (let i = 0; i < coords.length; i += 1) {
      let e: number | null = null;
      if (ele && ele.length >= 2) {
        e = ele[Math.min(ele.length - 1, Math.round((i / Math.max(1, coords.length - 1)) * (ele.length - 1)))] ?? null;
      } else if (i === 0 && from?.eleM != null) e = from.eleM;
      else if (i === coords.length - 1 && to?.eleM != null) e = to.eleM;
      if (e != null) hasElevation = true;
      pts.push({ lon: coords[i][0], lat: coords[i][1], distanceM: offset + cum[i], elevationM: e, sectionId: s.id, day });
    }
    offset += cum[cum.length - 1];
  }

  const departureByDay = new Map<number, string>();
  for (const st of input.stages) departureByDay.set(st.dayNumber, st.departureTimeLocal);
  return { points: pts, totalM: offset, hasElevation, sectionStartMinInDay, sectionDurationMin, departureByDay };
}

/** Index du point du profil le plus proche d'une coordonnée (carte → profil) ; `null` hors tracé. */
export function nearestProfileIndex(model: ProfileModel, coord: LonLat, maxDistanceM = 120): number | null {
  if (model.points.length < 2) return null;
  const line: LonLat[] = model.points.map((p) => [p.lon, p.lat]);
  const proj = projectOnPolyline(line, coord);
  if (!proj || proj.distanceM > maxDistanceM) return null;
  return proj.t < 0.5 ? proj.index : Math.min(proj.index + 1, model.points.length - 1);
}

/** Index du profil au kilomètre demandé (profil → carte). */
export function profileIndexAtDistance(model: ProfileModel, distanceM: number): number | null {
  const n = model.points.length;
  if (n === 0) return null;
  if (distanceM <= 0) return 0;
  if (distanceM >= model.totalM) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (model.points[mid].distanceM <= distanceM) lo = mid;
    else hi = mid;
  }
  return distanceM - model.points[lo].distanceM <= model.points[hi].distanceM - distanceM ? lo : hi;
}

function addMinutes(hhmm: string, minutes: number): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]) + Math.round(minutes);
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

export interface ProfileReadout {
  readonly index: number;
  readonly km: number;
  readonly elevationM: number | null;
  /** Pente moyenne autour du curseur, en %, signée ; `null` si l'altitude manque. */
  readonly slopePct: number | null;
  /** Heure de passage estimée du jour (HH:MM) ; `null` si une durée ou l'heure de départ manque. */
  readonly passageTime: string | null;
  readonly day: number | null;
  readonly lon: number;
  readonly lat: number;
}

/** Fenêtre de pente : ~120 m de part et d'autre, avec au moins deux altitudes connues. */
function slopeAround(model: ProfileModel, index: number, windowM = 120): number | null {
  const here = model.points[index];
  let a = index;
  let b = index;
  while (a > 0 && here.distanceM - model.points[a].distanceM < windowM) a -= 1;
  while (b < model.points.length - 1 && model.points[b].distanceM - here.distanceM < windowM) b += 1;
  let lo = a;
  while (lo < index && model.points[lo].elevationM == null) lo += 1;
  let hi = b;
  while (hi > index && model.points[hi].elevationM == null) hi -= 1;
  const pa = model.points[lo];
  const pb = model.points[hi];
  if (pa.elevationM == null || pb.elevationM == null || pb.distanceM - pa.distanceM < 20) return null;
  return Number((((pb.elevationM - pa.elevationM) / (pb.distanceM - pa.distanceM)) * 100).toFixed(1));
}

export function readProfileAt(model: ProfileModel, index: number): ProfileReadout | null {
  const p = model.points[index];
  if (!p) return null;
  let passageTime: string | null = null;
  const startMin = model.sectionStartMinInDay.get(p.sectionId);
  const dur = model.sectionDurationMin.get(p.sectionId);
  const dep = p.day != null ? model.departureByDay.get(p.day) : undefined;
  if (startMin != null && dur != null && dep) {
    // Part de la section déjà parcourue, d'après la distance (les sections sont contiguës dans le modèle).
    const first = model.points.find((q) => q.sectionId === p.sectionId);
    const lastIdx = (() => {
      for (let i = model.points.length - 1; i >= 0; i -= 1) if (model.points[i].sectionId === p.sectionId) return i;
      return index;
    })();
    const last = model.points[lastIdx];
    const span = first && last ? last.distanceM - first.distanceM : 0;
    const ratio = span > 0 && first ? (p.distanceM - first.distanceM) / span : 0;
    passageTime = addMinutes(dep, startMin + dur * ratio);
  }
  return {
    index,
    km: Number((p.distanceM / 1000).toFixed(2)),
    elevationM: p.elevationM == null ? null : Math.round(p.elevationM),
    slopePct: slopeAround(model, index),
    passageTime,
    day: p.day,
    lon: p.lon,
    lat: p.lat,
  };
}
