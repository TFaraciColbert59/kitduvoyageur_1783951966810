/**
 * Domaine pur « dressage instantané d'activité » (Task 3).
 *
 * Produit le socle déterministe matérialisé à la création d'une activité depuis
 * un sentier (`trip_steps` / `trip_pois` / `trip_expenses`) avant l'enrichissement
 * LLM. Aucune I/O, aucune valeur inventée : toute donnée absente reste `null` et
 * chaque brouillon porte `metadata.source = 'deterministic'`.
 */
import type { TrailInput, TrailMetaInput, TrailPoint } from './trailToActivity';
import {
  buildBudgetLines,
  type PreparationLayers,
} from '../engine/autogenPreparation';

export interface StepDraft {
  dayNumber: number;
  orderIndex: number;
  title: string;
  description: string;
  startTime: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  accommodationName: string | null;
  transportMode: string | null;
  metadata: Record<string, unknown>;
  source: 'deterministic';
}

export interface PoiDraft {
  name: string;
  latitude: number;
  longitude: number;
  metadata: Record<string, unknown>;
  source: 'deterministic';
}

export interface ExpenseDraft {
  title: string;
  amountEur: number;
  category: string;
  metadata: Record<string, unknown>;
}

/** Vitesse de marche retenue pour Naismith simplifié (km/h). */
export const WALK_SPEED_KMH = 4.5;
/** Marche utile maximale par jour (h). */
export const HOURS_PER_DAY = 8;
export const MAX_DAYS = 14;
export const MIN_DAYS = 1;
/** Plafond du vivier de POI dressés. */
export const MAX_POIS = 20;
/** Heures de départ alignées sur `trip_steps.start_time TIME` ('HH:MM'). */
export const FIRST_DAY_START_TIME = '08:30';
export const NEXT_DAY_START_TIME = '08:00';

function isPresentNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isPresentNumber(value) && value > 0;
}

/**
 * Découpage Naismith simplifié (D+ supposé nul ici) : durée de marche
 * `durationHours` si fournie (> 0), sinon `totalKm / 4.5` (≈ 4,5 km/h).
 * Chaque jour doit rester sous 8 h d'effort ; le compteur est
 * `floor(hours / 8) + 1` (jour 1 inclus, chaque bloc plein de 8 h ouvre le
 * jour suivant), borne basse 1, haute 14 — durée nulle/absente → 1.
 * Exemples épinglés par les tests : 7,9 h → 1 ; 8 h → 2 ; 16 h → 3 ;
 * 12 km / 4 h → 1 ; 45 km / 16 h → 3 ; null/null → 1 ; cap 14.
 */
export function splitDays(totalKm: number | null, durationHours: number | null): number {
  const km = isPositiveNumber(totalKm) ? totalKm : null;
  const duration = isPositiveNumber(durationHours) ? durationHours : null;
  const hours = duration ?? (km != null ? km / WALK_SPEED_KMH : null);
  if (hours == null) return MIN_DAYS;
  return Math.max(MIN_DAYS, Math.min(MAX_DAYS, Math.floor(hours / HOURS_PER_DAY) + 1));
}

/** Répartit un total entier au plus près : reliquat sur les premiers jours. */
function splitEvenly(total: number, days: number): number[] {
  const base = Math.floor(total / days);
  const remainder = total - base * days;
  return Array.from({ length: days }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Distance par jour (km, 2 décimales, somme exacte) ou `null` si absente. */
function distributeKm(totalKm: number | null, days: number): (number | null)[] {
  if (!isPresentNumber(totalKm)) return Array.from({ length: days }, () => null);
  const cents = Math.round(totalKm * 100);
  return splitEvenly(cents, days).map((value) => value / 100);
}

/** Dénivelé par jour (m) ou `null` si absent. */
function distributeMeters(totalMeters: number | null, days: number): (number | null)[] {
  if (!isPresentNumber(totalMeters)) return Array.from({ length: days }, () => null);
  return splitEvenly(Math.round(totalMeters), days);
}

/** Point de départ du jour : fraction `(jour - 1) / jours` de la polyligne réelle. */
function startPointForDay(
  polyline: TrailPoint[],
  dayNumber: number,
  days: number
): TrailPoint | null {
  if (polyline.length === 0) return null;
  if (polyline.length === 1 || days <= 1) return polyline[0];
  const index = Math.round(((dayNumber - 1) / days) * (polyline.length - 1));
  return polyline[Math.min(polyline.length - 1, Math.max(0, index))];
}

function formatKm(km: number): string {
  return String(km).replace('.', ',');
}

function buildStepDescription(
  dayNumber: number,
  days: number,
  trailName: string,
  distanceKm: number | null,
  elevationGainM: number | null
): string {
  const parts = [`Étape ${dayNumber}/${days} du sentier « ${trailName} »`];
  if (distanceKm != null) parts.push(`environ ${formatKm(distanceKm)} km estimés`);
  if (elevationGainM != null) parts.push(`+${elevationGainM} m de dénivelé positif estimés`);
  return `${parts.join(' — ')}.`;
}

/**
 * Étapes du roadbook déterministe : une par jour, J1 = nom du sentier, départ
 * `08:30` puis `08:00`. Distance et D+ réels répartis sans invention ; la
 * position de départ de chaque jour suit la polyligne réellement fournie.
 */
export function buildDeterministicSteps(
  trail: TrailInput,
  meta: TrailMetaInput | null,
  polyline: TrailPoint[]
): StepDraft[] {
  const trailName = trail.name.trim() !== '' ? trail.name.trim() : 'Sentier';
  const days = splitDays(trail.distanceKm ?? null, meta?.durationHours ?? null);
  const distances = distributeKm(trail.distanceKm ?? null, days);
  const elevations = distributeMeters(meta?.elevationGain ?? null, days);

  return Array.from({ length: days }, (_, index) => {
    const dayNumber = index + 1;
    const distanceKm = distances[index];
    const elevationGainM = elevations[index];
    const point = startPointForDay(polyline, dayNumber, days);

    return {
      dayNumber,
      orderIndex: 0,
      title: dayNumber === 1 ? trailName : `Étape ${dayNumber} — ${trailName}`,
      description: buildStepDescription(dayNumber, days, trailName, distanceKm, elevationGainM),
      startTime: dayNumber === 1 ? FIRST_DAY_START_TIME : NEXT_DAY_START_TIME,
      latitude: point ? point.lat : null,
      longitude: point ? point.lng : null,
      distanceKm,
      elevationGainM,
      accommodationName: null,
      transportMode: null,
      metadata: { source: 'deterministic' },
      source: 'deterministic',
    };
  });
}

/** Clé de déduplication : casse, accents, ponctuation et espaces normalisés. */
function normalizePoiName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * POI réels du sentier (déjà filtrés ≤ 750 m par l'appelant) : dédup par nom
 * normalisé (premier conservé), plafond 20, coordonnées telles que fournies.
 * Noms vides et coordonnées hors bornes sont ignorés — jamais inventés.
 */
export function buildDeterministicPois(
  pois: { id: number; name: string; category: string | null; lat: number; lng: number }[]
): PoiDraft[] {
  const drafts: PoiDraft[] = [];
  const seen = new Set<string>();

  for (const poi of pois) {
    const name = typeof poi.name === 'string' ? poi.name.trim() : '';
    if (name === '') continue;
    if (!isPresentNumber(poi.lat) || !isPresentNumber(poi.lng)) continue;
    if (poi.lat < -90 || poi.lat > 90 || poi.lng < -180 || poi.lng > 180) continue;

    const key = normalizePoiName(name);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);

    const category =
      typeof poi.category === 'string' && poi.category.trim() !== '' ? poi.category.trim() : null;

    drafts.push({
      name,
      latitude: poi.lat,
      longitude: poi.lng,
      metadata: { source: 'deterministic', category },
      source: 'deterministic',
    });
    if (drafts.length >= MAX_POIS) break;
  }

  return drafts;
}

/** Tag de provenance des montants (formule réelle, versionnée). */
export const BUDGET_FORMULA_TAG = 'autogenPreparation.buildBudgetLines@v1';

/**
 * Lignes prévisionnelles catégorisées du dressage : la couche budget réelle
 * AutoGen fournit le total (`buildBudgetLines`), réparti en N catégories
 * (hébergement/nourriture/transport/activités/matériel/divers), chacune > 0,
 * somme exacte au centime. Sans couche budget ou sans montant réel, aucune
 * ligne n'est créée : jamais de `null` (colonne `trip_expenses.amount NOT NULL
 * CHECK (amount > 0)`).
 */
export function buildDeterministicExpenses(
  trail: TrailInput,
  meta: TrailMetaInput | null,
  partySize = 1,
  layers: PreparationLayers | null = null
): ExpenseDraft[] {
  if (!layers) return [];
  const safePartySize = Math.max(
    1,
    Math.min(50, Math.trunc(isPresentNumber(partySize) ? partySize : 1))
  );
  const days = splitDays(trail.distanceKm ?? null, meta?.durationHours ?? null);

  const warnings: string[] = [];
  const formulaLines = buildBudgetLines(layers, safePartySize, days, warnings);
  if (formulaLines.length === 0) return [];

  return formulaLines.map((line) => ({
    title: line.title,
    amountEur: line.amountEur,
    category: line.category,
    metadata: {
      source: 'deterministic',
      formula: BUDGET_FORMULA_TAG,
      partySize: safePartySize,
    },
  }));
}
