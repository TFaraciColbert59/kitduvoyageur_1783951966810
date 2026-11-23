/**
 * Lecture d'une journée (6.3 à 6.10) : une seule structure par jour, la même que celle du tiroir « Jour » du
 * Compas v5 (distance, D+, durée, date, nuit, météo à part). Pure : les lieux réels (OpenStreetMap) lui sont
 * fournis, elle n'invente rien.
 *
 * - durée : sur le plus lent du groupe (Naismith) pour la marche ; durée du routeur pour le vélo ;
 * - arrivée : heure de départ + durée, comparée au coucher du soleil du lieu et du jour (fuseau du lieu) ;
 * - eau et ravitaillement : lieux relevés le long de l'étape, plus longue distance sans eau ;
 * - nuit : lieux réels classés comme le Compas v5 ; sans lieu, « nuit à trouver » ;
 * - repli : sortie la plus proche (route ou transport) parmi les lieux relevés ; sans lieu « repli non évalué ».
 */
import type { RoutePoi } from '@/features/compas/engine/routePois';
import type { V5StayOption } from '@/features/compas/v5/types';
import { activePoints } from './engine';
import { stageKind } from './engineTrack';
import { nearestBailout, type BailoutHit } from './insights/bailout';
import { arrivalVsSunset, localStageDate, zonedTimeToUtc, type ArrivalVsSunset } from './insights/daylight';
import { groupPace, naismithDuration, naismithMethod, type GroupPace, type PaceMember } from './insights/pace';
import { stageLegs, trackVertices, legsStats, type RouteGraph } from './insights/shared';
import { longestWaterGap, type WaterGap } from './insights/water';
import { bailoutCandidatesFrom, nightOptionsFor, suppliesAlong, waterObservationsFrom, type SupplyStop } from './nights';
import type { CollaborativeRoutePoint, CollaborativeStage, OvernightPlace, RouteWorkspaceState, StageKind, WaterObservation } from './types';

export type PlacesStatus = 'idle' | 'loading' | 'ready' | 'partial' | 'error';

export interface DayPlaces {
  readonly status: PlacesStatus;
  readonly pois: readonly RoutePoi[];
  /** Instant de la lecture (ISO) ; `null` tant que rien n'a été lu. */
  readonly fetchedAt: string | null;
}

export const NO_PLACES: DayPlaces = { status: 'idle', pois: [], fetchedAt: null };

export interface DayDuration {
  readonly minutes: number | null;
  /** Vrai quand le D+ inconnu n'est pas compté : durée minimale. */
  readonly lowerBound: boolean;
  readonly method: string;
  readonly basis: 'naismith' | 'router' | 'rest';
}

export type NightState =
  | { readonly status: 'last' }
  | { readonly status: 'chosen'; readonly chosen: OvernightPlace; readonly options: readonly V5StayOption[] }
  | { readonly status: 'candidates'; readonly options: readonly V5StayOption[] }
  /** Lieux lus, aucun hébergement réel autour de l'arrivée : la personne doit en trouver un. */
  | { readonly status: 'to_find'; readonly options: readonly V5StayOption[] }
  /** Lieux pas encore lus (ou lecture en échec) : rien n'est dit sur les nuits possibles. */
  | { readonly status: 'unknown'; readonly reason: 'not_loaded' | 'loading' | 'error' };

export interface DayBailout {
  readonly status: 'found' | 'not_evaluated';
  readonly hit: BailoutHit | null;
  /** « Repli non évalué » ou la raison précise. */
  readonly label: string;
  readonly reason: string | null;
}

export interface DayReading {
  readonly stageId: string;
  readonly dayNumber: number;
  readonly kind: StageKind;
  readonly title: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly endLat: number | null;
  readonly endLon: number | null;
  readonly distanceKm: number | null;
  readonly ascentM: number | null;
  readonly descentM: number | null;
  readonly duration: DayDuration;
  readonly dateIso: string | null;
  readonly timezone: string;
  readonly dateLabel: string | null;
  readonly dstChange: 'forward' | 'back' | null;
  readonly dayLengthHours: number | null;
  readonly departureTimeLocal: string;
  readonly arrival: ArrivalVsSunset;
  readonly water: WaterGap;
  readonly waterPointCount: number;
  readonly supplies: readonly SupplyStop[];
  readonly night: NightState;
  readonly bailout: DayBailout;
  readonly isLast: boolean;
}

export interface DayReadingOptions {
  readonly pace: GroupPace;
  /** Lieux communs à toutes les journées (repli quand `placesByStage` ne dit rien d'une journée). */
  readonly places: DayPlaces;
  /** Lieux relevés pour chaque journée (clé : identifiant d'étape) : une journée jamais relevée reste « inconnue ». */
  readonly placesByStage?: Readonly<Record<string, DayPlaces>>;
  readonly party: number;
  readonly countryCode?: string | null;
}

const NO_WATER = (method: string): WaterGap => ({
  status: 'no_track',
  gapKm: null,
  fromKm: null,
  toKm: null,
  fromLabel: null,
  toLabel: null,
  trackKm: null,
  waterPointCount: 0,
  method,
});

export function defaultPace(): GroupPace {
  return groupPace([]);
}

export function paceOf(members: readonly PaceMember[], manualSlowestKmh?: number | null): GroupPace {
  const all: PaceMember[] = members.slice();
  if (manualSlowestKmh != null && manualSlowestKmh > 0) all.push({ id: 'manual', name: 'Allure renseignée', speedKmh: manualSlowestKmh });
  return groupPace(all);
}

export function dateLabelOf(dateIso: string | null, timezone: string): string | null {
  if (!dateIso) return null;
  const noon = zonedTimeToUtc(dateIso, '12:00', timezone);
  if (!noon) return null;
  try {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(noon);
  } catch {
    return null;
  }
}

function stageGraph(ws: Pick<RouteWorkspaceState, 'points' | 'sections'>, stage: CollaborativeStage): RouteGraph {
  const pts = activePoints(ws as RouteWorkspaceState);
  const a = pts.findIndex((p) => p.id === stage.startPointId);
  const b = pts.findIndex((p) => p.id === stage.endPointId);
  const slice: CollaborativeRoutePoint[] = a >= 0 && b > a ? pts.slice(a, b + 1) : [];
  return { points: slice, sections: ws.sections };
}

function durationOf(sport: RouteWorkspaceState['sport'], kind: StageKind, stats: ReturnType<typeof legsStats>, pace: GroupPace): DayDuration {
  if (kind === 'rest') return { minutes: 0, lowerBound: false, method: 'Journée de repos', basis: 'rest' };
  if (stats.legCount === 0 || stats.missingSections > 0) return { minutes: null, lowerBound: false, method: 'Tracé de la journée incomplet', basis: 'router' };
  if (sport === 'marche') {
    const est = naismithDuration(stats.distanceKm, stats.ascentM, pace.params);
    return {
      minutes: est.minutes,
      lowerBound: est.isLowerBound,
      method: pace.basis === 'slowest_member' ? `${naismithMethod(pace.params)}, allure du plus lent` : `${naismithMethod(pace.params)} (allure du groupe non renseignée)`,
      basis: 'naismith',
    };
  }
  return {
    minutes: stats.durationMin,
    lowerBound: false,
    method: stats.durationMin == null ? 'Durée du routeur absente' : 'Durée du routeur (sport à vélo : l’allure Naismith ne s’applique pas)',
    basis: 'router',
  };
}

export function readDays(ws: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages' | 'sport'>, options: DayReadingOptions): DayReading[] {
  const pts = activePoints(ws as RouteWorkspaceState);
  const byId = new Map(pts.map((p) => [p.id, p]));
  const days = ws.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  return days.map((stage, index) => {
    const places = options.placesByStage?.[stage.id] ?? options.places;
    const ready = places.status === 'ready' || places.status === 'partial';
    const waterObs = ready ? waterObservationsFrom(places.pois, places.fetchedAt ?? '') : [];
    const bailouts = ready ? bailoutCandidatesFrom(places.pois) : [];
    const kind = stageKind(stage);
    const graph = stageGraph(ws, stage);
    const legs = kind === 'rest' ? [] : stageLegs({ points: pts, sections: ws.sections }, stage);
    const stats = legsStats(legs);
    const end = byId.get(stage.endPointId) ?? null;
    const start = byId.get(stage.startPointId) ?? null;
    const isLast = index === days.length - 1;
    const duration = durationOf(ws.sport, kind, stats, options.pace);
    const tz = stage.timezone || 'Europe/Paris';
    const local = stage.dateIso ? localStageDate(stage.dateIso, tz) : null;
    const arrival = kind === 'rest'
      ? ({ known: false, arrivalLocal: null, sunsetLocal: null, marginMin: null, late: false, reason: 'journée de repos', method: '' } as ArrivalVsSunset)
      : arrivalVsSunset({ dateIso: stage.dateIso, lat: end?.lat ?? null, lon: end?.lon ?? null }, stage.departureTimeLocal, duration.minutes, tz);

    // Eau : relevés d'OpenStreetMap et points déclarés dans l'étape, le long du tracé de la journée.
    const obs: WaterObservation[] = [...stage.waterObservations, ...waterObs];
    const water = kind === 'rest' || graph.points.length < 2 ? NO_WATER('Journée sans tracé') : longestWaterGap(graph, obs);
    const verts = trackVertices(legs);
    const supplies = ready && kind !== 'rest' ? suppliesAlong(verts, places.pois) : [];

    let night: NightState;
    if (isLast) night = { status: 'last' };
    else {
      const chosen = stage.overnightPlace;
      const opts = ready
        ? nightOptionsFor({ arrival: end ? { lat: end.lat, lon: end.lon } : null, pois: places.pois, noted: chosen?.name ?? null, party: options.party, countryCode: options.countryCode })
        : [];
      if (chosen) night = { status: 'chosen', chosen, options: opts };
      else if (ready) night = opts.length > 0 ? { status: 'candidates', options: opts } : { status: 'to_find', options: [] };
      else night = { status: 'unknown', reason: places.status === 'loading' ? 'loading' : places.status === 'error' ? 'error' : 'not_loaded' };
    }

    let bailout: DayBailout;
    if (kind === 'rest') bailout = { status: 'not_evaluated', hit: null, label: 'Repli non évalué', reason: 'journée de repos' };
    else if (!ready) bailout = { status: 'not_evaluated', hit: null, label: 'Repli non évalué', reason: 'lieux pas encore relevés' };
    else {
      const res = nearestBailout(verts.map((v) => [v.lon, v.lat] as const), bailouts);
      bailout = res.nearest
        ? { status: 'found', hit: res.nearest, label: res.nearest.candidate.name, reason: null }
        : { status: 'not_evaluated', hit: null, label: 'Repli non évalué', reason: res.reason };
    }

    return {
      stageId: stage.id,
      dayNumber: stage.dayNumber,
      kind,
      title: stage.title,
      from: start?.name ?? null,
      to: end?.name ?? null,
      endLat: end?.lat ?? null,
      endLon: end?.lon ?? null,
      distanceKm: kind === 'rest' ? 0 : stats.legCount > 0 ? stats.distanceKm : null,
      ascentM: kind === 'rest' ? 0 : stats.ascentM,
      descentM: kind === 'rest' ? 0 : stats.descentM,
      duration,
      dateIso: stage.dateIso,
      timezone: tz,
      dateLabel: dateLabelOf(stage.dateIso, tz),
      dstChange: local?.dstChange ?? null,
      dayLengthHours: local?.dayLengthHours ?? null,
      departureTimeLocal: stage.departureTimeLocal,
      arrival,
      water,
      waterPointCount: water.waterPointCount,
      supplies,
      night,
      bailout,
      isLast,
    };
  });
}

/** Une phrase sur l'allure retenue, pour la vue experte et le titre « durées calculées sur ». */
export function describePace(pace: GroupPace, members: readonly PaceMember[]): string {
  if (pace.basis === 'default') return `Allure standard (${pace.params.speedKmh} km/h) : l’allure des membres n’est pas renseignée.`;
  const slowest = members.find((m) => m.id === pace.slowestMemberId);
  const who = slowest?.id === 'manual' ? 'allure renseignée' : (slowest?.name ?? 'le plus lent');
  const unknown = pace.unknownMemberIds.length;
  return `Calculé sur ${who} (${pace.params.speedKmh} km/h)${unknown > 0 ? ` ; ${unknown} membre${unknown > 1 ? 's' : ''} sans allure renseignée` : ''}.`;
}
