import type { TripFull, TripPoi, TripStep } from '@/features/trips/types/trip.types';

/**
 * Préparateur de voyage — modèle PUR.
 *
 * Source unique de vérité de l'écran /preparer : à partir du seul TripFull
 * (étapes + POI) il dérive tout ce que la carte affiche et ce que les onglets
 * listent : nuitées, transports, repas, POI, compteurs et score de préparation.
 *
 * Règles :
 * - Zéro accès réseau, zéro horloge, zéro import React (testable, déterministe).
 * - Rien n'est inventé : un champ absent reste absent.
 * - Les coordonnées sont filtrées (lat/lon réellement exploitables).
 */

export type PreparatorMarkerKind = 'poi' | 'stay' | 'transport' | 'step';

export interface PreparatorMarker {
  id: string;
  kind: PreparatorMarkerKind;
  label: string;
  detail: string | null;
  /** Catégorie normalisée pour la carte (unifiée, toutes activités). */
  category: string;
  lat: number;
  lon: number;
  dayNumber: number | null;
  visited: boolean;
}

export interface PreparatorStay {
  id: string;
  dayNumber: number;
  name: string;
  locationName: string | null;
  lat: number | null;
  lon: number | null;
}

export interface PreparatorTransport {
  id: string;
  dayNumber: number;
  mode: string;
  label: string;
  locationName: string | null;
  lat: number | null;
  lon: number | null;
}

export interface PreparatorMeal {
  id: string;
  name: string;
  category: string;
  dayNumber: number | null;
  lat: number | null;
  lon: number | null;
  notes: string | null;
}

export interface PreparatorCounters {
  days: number;
  steps: number;
  stays: number;
  transports: number;
  pois: number;
  meals: number;
  distanceKm: number;
  elevationGainM: number;
}

export interface PreparatorReadiness {
  /** 0 à 100 : moyenne des 5 domaines (route, nuitées, transport, repas, POI). */
  score: number;
  route: boolean;
  stays: boolean;
  transports: boolean;
  food: boolean;
  pois: boolean;
}

export interface PreparatorModel {
  tripId: string;
  slug: string;
  title: string;
  destination: string;
  markers: PreparatorMarker[];
  stays: PreparatorStay[];
  transports: PreparatorTransport[];
  meals: PreparatorMeal[];
  pois: TripPoi[];
  steps: TripStep[];
  counters: PreparatorCounters;
  readiness: PreparatorReadiness;
}

export interface PreparatorInput {
  trip: TripFull;
  /** Le voyage porte-t-il une géométrie GeoJSON réelle (parcours hiking) ? */
  hasRouteGeometry?: boolean;
}

/** Libellés humanisés par mode de transport (foot = le tracé lui-même). */
const TRANSPORT_LABELS: Record<string, string> = {
  foot: 'Marche',
  car: 'Voiture',
  bus: 'Bus',
  train: 'Train',
  plane: 'Avion',
  boat: 'Bateau',
  bike: 'Vélo',
  other: 'Transport',
};

/** Catégories de POI « repas » (table trip_pois, vocabulaire libre). */
const FOOD_TOKENS = ['food', 'restaurant', 'resto', 'table', 'repas', 'diner', 'brasserie', 'cafe'];

/** Catégories de POI « hébergement » (en plus des nuits portées par les étapes). */
const STAY_TOKENS = ['refuge', 'gite', 'camp', 'camping', 'hotel', 'hut', 'bivouac'];

function clean(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function coord(
  lat: number | string | null | undefined,
  lon: number | string | null | undefined
): { lat: number; lon: number } | null {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  if (la === 0 && lo === 0) return null;
  return { lat: la, lon: lo };
}

function hasToken(value: string | null | undefined, tokens: string[]): boolean {
  const haystack = clean(value).toLowerCase();
  if (!haystack) return false;
  return tokens.some((token) => haystack.includes(token));
}

/** Mode de transport lisible (jamais de code brut dans l'UI). */
export function transportLabel(mode: string | null | undefined): string | null {
  const key = clean(mode).toLowerCase();
  if (!key) return null;
  return TRANSPORT_LABELS[key] ?? TRANSPORT_LABELS.other;
}

/** Un mode de transport « à réserver » (tout sauf la marche). */
export function isReservableTransport(mode: string | null | undefined): boolean {
  const key = clean(mode).toLowerCase();
  return Boolean(key) && key !== 'foot';
}

export function isFoodPoi(poi: Pick<TripPoi, 'name' | 'category'>): boolean {
  return hasToken(poi.category, FOOD_TOKENS) || hasToken(poi.name, FOOD_TOKENS);
}

export function isStayPoi(poi: Pick<TripPoi, 'name' | 'category'>): boolean {
  return hasToken(poi.category, STAY_TOKENS) || hasToken(poi.name, STAY_TOKENS);
}

/** Nuitées : une par étape portant un accommodation_name. */
export function collectStays(steps: readonly TripStep[]): PreparatorStay[] {
  return steps
    .filter((step) => clean(step.accommodation_name))
    .map((step) => {
      const point = coord(step.latitude, step.longitude);
      return {
        id: step.id,
        dayNumber: Number(step.day_number) || 1,
        name: clean(step.accommodation_name),
        locationName: clean(step.location_name) || null,
        lat: point?.lat ?? null,
        lon: point?.lon ?? null,
      };
    })
    .sort((a, b) => a.dayNumber - b.dayNumber);
}

/** Transports réservables : une ligne par étape dont le mode n'est pas la marche. */
export function collectTransports(steps: readonly TripStep[]): PreparatorTransport[] {
  return steps
    .filter((step) => isReservableTransport(step.transport_mode))
    .map((step) => {
      const point = coord(step.latitude, step.longitude);
      const mode = clean(step.transport_mode).toLowerCase();
      return {
        id: step.id,
        dayNumber: Number(step.day_number) || 1,
        mode,
        label: transportLabel(mode) ?? 'Transport',
        locationName: clean(step.location_name) || null,
        lat: point?.lat ?? null,
        lon: point?.lon ?? null,
      };
    })
    .sort((a, b) => a.dayNumber - b.dayNumber);
}

/** Repas : POI de catégorie alimentaire, rattachés à leur étape. */
export function collectMeals(pois: readonly TripPoi[], steps: readonly TripStep[]): PreparatorMeal[] {
  return pois
    .filter(isFoodPoi)
    .map((poi) => {
      const point = coord(poi.latitude, poi.longitude);
      const step = steps.find((candidate) => candidate.id === poi.step_id) ?? null;
      return {
        id: poi.id,
        name: clean(poi.name),
        category: clean(poi.category) || 'food',
        dayNumber: step ? Number(step.day_number) || null : null,
        lat: point?.lat ?? null,
        lon: point?.lon ?? null,
        notes: clean(poi.notes) || null,
      };
    })
    .filter((meal) => meal.name.length > 0);
}

/**
 * Marqueurs carte : POI + nuitées + transports + étapes géolocalisées.
 * Dédupliqués par position (un même hébergement = une seule pastille).
 */
export function buildMarkers(trip: Pick<TripFull, 'steps' | 'pois'>): PreparatorMarker[] {
  const out: PreparatorMarker[] = [];
  const seen = new Set<string>();

  /**
   * Deux marqueurs ne sont le meme point que si ils partagent le meme
   * "emplacement" : un hebergement POI et la nuit de l'etape correspondent au
   * meme slot `stay`, donc une seule pastille. Un POI reste distinct d'un
   * deplacement ou d'une etape.
   */
  const slotOf = (marker: PreparatorMarker): PreparatorMarkerKind => {
    if (marker.kind === 'stay' || marker.category === 'stay') return 'stay';
    return marker.kind;
  };

  const push = (marker: PreparatorMarker) => {
    const dedupe =
      slotOf(marker) + ':' + marker.lat.toFixed(4) + ':' + marker.lon.toFixed(4);
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push(marker);
  };

  for (const poi of trip.pois ?? []) {
    const point = coord(poi.latitude, poi.longitude);
    if (!point) continue;
    const label = clean(poi.name);
    if (!label) continue;
    const food = isFoodPoi(poi);
    const stay = isStayPoi(poi);
    push({
      id: poi.id,
      kind: 'poi',
      label,
      detail: clean(poi.notes) || null,
      category: food ? 'food' : stay ? 'stay' : clean(poi.category) || 'poi',
      lat: point.lat,
      lon: point.lon,
      dayNumber: null,
      visited: Boolean(poi.visited),
    });
  }

  for (const step of trip.steps ?? []) {
    const point = coord(step.latitude, step.longitude);
    const day = Number(step.day_number) || null;
    const stayName = clean(step.accommodation_name);
    const transport = isReservableTransport(step.transport_mode);

    if (point && stayName) {
      push({
        id: 'stay-' + step.id,
        kind: 'stay',
        label: stayName,
        detail: 'Nuit J' + (day ?? '—'),
        category: 'stay',
        lat: point.lat,
        lon: point.lon,
        dayNumber: day,
        visited: false,
      });
    }

    if (point && transport) {
      push({
        id: 'transport-' + step.id,
        kind: 'transport',
        label: transportLabel(step.transport_mode) ?? 'Transport',
        detail: clean(step.title) || clean(step.location_name) || null,
        category: clean(step.transport_mode).toLowerCase() || 'transport',
        lat: point.lat,
        lon: point.lon,
        dayNumber: day,
        visited: false,
      });
    }

    if (point && !stayName && !transport) {
      push({
        id: 'step-' + step.id,
        kind: 'step',
        label: clean(step.title) || 'Étape J' + (day ?? '—'),
        detail: clean(step.location_name) || null,
        category: 'step',
        lat: point.lat,
        lon: point.lon,
        dayNumber: day,
        visited: false,
      });
    }
  }

  return out;
}

/** Trace de repli (points [lat, lon]) quand le voyage n'a pas de GeoJSON. */
export function routeCoordsFromSteps(steps: readonly TripStep[]): Array<[number, number]> {
  return (steps ?? [])
    .map((step) => coord(step.latitude, step.longitude))
    .filter((point): point is { lat: number; lon: number } => point !== null)
    .map((point) => [point.lat, point.lon] as [number, number]);
}

function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + (Number(value) || 0), 0);
}

/** Score de préparation : 5 domaines, jamais un pourcentage de vanité. */
export function computeReadiness(input: {
  hasRouteGeometry: boolean;
  stays: PreparatorStay[];
  transports: PreparatorTransport[];
  meals: PreparatorMeal[];
  pois: number;
}): PreparatorReadiness {
  const route = input.hasRouteGeometry;
  const stays = input.stays.length > 0;
  const transports = input.transports.length > 0;
  const food = input.meals.length > 0;
  const pois = input.pois > 0;
  const domains = [route, stays, transports, food, pois].filter(Boolean).length;
  return { score: domains * 20, route, stays, transports, food, pois };
}

/** Construit le modèle complet du préparateur à partir du voyage. */
export function buildPreparatorModel(input: PreparatorInput): PreparatorModel {
  const trip = input.trip;
  const steps = [...(trip.steps ?? [])].sort(
    (a, b) =>
      (Number(a.day_number) || 0) - (Number(b.day_number) || 0) ||
      (a.order_index ?? 0) - (b.order_index ?? 0)
  );
  const pois = trip.pois ?? [];
  const stays = collectStays(steps);
  const transports = collectTransports(steps);
  const meals = collectMeals(pois, steps);
  const markers = buildMarkers({ steps, pois });

  const days = steps.reduce<number>((max, step) => Math.max(max, Number(step.day_number) || 0), 0);

  return {
    tripId: trip.id,
    slug: trip.slug,
    title: clean(trip.title) || 'Voyage',
    destination: clean(trip.destination_name) || '',
    markers,
    stays,
    transports,
    meals,
    pois,
    steps,
    counters: {
      days,
      steps: steps.length,
      stays: stays.length,
      transports: transports.length,
      pois: pois.length,
      meals: meals.length,
      distanceKm: Math.round(sum(steps.map((step) => step.distance_km)) * 10) / 10,
      elevationGainM: Math.round(sum(steps.map((step) => step.elevation_gain_m))),
    },
    readiness: computeReadiness({
      hasRouteGeometry:
        Boolean(input.hasRouteGeometry) || routeCoordsFromSteps(steps).length >= 2,
      stays,
      transports,
      meals,
      pois: pois.length,
    }),
  };
}
