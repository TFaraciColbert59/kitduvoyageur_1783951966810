import { activityById, metricsContextFor } from '../catalog';
import {
  PRICE_TO_CHECK,
  type AdventurePrepDraft,
  type DayTotals,
  type ItineraryModel,
  type ItineraryStep,
  type ItineraryStepKind,
  type MealSlot,
  type MoneyValue,
  type RouteShape,
} from '../types';
import { hasEngineMinimum } from './steps';
import { proposedStops } from './proposedStops';
import { buildContingencies } from './resilience';
import { de } from './frenchText';

const ICONS: Record<ItineraryStepKind, string> = {
  trajet: 'navigation',
  arret: 'map',
  repos: 'clock',
  nuit: 'bed-double',
  ravitaillement: 'backpack',
};

const EMPTY_TOTALS: DayTotals = {
  distanceKm: null,
  movingMin: null,
  activityMin: null,
  elevGainM: null,
  elevLossM: null,
};

export interface StepDraft {
  title: string;
  placeName?: string | null;
  /**
   * Identifiant REEL du lieu, quand celui qui redige l etape le connait
   * reellement : le depart et l arrivee sont des `PlaceRef`, ils ont un id.
   * Absent ou `null` sinon — un lieu trouve par un modele n a pas
   * d identifiant, et il ne doit pas en recevoir un de fabrication.
   */
  placeId?: string | null;
  reason?: string | null;
  startTime?: string | null;
  mealSlot?: MealSlot | null;
  state?: ItineraryStep['state'];
  price?: MoneyValue;
}

/** Etape honnete : aucune donnee chiffree n'est produite ici. */
export function createStep(
  id: string,
  day: number,
  order: number,
  kind: ItineraryStepKind,
  draft: StepDraft,
): ItineraryStep {
  return {
    id,
    day,
    order,
    kind,
    title: draft.title,
    placeName: draft.placeName ?? null,
    placeId: draft.placeId ?? null,
    startTime: draft.startTime ?? null,
    durationMin: null,
    reason: draft.reason ?? null,
    price: draft.price ?? PRICE_TO_CHECK,
    state: draft.state ?? 'propose',
    kept: false,
    icon: ICONS[kind],
    lat: null,
    lon: null,
    mealSlot: draft.mealSlot ?? null,
  };
}

/**
 * Le moteur peut-il construire un parcours ?
 *
 * meme predicate que le CTA et que le rail : `hasEngineMinimum`. La duree
 * n y figure plus, et c etait le TROISIEME endroit qui exigeait la duree alors
 * que toute la chaine existe deja — `effectiveDays` extend le plan a la duree
 * proposee par le modele, `suggestDurationDays` l applique au calendrier, et
 * le repli regles se contente d un squelette d un jour.
 *
 * Mesure du 2026-09-28 : le clic passait enfin a l etape 2, et l ecran
 * n'affichait rien, sans appel reseau. `shouldLaunchGeneration` rendait false
 * pour cause de duree — un ecran de generation qui ne demarre jamais.
 */
export function isBuildable(draft: AdventurePrepDraft): boolean {
  return hasEngineMinimum(draft);
}

function travelState(draft: AdventurePrepDraft): ItineraryStep['state'] {
  return draft.preferences.transport === 'peigne' ? 'propose' : 'a_reserver';
}

function nightTitle(selection: AdventurePrepDraft['activities']): string {
  return selection.nights.includes('bivouac') ? 'Nuit en bivouac' : 'Nuit';
}

/**
 * La forme du parcours, telle qu elle se lit dans la phrase du jour 1.
 *
 * Elle rend un groupe complet, pas un fragment : « parcours en « et on
 * revient au point de départ » » n etait pas du francais, et le mot qui
 * fermait la phrase avait disparu avec le glyphe manquant du signalement
 * P0.12. Une forme se nomme, puis elle se explique.
 */
function shapeLabel(shape: RouteShape): string {
  return shape === 'boucle'
    ? 'boucle : on revient au point de départ'
    : 'aller simple';
}

/**
 * Propose une structure de parcours. Les distances, durees, prix et lieux
 * restent `null` tant qu'aucune source ne les fournit.
 */
export function buildItinerary(draft: AdventurePrepDraft): ItineraryModel | null {
  if (!isBuildable(draft)) return null;
  const origin = draft.route.origin;
  const destination = draft.route.destination;
  if (!origin) return null;
  const days = Math.max(1, Math.trunc(draft.calendar.durationDays ?? 1));
  const primary = activityById(draft.activities.primary ?? '');
  const bivouac = draft.activities.nights.includes('bivouac');
  const steps: ItineraryStep[] = [];
  let serial = 0;
  const push = (day: number, kind: ItineraryStepKind, draftStep: StepDraft) => {
    const daySteps = steps.filter((step) => step.day === day);
    steps.push(
      createStep(`d${day}-${kind}-${serial++}`, day, daySteps.length, kind, draftStep),
    );
  };

  for (let day = 1; day <= days; day += 1) {
    if (day === 1) {
      push(1, 'trajet', {
        title: `Départ de ${origin.name}`,
        placeName: origin.name,
        placeId: origin.id,
        reason: `Départ choisi, parcours en ${shapeLabel(draft.route.shape)}.`,
        state: travelState(draft),
        price:
          draft.preferences.transport === 'peigne'
            ? { amount: 0, currency: 'EUR', state: 'propose' }
            : PRICE_TO_CHECK,
      });
    }
    for (const stop of proposedStops(draft, day, days)) {
      push(day, stop.kind, stop);
    }
    if (day < days) {
      push(day, 'nuit', {
        title: nightTitle(draft.activities),
        reason: bivouac
          ? 'Nuit en bivouac : le spot reste à trouver'
          : primary
            ? `Nuit ${de(primary.label.toLowerCase())} : hébergement à vérifier`
            : 'Hébergement à vérifier',
        state: 'a_reserver',
      });
    }
    // Le retour vise l arrivee en aller simple, le DEPART en boucle.
    //
    // Ce n est pas un detail de forme : le motif du jour 1 ecrit deja « parcours
    // en et on revient au point de depart ». Une boucle qui s arretait ailleurs
    // contredisait cette phrase a l ecran, rendait faux un titre comme « Boucle
    // du Mont-Blanc », et surtout ne comptait pas dans le kilometrage le retour
    // reellement parcouru.
    if (day === days) {
      const retour = draft.route.shape === 'aller_simple' ? destination : origin;
      if (!retour) continue;
      push(day, 'trajet', {
        title: `Retour ${de(retour.name)}`,
        placeName: retour.name,
        placeId: retour.id,
        reason: 'Retour : trajet et horaires à vérifier',
        state: travelState(draft),
        price:
          draft.preferences.transport === 'peigne'
            ? { amount: 0, currency: 'EUR', state: 'propose' }
            : PRICE_TO_CHECK,
      });
    }
  }

  // Le repli regles n invente AUCUN nom : pas de modele, pas de titre.
  const model: ItineraryModel = {
    title: null,
    days,
    steps,
    totals: { ...EMPTY_TOTALS },
    perDay: Array.from({ length: days }, () => ({ ...EMPTY_TOTALS })),
    // La meteo n est pas une donnee du modele : elle se mesure plus tard, sur
    // les dates reelles. Aucune n est encore connue ici.
    weather: Array.from({ length: days }, () => null),
    metricsContext: metricsContextFor(draft.activities),
    budgetPerPerson:
      draft.preferences.budgetPerPerson === null
        ? PRICE_TO_CHECK
        : {
            amount: draft.preferences.budgetPerPerson,
            currency: 'EUR',
            state: 'propose',
          },
    activityCount: (draft.activities.primary ? 1 : 0) + draft.activities.extra.length,
    contingencies: [],
  };
  return { ...model, contingencies: buildContingencies(model) };
}

export function daySteps(model: ItineraryModel, day: number): ItineraryStep[] {
  return model.steps.filter((step) => step.day === day).sort((a, b) => a.order - b.order);
}

export function stepById(model: ItineraryModel, id: string): ItineraryStep | undefined {
  return model.steps.find((step) => step.id === id);
}

function withSteps(model: ItineraryModel, steps: readonly ItineraryStep[]): ItineraryModel {
  return { ...model, steps: [...steps] };
}

/** Reordonne les `order` d'une journee apres insertion, suppression ou import IA. */
export function renumberByDay(steps: readonly ItineraryStep[]): ItineraryStep[] {
  const counters = new Map<number, number>();
  return [...steps]
    .sort((a, b) => a.day - b.day || a.order - b.order)
    .map((step) => {
      const order = counters.get(step.day) ?? 0;
      counters.set(step.day, order + 1);
      return order === step.order ? step : { ...step, order };
    });
}

export function addStep(
  model: ItineraryModel,
  day: number,
  kind: ItineraryStepKind,
  draft: StepDraft,
): ItineraryModel {
  const siblings = model.steps.filter((step) => step.day === day);
  const step = createStep(
    `d${day}-${kind}-ajout-${siblings.length + 1}`,
    day,
    siblings.length,
    kind,
    draft,
  );
  return withSteps(model, renumberByDay([...model.steps, step]));
}

export function setStepKept(model: ItineraryModel, stepId: string, kept: boolean): ItineraryModel {
  return withSteps(
    model,
    model.steps.map((step) => (step.id === stepId ? { ...step, kept } : step)),
  );
}

export function setStepMealSlot(
  model: ItineraryModel,
  stepId: string,
  mealSlot: MealSlot | null,
): ItineraryModel {
  return withSteps(
    model,
    model.steps.map((step) => (step.id === stepId ? { ...step, mealSlot } : step)),
  );
}

export function removeStep(model: ItineraryModel, stepId: string): ItineraryModel {
  return withSteps(
    model,
    renumberByDay(model.steps.filter((step) => step.id !== stepId)),
  );
}

export interface KnownGap {
  id: string;
  label: string;
}

/** Ce que l'app ne sait pas encore, dit en clair. */
export function knownGaps(model: ItineraryModel): KnownGap[] {
  const gaps: KnownGap[] = [];
  if (model.totals.distanceKm === null) gaps.push({ id: 'distance', label: 'Distance à vérifier' });
  if (model.totals.movingMin === null) gaps.push({ id: 'duree', label: 'Temps de parcours à vérifier' });
  if (model.totals.elevGainM === null) gaps.push({ id: 'denivele', label: 'Dénivelé à vérifier' });
  if (model.steps.every((step) => step.price.amount === null)) {
    gaps.push({ id: 'prix', label: 'Prix à vérifier' });
  }

  // La meteo muette doit se voir. Sans date de depart, ou fournisseur sans
  // reponse, aucune journee n est mesuree : le dire vaut mieux que laisser un
  // vide que la personne lit comme « pas de pluie ce jour-la ».
  if (model.days > 0 && model.weather.length === model.days && model.weather.every((day) => day === null)) {
    gaps.push({ id: 'meteo', label: 'Météo à vérifier' });
  }
  return gaps;
}

