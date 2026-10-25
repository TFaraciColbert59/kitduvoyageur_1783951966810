import {
  recalculateDayMetrics,
  reorderStepList,
  type PlannerStep,
} from '@/features/trips/planner/plannerEngine';
import { addCivilDays, formatCivilDayIndex, getCivilDurationDays } from '@/lib/dates/tripDates';
import { poiCategoryMeta } from './mobileHubEngine';

/**
 * Moteur mobile Itinéraire (sortie) — pur, testable sans DOM.
 * Totaux du voyage, tracé carte, résumés par jour et réordonnancement
 * STRICTEMENT limité au jour (correctif du bug legacy jour-agnostique).
 */

export interface ItineraryTotals {
  distanceKm: number;
  elevGainM: number;
  elevLossM: number;
  stepsCount: number;
  geoCount: number;
}

function sortByDayAndOrder(steps: PlannerStep[]): PlannerStep[] {
  return [...steps].sort(
    (a, b) => a.day_number - b.day_number || a.order_index - b.order_index
  );
}

/** Totaux du voyage : somme des métriques jour par jour (jamais de pont entre jours). */
export function tripItineraryTotals(steps: PlannerStep[]): ItineraryTotals {
  const byDay = new Map<number, PlannerStep[]>();
  for (const step of steps) {
    const list = byDay.get(step.day_number) ?? [];
    list.push(step);
    byDay.set(step.day_number, list);
  }

  let distanceKm = 0;
  let elevGainM = 0;
  let elevLossM = 0;
  for (const daySteps of byDay.values()) {
    const metrics = recalculateDayMetrics(daySteps);
    distanceKm += metrics.totalDistanceKm;
    elevGainM += metrics.totalElevationGainM;
    elevLossM += metrics.totalElevationLossM;
  }

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    elevGainM,
    elevLossM,
    stepsCount: steps.length,
    geoCount: steps.filter((step) => step.latitude != null && step.longitude != null).length,
  };
}

/** Tracé [lat, lon] trié jour puis index, sans points manquants ni doublons consécutifs. */
export function buildRouteCoords(steps: PlannerStep[]): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  for (const step of sortByDayAndOrder(steps)) {
    if (step.latitude == null || step.longitude == null) continue;
    const point: [number, number] = [Number(step.latitude), Number(step.longitude)];
    const last = coords[coords.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    coords.push(point);
  }
  return coords;
}

/** Nombre de jours = max(dernier jour d'étape, durée civile, 1). */
export function resolveDaysCount(
  steps: PlannerStep[],
  startDate?: string | null,
  endDate?: string | null
): number {
  const maxDayFromSteps = steps.reduce((max, step) => Math.max(max, step.day_number), 1);
  let durationDays = 1;
  if (startDate && endDate) {
    const civil = getCivilDurationDays(startDate, endDate);
    if (civil > 0) durationDays = civil;
  }
  return Math.max(maxDayFromSteps, durationDays, 1);
}

export interface DaySummary {
  day: number;
  dateLabel: string | null;
  stepsCount: number;
  distanceKm: number;
  elevGainM: number;
  elevLossM: number;
}

/** Résumés par jour (1..daysCount) avec date courte, étapes et métriques. */
export function buildDaySummaries(
  steps: PlannerStep[],
  startDate: string | null | undefined,
  daysCount: number
): DaySummary[] {
  const byDay = new Map<number, PlannerStep[]>();
  for (const step of steps) {
    const list = byDay.get(step.day_number) ?? [];
    list.push(step);
    byDay.set(step.day_number, list);
  }

  const summaries: DaySummary[] = [];
  for (let day = 1; day <= Math.max(1, daysCount); day++) {
    const daySteps = byDay.get(day) ?? [];
    const metrics = recalculateDayMetrics(daySteps);
    summaries.push({
      day,
      dateLabel: formatCivilDayIndex(startDate, day, { weekday: 'short' }),
      stepsCount: metrics.stepsCount,
      distanceKm: metrics.totalDistanceKm,
      elevGainM: metrics.totalElevationGainM,
      elevLossM: metrics.totalElevationLossM,
    });
  }
  return summaries;
}

/**
 * Réordonne une étape d'un cran DANS SON JOUR uniquement.
 * Les autres jours ne sont jamais renumérotés (contrairement à reorderStepList).
 */
export function moveStepWithinDay(
  steps: PlannerStep[],
  stepId: string,
  direction: 'up' | 'down'
): PlannerStep[] {
  const target = steps.find((step) => step.id === stepId);
  if (!target) return steps;

  const daySteps = steps
    .filter((step) => step.day_number === target.day_number)
    .sort((a, b) => a.order_index - b.order_index);
  const reordered = reorderStepList(daySteps, stepId, direction);
  const byId = new Map(reordered.map((step) => [step.id, step]));
  return steps.map((step) => byId.get(step.id) ?? step);
}

const TRANSPORT_LABELS: Record<string, string> = {
  foot: 'À pied',
  walking: 'À pied',
  hiking: 'Rando',
  plane: 'Vol',
  flight: 'Vol',
  train: 'Train',
  car: 'Voiture',
  bus: 'Bus',
  boat: 'Bateau',
  bike: 'Vélo',
  other: 'Autre',
};

export function transportLabel(mode: string | null | undefined): string {
  if (!mode) return 'Autre';
  return TRANSPORT_LABELS[mode] ?? 'Autre';
}

/** Durée compacte : « 45 min », « 2h », « 2h30 ». */
export function formatDurationShort(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h${rest.toString().padStart(2, '0')}` : `${hours}h`;
}

/* ─────────────── Roadbook : horaires & timeline ─────────────── */

/** Normalise une heure SQL ('HH:MM:SS') en 'HH:MM' ; null si invalide. */
export function formatStepTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${match[1]}:${match[2]}`;
}

export interface TimelineStepLike {
  start_time?: string | null;
  order_index: number;
}

/**
 * Timeline du jour : étapes horodatées d'abord (heure croissante), puis les
 * étapes sans heure dans l'ordre du planificateur.
 */
export function sortDayTimeline<T extends TimelineStepLike>(steps: T[]): T[] {
  const timed = steps
    .filter((step) => !!formatStepTime(step.start_time))
    .sort((a, b) => {
      const left = formatStepTime(a.start_time) as string;
      const right = formatStepTime(b.start_time) as string;
      return left.localeCompare(right) || a.order_index - b.order_index;
    });
  const untimed = steps
    .filter((step) => !formatStepTime(step.start_time))
    .sort((a, b) => a.order_index - b.order_index);
  return [...timed, ...untimed];
}

/* ─────────────── Dépenses du jour ─────────────── */

export interface ItineraryExpenseLike {
  id: string;
  title?: string | null;
  amount: number;
  expense_date?: string | null;
  is_planned?: boolean | null;
}

export interface DayExpensesView<T extends ItineraryExpenseLike = ItineraryExpenseLike> {
  rows: T[];
  count: number;
  real: number;
  planned: number;
  total: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Dépenses dont la date civile correspond au jour du roadbook. */
export function dayExpenses<T extends ItineraryExpenseLike>(
  expenses: T[],
  startDate: string | null | undefined,
  day: number
): DayExpensesView<T> {
  const empty: DayExpensesView<T> = { rows: [], count: 0, real: 0, planned: 0, total: 0 };
  if (!startDate) return empty;
  const iso = addCivilDays(startDate, day - 1);
  const rows = expenses.filter((expense) => expense.expense_date === iso);
  const real = rows.reduce(
    (sum, expense) => sum + (expense.is_planned ? 0 : Number(expense.amount) || 0),
    0
  );
  const planned = rows.reduce(
    (sum, expense) => sum + (expense.is_planned ? Number(expense.amount) || 0 : 0),
    0
  );
  return {
    rows,
    count: rows.length,
    real: round1(real),
    planned: round1(planned),
    total: round1(real + planned),
  };
}

/* ─────────────── Matériel du jour ─────────────── */

export function itemsForDay<T extends { day_number?: number | null }>(items: T[], day: number): T[] {
  return items.filter((item) => item.day_number === day);
}

/* ─────────────── Points d'intérêt ─────────────── */

export interface ItineraryPoiLike {
  id: string;
  name: string;
  category?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  step_id?: string | null;
}

export function poisForDay<T extends ItineraryPoiLike>(pois: T[], dayStepIds: Set<string>): T[] {
  return pois.filter((poi) => !!poi.step_id && dayStepIds.has(poi.step_id));
}

export function unassignedPois<T extends ItineraryPoiLike>(pois: T[]): T[] {
  return pois.filter((poi) => !poi.step_id);
}

export interface PoiMapPoint {
  lat: number;
  lon: number;
  label: string;
  color: string;
}

/** Points carte des POI géolocalisés (couleur par catégorie, texte noir lisible). */
export function poiMapPoints(pois: ItineraryPoiLike[]): PoiMapPoint[] {
  return pois
    .filter((poi) => poi.latitude != null && poi.longitude != null)
    .map((poi) => ({
      lat: Number(poi.latitude),
      lon: Number(poi.longitude),
      label: poi.name,
      color: poiCategoryMeta(poi.category, poi.name).color,
    }));
}
