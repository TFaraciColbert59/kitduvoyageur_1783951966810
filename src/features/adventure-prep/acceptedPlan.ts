/**
 * Contrat `acceptedPlan` v1 — le plan tel que l'utilisateur l'a valide.
 *
 * Un seul schema, partage par le client (relecture) et le serveur (ecriture) :
 * ce que la route accepte est exactement ce que l'ecran sait reprendre. Le
 * schema est STRICT a tous les niveaux : une donnee inconnue est refusee, pas
 * silencieusement conservee, et une valeur relue ne peut pas casser l'ecran.
 *
 * Module PUR : aucun fetch, aucun store. Le contenu reste une DONNEE
 * utilisateur, jamais une consigne pour un moteur ou une IA.
 */

import { z } from 'zod';
import { metricsContextFor } from './catalog';
import { emptyDraft } from './engine/emptyDraft';
import { buildGearNeeds } from './engine/gear';
import { finishGeneration, initialGeneration } from './engine/generation';
import { buildContingencies } from './engine/resilience';
import type {
  AdventurePrepDraft,
  GearNeed,
  ItineraryModel,
  ItineraryStep,
  PrepStepId,
} from './types';

/** Version du contrat : changee uniquement avec une migration de relecture. */
export const ACCEPTED_PLAN_SCHEMA_VERSION = 1;

/** Taille maximale serialisee (un mois detaille tient largement dedans). */
export const MAX_ACCEPTED_PLAN_BYTES = 256_000;

/** Bornes de contenu : un voyage d'un an reste representable, pas au-dela. */
export const MAX_PLAN_DAYS = 366;
export const MAX_PLAN_STEPS = 1500;
export const MAX_PLAN_GEAR = 300;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date ISO YYYY-MM-DD attendue');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'heure HH:MM attendue');
const label = (max: number) => z.string().max(max);
const bookingState = z.enum(['propose', 'a_reserver', 'confirme', 'confirme_communaute']);

const moneySchema = z
  .object({
    amount: z.number().finite().min(0).max(1_000_000).nullable(),
    currency: z.literal('EUR'),
    state: bookingState,
  })
  .strict();

const placeSchema = z
  .object({
    id: label(200),
    name: label(200),
    country: label(120),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  })
  .strict();

const stepSchema = z
  .object({
    id: label(120),
    day: z.number().int().min(1).max(MAX_PLAN_DAYS),
    order: z.number().int().min(0).max(MAX_PLAN_STEPS),
    kind: z.enum(['trajet', 'arret', 'repos', 'nuit', 'ravitaillement']),
    title: label(300),
    placeName: label(300).nullable(),
    startTime: clock.nullable(),
    durationMin: z.number().int().min(0).max(60 * 24 * 7).nullable(),
    reason: label(500).nullable(),
    price: moneySchema,
    state: bookingState,
    kept: z.boolean(),
    icon: label(60),
    lat: z.number().min(-90).max(90).nullable(),
    lon: z.number().min(-180).max(180).nullable(),
    mealSlot: z.enum(['petit_dejeuner', 'dejeuner', 'diner']).nullable().optional(),
    priceBreakdown: z
      .object({
        unitLabel: label(60).nullable(),
        perUnit: moneySchema,
        perPerson: moneySchema,
        groupTotal: moneySchema,
        isEstimate: z.boolean(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

const gearSchema = z
  .object({
    id: label(120),
    name: label(200),
    category: z.enum(['shelter', 'sleep', 'cook', 'clothing', 'water', 'safety', 'navigation', 'misc']),
    quantity: z.number().int().min(0).max(999),
    vital: z.boolean(),
    ownerId: label(120).nullable(),
    weightGrams: z.number().int().min(0).max(100_000).nullable(),
    packed: z.boolean(),
  })
  .strict();

export const acceptedPlanSchema = z
  .object({
    schemaVersion: z.literal(ACCEPTED_PLAN_SCHEMA_VERSION),
    draftVersion: z.number().int().min(0),
    coverName: label(200).nullable(),
    activities: z
      .object({
        primary: label(80).nullable(),
        extra: z.array(label(80)).max(20),
        nights: z.array(label(80)).max(20),
      })
      .strict(),
    route: z
      .object({
        origin: placeSchema.nullable(),
        destination: placeSchema.nullable(),
        shape: z.enum(['boucle', 'aller_simple']),
      })
      .strict(),
    calendar: z
      .object({
        startDate: isoDate.nullable(),
        durationDays: z.number().int().min(1).max(MAX_PLAN_DAYS).nullable(),
        durationIsSuggested: z.boolean(),
        returnDate: isoDate.nullable(),
      })
      .strict(),
    group: z
      .object({
        mode: z.enum(['solo', 'groupe']),
        adults: z.number().int().min(0).max(50),
        children: z.number().int().min(0).max(50),
        hasPets: z.boolean(),
        knownMembers: z.array(label(120)).max(50),
      })
      .strict(),
    preferences: z
      .object({
        budgetPerPerson: z.number().finite().min(0).max(1_000_000).nullable(),
        budgetLevel: z.enum(['economique', 'modere', 'confort']),
        pace: z.enum(['tranquille', 'normal', 'rapide']),
        transport: z.enum(['peigne', 'train', 'voiture', 'avion', 'mixte']),
        interests: z.array(label(80)).max(40),
        accessibilityNeeds: z.array(label(120)).max(20),
      })
      .strict(),
    itinerary: z
      .object({
        days: z.number().int().min(1).max(MAX_PLAN_DAYS),
        steps: z.array(stepSchema).max(MAX_PLAN_STEPS),
      })
      .strict()
      .nullable(),
    gear: z.array(gearSchema).max(MAX_PLAN_GEAR),
  })
  .strict()
  .refine((plan) => JSON.stringify(plan).length <= MAX_ACCEPTED_PLAN_BYTES, {
    message: `acceptedPlan depasse ${MAX_ACCEPTED_PLAN_BYTES} octets`,
  });

/**
 * Forme du plan accepte, exprimee avec les types du domaine (tableaux en
 * lecture seule). `parseAcceptedPlan` affecte la sortie zod a ce type : si le
 * schema et le domaine divergent, la compilation echoue.
 */
export interface AcceptedPrepPlan {
  schemaVersion: typeof ACCEPTED_PLAN_SCHEMA_VERSION;
  draftVersion: number;
  coverName: string | null;
  activities: AdventurePrepDraft['activities'];
  route: AdventurePrepDraft['route'];
  calendar: AdventurePrepDraft['calendar'];
  group: AdventurePrepDraft['group'];
  preferences: AdventurePrepDraft['preferences'];
  itinerary: { days: number; steps: readonly ItineraryStep[] } | null;
  gear: ReadonlyArray<Omit<GearNeed, 'requiredFor'>>;
}

/** Relecture tolerante a l'echec : un snapshot non conforme vaut `null`. */
export function parseAcceptedPlan(value: unknown): AcceptedPrepPlan | null {
  const parsed = acceptedPlanSchema.safeParse(value);
  if (!parsed.success) return null;
  const plan: AcceptedPrepPlan = parsed.data;
  return plan;
}

const EMPTY_TOTALS = { distanceKm: null, movingMin: null, elevGainM: null, elevLossM: null };

function itineraryFrom(
  plan: AcceptedPrepPlan,
  draft: AdventurePrepDraft,
): ItineraryModel | null {
  if (!plan.itinerary) return null;
  const days = plan.itinerary.days;
  const model: ItineraryModel = {
    days,
    steps: plan.itinerary.steps,
    // Les moteurs du preparateur ne mesurent pas encore distance ni denivele :
    // les totaux restent inconnus, exactement comme a la construction.
    totals: { ...EMPTY_TOTALS },
    perDay: Array.from({ length: days }, () => ({ ...EMPTY_TOTALS })),
    metricsContext: metricsContextFor(draft.activities),
    budgetPerPerson:
      draft.preferences.budgetPerPerson === null
        ? { amount: null, currency: 'EUR', state: 'a_reserver' }
        : { amount: draft.preferences.budgetPerPerson, currency: 'EUR', state: 'propose' },
    activityCount: 1 + draft.activities.extra.length,
    contingencies: [],
  };
  return { ...model, contingencies: buildContingencies(model) };
}

/**
 * Reconstruit un brouillon editable depuis un plan enregistre.
 *
 * Invariant (teste) : `buildAcceptedPlan(draftFromAcceptedPlan(p))` redonne
 * `p` a l'identique, hors `draftVersion`. Rien n'est complete ni devine : ce qui
 * n'a pas ete enregistre reprend la valeur d'un brouillon vide.
 */
export function draftFromAcceptedPlan(plan: AcceptedPrepPlan): AdventurePrepDraft {
  const base: AdventurePrepDraft = {
    ...emptyDraft(),
    version: plan.draftVersion,
    coverName: plan.coverName,
    activities: plan.activities,
    route: plan.route,
    calendar: plan.calendar,
    group: plan.group,
    preferences: plan.preferences,
  };

  const needs = new Map(buildGearNeeds(base).map((need) => [need.id, need]));
  const gear: GearNeed[] = plan.gear.map((item) => ({
    ...item,
    requiredFor: needs.get(item.id)?.requiredFor ?? [],
  }));
  const itinerary = itineraryFrom(plan, base);
  const completedSteps: PrepStepId[] = itinerary ? ['destination', 'itinerary'] : ['destination'];

  return {
    ...base,
    gear,
    packedGearIds: plan.gear.filter((item) => item.packed).map((item) => item.id),
    itinerary,
    generation: itinerary ? finishGeneration(initialGeneration()) : initialGeneration(),
    currentStep: itinerary ? 'departure' : 'itinerary',
    completedSteps,
    updatedAt: null,
  };
}
