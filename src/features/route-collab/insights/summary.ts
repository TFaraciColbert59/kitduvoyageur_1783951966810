import type { RouteWorkspaceState } from '../types';
import { formatDecimalFr, formatInt, legsStats, orderedLegs, trackVertices, type OrderedLeg } from './shared';

/* ---------- 3.1 Pastille ---------- */

/** « 3 j · 42 km · 2 180 m ». Une donnée absente s'écrit « ? », jamais 0 ; sans étape, le nombre de jours est omis (pas de « ? j »). */
export function formatPillSummary(state: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages'>): string {
  const days = state.stages.length > 0 ? `${state.stages.length} j` : null;
  const stats = legsStats(orderedLegs(state));
  const hasGeometry = state.sections.length > 0;
  const km = hasGeometry ? `${formatInt(stats.distanceKm)} km` : '? km';
  // D+ : somme des tronçons existants, inconnue dès qu'un tronçon ne le dit pas.
  let ascent: number | null = state.sections.length > 0 ? 0 : null;
  for (const s of state.sections) {
    ascent = ascent === null || s.ascentM == null ? null : ascent + s.ascentM;
  }
  const dplus = ascent === null ? 'D+ ?' : `${formatInt(ascent)} m`;
  return [days, km, dplus].filter((p): p is string => p !== null).join(' · ');
}

/* ---------- Constats de qualité du tracé ---------- */

const JOIN_GAP_KM = 0.1;

export interface RouteFaults {
  readonly missingJoins: number;
  readonly gapJoins: number;
  readonly manualUnverified: number;
  readonly elevationUnknown: number;
  readonly surfaceUnknown: number;
  readonly firstFaultySectionId: string | null;
  readonly hasRoute: boolean;
}

function sectionEnds(leg: OrderedLeg): { start: { lat: number; lon: number }; end: { lat: number; lon: number } } | null {
  const c = leg.section?.geometry.coordinates;
  if (!c || c.length < 2) return null;
  return { start: { lon: c[0][0], lat: c[0][1] }, end: { lon: c[c.length - 1][0], lat: c[c.length - 1][1] } };
}

function approxKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dy = (a.lat - b.lat) * 110.574;
  const dx = (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180) * 111.32;
  return Math.sqrt(dx * dx + dy * dy);
}

export function routeFaults(state: Pick<RouteWorkspaceState, 'points' | 'sections'>): RouteFaults {
  const legs = orderedLegs(state);
  let missing = 0;
  let gaps = 0;
  let manual = 0;
  let elev = 0;
  let surf = 0;
  let first: string | null = null;
  let previousSectionId: string | null = null;
  let previousEnd: { lat: number; lon: number } | null = null;
  const mark = (id: string | null) => {
    if (first === null && id) first = id;
  };
  for (const leg of legs) {
    const s = leg.section;
    if (!s) {
      missing += 1;
      mark(previousSectionId);
      previousEnd = null;
      continue;
    }
    const ends = sectionEnds(leg);
    if (ends && previousEnd && approxKm(previousEnd, ends.start) > JOIN_GAP_KM) {
      gaps += 1;
      mark(previousSectionId);
    }
    if (s.mode === 'manual' && s.provenance.confidence !== 'verified') {
      manual += 1;
      mark(s.id);
    }
    if (s.ascentM == null) {
      elev += 1;
      mark(s.id);
    }
    const known = s.surfaceSegments.some((g) => g.surface !== 'unknown' && g.toRatio > g.fromRatio);
    if (!known) {
      surf += 1;
      mark(s.id);
    }
    previousSectionId = s.id;
    previousEnd = ends?.end ?? null;
  }
  return {
    missingJoins: missing,
    gapJoins: gaps,
    manualUnverified: manual,
    elevationUnknown: elev,
    surfaceUnknown: surf,
    firstFaultySectionId: first,
    hasRoute: legs.length > 0 && trackVertices(legs).length > 1,
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/* ---------- 3.7 Feu de qualité ---------- */

export interface RouteQualityLight {
  readonly level: 'green' | 'orange' | 'red';
  readonly reasons: readonly string[];
  readonly firstFaultySectionId: string | null;
}

export function routeQualityLight(state: Pick<RouteWorkspaceState, 'points' | 'sections'>): RouteQualityLight {
  const f = routeFaults(state);
  const red: string[] = [];
  const orange: string[] = [];
  if (!f.hasRoute) red.push('Aucun tracé : ajoutez au moins deux points reliés');
  if (f.missingJoins > 0) red.push(`${plural(f.missingJoins, 'raccord manquant', 'raccords manquants')} entre tronçons`);
  if (f.gapJoins > 0) red.push(`${plural(f.gapJoins, 'saut', 'sauts')} de plus de 100 m entre deux tronçons`);
  if (f.manualUnverified > 0) orange.push(`${plural(f.manualUnverified, 'tronçon manuel non vérifié', 'tronçons manuels non vérifiés')}`);
  if (f.elevationUnknown > 0) orange.push(`Altitude inconnue sur ${plural(f.elevationUnknown, 'tronçon', 'tronçons')}`);
  if (f.surfaceUnknown > 0) orange.push(`Surface inconnue sur ${plural(f.surfaceUnknown, 'tronçon', 'tronçons')}`);
  const level = red.length > 0 ? 'red' : orange.length > 0 ? 'orange' : 'green';
  return { level, reasons: [...red, ...orange], firstFaultySectionId: f.firstFaultySectionId };
}

/* ---------- 3.8 Prêt / Presque prêt / À compléter ---------- */

export interface Fact {
  readonly code:
    | 'no_route'
    | 'joins_missing'
    | 'overnight_missing'
    | 'date_missing'
    | 'elevation_unknown'
    | 'surface_unknown'
    | 'kit_unassigned'
    | 'kit_to_revalidate';
  readonly count: number;
  readonly text: string;
}

export interface Readiness {
  readonly label: 'Prêt' | 'Presque prêt' | 'À compléter';
  readonly remaining: readonly Fact[];
}

export function readinessFacts(
  state: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages' | 'kitItems'>,
): Readiness {
  const f = routeFaults(state);
  const remaining: Fact[] = [];
  const add = (code: Fact['code'], count: number, text: string) => {
    if (count > 0) remaining.push({ code, count, text });
  };
  add('no_route', f.hasRoute ? 0 : 1, 'Aucun tracé');
  add('joins_missing', f.missingJoins + f.gapJoins, plural(f.missingJoins + f.gapJoins, 'raccord à corriger', 'raccords à corriger'));
  const sorted = state.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  const nightsToFind = sorted.slice(0, -1).filter((s) => !s.overnightPlace).length;
  add('overnight_missing', nightsToFind, plural(nightsToFind, 'nuit à trouver', 'nuits à trouver'));
  const undated = state.stages.filter((s) => !s.dateIso).length;
  add('date_missing', undated, plural(undated, 'étape sans date', 'étapes sans date'));
  add('elevation_unknown', f.elevationUnknown, plural(f.elevationUnknown, 'tronçon sans altitude', 'tronçons sans altitude'));
  add('surface_unknown', f.surfaceUnknown, plural(f.surfaceUnknown, 'tronçon sans surface', 'tronçons sans surface'));
  const unassigned = state.kitItems.filter((i) => i.shared && !i.assigneeUserId).length;
  add('kit_unassigned', unassigned, plural(unassigned, 'objet commun sans porteur', 'objets communs sans porteur'));
  const reval = state.kitItems.filter((i) => i.status === 'needs_revalidation').length;
  add('kit_to_revalidate', reval, plural(reval, 'objet à revérifier', 'objets à revérifier'));
  const blocking = remaining.some((r) => r.code === 'no_route' || r.code === 'joins_missing');
  const label = remaining.length === 0 ? 'Prêt' : !blocking && remaining.length <= 2 ? 'Presque prêt' : 'À compléter';
  return { label, remaining };
}

/* ---------- 7.10 Synthèse en trois lignes ---------- */

export interface SynthesisContext {
  /** Instant de référence (injecté). Par défaut : `state.updatedAt`. */
  readonly now?: Date;
  /** Jours d'étape où l'arrivée dépasse le coucher du soleil. */
  readonly lateStageDays?: readonly number[];
  /** Plus longue distance sans point d'eau (km) ; `null` : inconnue. */
  readonly longestWaterGapKm?: number | null;
  readonly waterGapAlertKm?: number;
}

export interface ThreeLineSynthesis {
  readonly ok: string[];
  readonly toCheck: string[];
  readonly blocking: string[];
}

export function threeLineSynthesis(state: RouteWorkspaceState, context: SynthesisContext = {}): ThreeLineSynthesis {
  const now = context.now ?? new Date(state.updatedAt);
  const ok: string[] = [];
  const toCheck: string[] = [];
  const blocking: string[] = [];
  const f = routeFaults(state);
  const quality = routeQualityLight(state);

  if (!f.hasRoute) blocking.push('Aucun tracé');
  if (f.missingJoins + f.gapJoins > 0) blocking.push(plural(f.missingJoins + f.gapJoins, 'raccord à corriger', 'raccords à corriger'));
  if (quality.level === 'green') ok.push('Tracé continu, altitude et surface connues');
  else if (f.hasRoute && f.missingJoins + f.gapJoins === 0) ok.push('Tracé continu');
  if (f.manualUnverified > 0) toCheck.push(plural(f.manualUnverified, 'tronçon manuel à vérifier', 'tronçons manuels à vérifier'));
  if (f.elevationUnknown > 0) toCheck.push(`Altitude inconnue sur ${plural(f.elevationUnknown, 'tronçon', 'tronçons')}`);
  if (f.surfaceUnknown > 0) toCheck.push(`Surface inconnue sur ${plural(f.surfaceUnknown, 'tronçon', 'tronçons')}`);

  const sorted = state.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  const nights = sorted.slice(0, -1);
  const found = nights.filter((s) => s.overnightPlace).length;
  if (nights.length > 0) {
    if (found === nights.length) ok.push(plural(found, 'nuit trouvée', 'nuits trouvées'));
    else toCheck.push(plural(nights.length - found, 'nuit à trouver', 'nuits à trouver'));
  }
  const unconfirmed = nights.filter((s) => s.overnightPlace && s.overnightPlace.bookingStatus !== 'confirmed').length;
  if (unconfirmed > 0) toCheck.push(plural(unconfirmed, 'nuit non confirmée', 'nuits non confirmées'));

  if (context.lateStageDays && context.lateStageDays.length > 0) {
    toCheck.push(`Arrivée après le coucher du soleil, jour ${context.lateStageDays.join(', ')}`);
  }
  if (context.longestWaterGapKm != null && context.waterGapAlertKm != null && context.longestWaterGapKm > context.waterGapAlertKm) {
    toCheck.push(`${formatDecimalFr(context.longestWaterGapKm)} km sans point d'eau connu`);
  }
  const activeHazards = state.stages.flatMap((s) => s.hazards).filter((h) => !h.expiresAt || Date.parse(h.expiresAt) > now.getTime());
  if (activeHazards.length > 0) toCheck.push(plural(activeHazards.length, 'alerte en cours', 'alertes en cours'));
  const reval = state.kitItems.filter((i) => i.status === 'needs_revalidation').length;
  if (reval > 0) toCheck.push(plural(reval, 'objet à revérifier', 'objets à revérifier'));
  else if (state.kitItems.length > 0) ok.push('Kit à jour');
  return { ok, toCheck, blocking };
}
