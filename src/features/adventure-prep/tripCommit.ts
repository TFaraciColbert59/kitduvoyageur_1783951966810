/**
 * Traduit le brouillon du prepareur en lignes reelles `trips` / `trip_steps`.
 *
 * Module PUR : aucun import Supabase, aucun fetch. Il ne fait que le calcul,
 * ce qui le rend testable sans base et sans reseau. La route serveur
 * `POST /api/adventure/commit` appelle `buildTripCommit` puis ecrit le resultat.
 *
 * Regle non negociable : une valeur inconnue reste `null`. Aucun prix, aucune
 * distance, aucune coordonnee, aucune date de fin n est deduite d'un defaut.
 * Une distance n'est reportee que si le routage l'a REELLEMENT mesuree.
 */

import type {
  ActivitySelection,
  BudgetLevel,
  CalendarBlock,
  GroupBlock,
  ItineraryModel,
  ItineraryStep,
  Pace,
  PreferencesBlock,
  RouteBlock,
  TransportPreference,
} from './types';
import { activityById } from './catalog';

/**
 * Sous-ensemble du brouillon necessaire a la persistance.
 *
 * Le commit ne lit ni l'equipement, ni la generation, ni la progression : les
 * accepter rendrait la signature trompeuse et la route obligede d'envoyer tout
 * l'etat du client alors qu'elle n'en utilise qu'un tiers.
 */
export interface CommitDraft {
  activities: ActivitySelection;
  brief: string | null;
  coverName: string | null;
  route: RouteBlock;
  calendar: CalendarBlock;
  group: GroupBlock;
  preferences: PreferencesBlock;
  itinerary: ItineraryModel | null;
}

/** Ligne `trips` prete a inserer. Colonnes alignees sur le schema SQL. */
export interface TripRow {
  slug: string;
  title: string;
  description: string | null;
  destination_country_code: string | null;
  destination_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'draft' | 'planned' | 'active' | 'completed' | 'cancelled';
  visibility: 'private' | 'unlisted' | 'public';
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  primary_activity: 'hiking' | 'trekking' | 'bivouac' | 'roadtrip' | 'cultural' | 'bushcraft' | 'mixed';
  estimated_budget: number | null;
  budget_currency: 'EUR';
  metadata: Record<string, unknown>;
}

/** Ligne `trip_steps` prete a inserer. */
export interface TripStepRow {
  day_number: number;
  order_index: number;
  title: string;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  accommodation_name: string | null;
  transport_mode: 'foot' | 'car' | 'bus' | 'train' | 'plane' | 'boat' | 'bike' | 'other' | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  start_time: string | null;
}

export interface TripCommit {
  trip: TripRow;
  steps: TripStepRow[];
}

/** Contrainte SQL : `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`, longueur 3..120. */
function slugify(source: string): string {
  const base = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return base.length >= 3 ? base : `aventure-${source.length}-lkdv`.slice(0, 120);
}

function addDays(iso: string, days: number): string | null {
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

const ACTIVITY_TO_TRIP: Readonly<Record<string, TripRow['primary_activity']>> = {
  rando: 'hiking',
  'rando-refuge': 'trekking',
  trek: 'trekking',
  bivouac: 'bivouac',
  roadtrip: 'roadtrip',
  voyage: 'cultural',
  sejour: 'cultural',
};

function tripActivity(draft: CommitDraft): TripRow['primary_activity'] {
  const id = draft.activities.primary;
  if (!id) return 'hiking';
  if (ACTIVITY_TO_TRIP[id]) return ACTIVITY_TO_TRIP[id];
  const category = activityById(id)?.category;
  if (category === 'voyage_sejour') return 'cultural';
  if (category === 'neige_montagne') return 'trekking';
  return 'hiking';
}

/**
 * Titre unique du voyage. Exporte parce que le hub l'affiche tel quel :
 * un deuxieme calcul de titre donnerait deux libelles pour la meme ligne.
 */
export function tripTitle(draft: CommitDraft): string {
  const named = draft.coverName?.trim();
  if (named) return named.slice(0, 120);
  const origin = draft.route.origin?.name;
  const destination = draft.route.destination?.name;
  if (origin && destination) return `${origin} → ${destination}`.slice(0, 120);
  if (origin) return `${origin} et ses environs`.slice(0, 120);
  const activity = activityById(draft.activities.primary);
  return (activity?.label ?? 'Mon aventure').slice(0, 120);
}

function stepDescription(step: ItineraryStep): string | null {
  const parts = [step.reason, step.state === 'propose' ? 'Proposé' : null].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(' — ') : null;
}

const KIND_TO_TRANSPORT: Readonly<Record<ItineraryStep['kind'], TripStepRow['transport_mode']>> = {
  trajet: 'other',
  arret: null,
  repos: null,
  nuit: null,
  ravitaillement: null,
};

function firstStepOfDay(model: ItineraryModel, day: number): ItineraryStep | undefined {
  return model.steps.find((step) => step.day === day && step.order === 0);
}

export function buildTripCommit(draft: CommitDraft): TripCommit {
  const model = draft.itinerary;
  const origin = draft.route.origin;
  const startDate = draft.calendar.startDate;
  const duration = draft.calendar.durationDays;
  const endDate =
    startDate && typeof duration === 'number' && Number.isFinite(duration) && duration >= 1
      ? addDays(startDate, Math.trunc(duration) - 1)
      : draft.calendar.returnDate;

  const title = tripTitle(draft);

  const trip: TripRow = {
    slug: slugify(title),
    title,
    description: draft.brief?.trim() ? draft.brief.trim().slice(0, 2000) : null,
    destination_country_code: null,
    destination_name: origin?.name ?? null,
    start_date: startDate,
    end_date: endDate ?? null,
    status: 'planned',
    visibility: 'private',
    difficulty: 'moderate',
    primary_activity: tripActivity(draft),
    estimated_budget:
      draft.preferences.budgetPerPerson !== null &&
      Number.isFinite(draft.preferences.budgetPerPerson)
        ? draft.preferences.budgetPerPerson
        : null,
    budget_currency: 'EUR',
    metadata: {
      prep: {
        days: model?.days ?? null,
        steps: model?.steps.length ?? 0,
        distanceKm: model?.totals.distanceKm ?? null,
        adults: draft.group.adults,
        children: draft.group.children,
        pace: draft.preferences.pace,
        transport: draft.preferences.transport,
        budgetLevel: draft.preferences.budgetLevel,
      },
    },
  };

  const steps: TripStepRow[] = (model?.steps ?? []).map((step) => {
    const dayTotals = model?.perDay[step.day - 1];
    const carriesDay = firstStepOfDay(model as ItineraryModel, step.day) === step;
    return {
      day_number: step.day,
      order_index: step.order,
      title: step.title,
      description: stepDescription(step),
      location_name: step.placeName,
      latitude: step.lat,
      longitude: step.lon,
      accommodation_name: step.kind === 'nuit' ? step.placeName : null,
      transport_mode: KIND_TO_TRANSPORT[step.kind],
      distance_km: carriesDay ? (dayTotals?.distanceKm ?? null) : null,
      elevation_gain_m: carriesDay ? (dayTotals?.elevGainM ?? null) : null,
      elevation_loss_m: carriesDay ? (dayTotals?.elevLossM ?? null) : null,
      start_time: step.startTime,
    };
  });

  return { trip, steps };
}
