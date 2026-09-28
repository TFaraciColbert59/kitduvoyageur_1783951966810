import { dayBudget } from './places';
import { countableUnit, formatMinutes, formatNumber, withUnit } from './trust';
import type { ItineraryModel, MetricsContext } from '../types';

export type PrepMetricId = 'distance' | 'denivele' | 'duree' | 'nuitees' | 'budget';

export interface PrepMetric {
  id: PrepMetricId;
  label: string;
  value: number | null;
  unit: string;
  state: 'connue' | 'a_verifier';
  formatted: string;
  /**
   * Precision quand la valeur est partielle : « 2 étapes à vérifier ».
   *
   * Elle n existe que pour le budget d une journee, seule mesure ou une
   * partie reelle est connue ET affichable sans pretendre au total.
   */
  note?: string;
}

export type MetricScope = 'jour' | 'aventure';

/**
 * Jour reellement focalise, ou `null` pour le voyage entier.
 *
 * UNE seule decision de perimetre, partagee par les deux etapes qui montrent
 * des mesures. Elle vit ici, et pas dans un composant, parce que les deux
 * ecrans ont deja diverge une fois : `DepartureStep` filtrait sa liste de
 * programme sur le jour choisi tout en affichant, juste au-dessus, le total de
 * l'aventure. L'ecran disait donc « Jour 1 » et comptait le voyage — mesure
 * du 2026-09-28.
 *
 * Hors borne (jour supprime, voyage raccourci entre deux rendus), on retombe
 * sur `null` : l'ecran montre tout plutot que de devenir vide.
 */
export function activeDayOrNull(totalDays: number, selectedDay: number | null): number | null {
  if (selectedDay === null) return null;
  if (!Number.isInteger(selectedDay) || selectedDay < 1) return null;
  return selectedDay <= totalDays ? selectedDay : null;
}

const ORDER: Readonly<Record<MetricsContext, readonly PrepMetricId[]>> = {
  terrain: ['distance', 'denivele', 'duree'],
  sejour: ['nuitees', 'budget', 'duree'],
  voyage: ['distance', 'duree', 'budget'],
};

const LABELS: Readonly<Record<PrepMetricId, string>> = {
  distance: 'Distance',
  denivele: 'Dénivelé',
  duree: 'Durée',
  nuitees: 'Nuitées',
  // « par personne » reste dit, mais en abrégé : la tuile est un conteneur
  // inline-size d environ 96px sur 393px, et le libelle entier y finissait
  // coupe par l ellipsis (« Budget / per… »). La valeur porte deja l unite.
  budget: 'Budget / pers.',
};

const UNITS: Readonly<Record<PrepMetricId, string>> = {
  distance: 'km',
  denivele: 'm',
  duree: 'h',
  nuitees: 'jours',
  budget: '€',
};

function dayTotals(model: ItineraryModel, day: number | undefined) {
  if (day === undefined) return model.totals;
  return model.perDay[Math.max(0, Math.min(day, model.perDay.length) - 1)] ?? model.totals;
}

/**
 * Duree d'activite de toute l'aventure. Volontairement stricte : une seule
 * journee sans duree connue suffit a rendre le total « à vérifier », parce
 * qu'une somme partielle se lirait comme une duree fiable.
 */
function tripActivityMin(model: ItineraryModel): number | null {
  if (model.perDay.length === 0) return model.totals.activityMin;
  let total = 0;
  for (const day of model.perDay) {
    if (day.activityMin === null) return null;
    total += day.activityMin;
  }
  return total;
}

/**
 * Nuitees reellement prevues pour une journee : on compte les etapes de type
 * « nuit », jamais l index du jour. Un sejour sans hebergement le jour meme
 * affiche 0, ce qui est un fait ; l index du jour serait une valeur presente
 * comme une mesure.
 */
function dayNights(model: ItineraryModel, day: number | undefined): number | null {
  if (day === undefined) return model.days;
  if (day < 1) return null;
  return model.steps.filter((step) => step.day === day && step.kind === 'nuit').length;
}

function raw(
  model: ItineraryModel,
  scope: MetricScope,
  id: PrepMetricId,
  day: number | undefined,
): number | null {
  const totals = dayTotals(model, scope === 'jour' ? day : undefined);
  switch (id) {
    case 'distance':
      return totals.distanceKm;
    case 'denivele':
      return totals.elevGainM;
    case 'duree':
      return scope === 'jour' ? totals.activityMin : tripActivityMin(model);
    case 'nuitees':
      return scope === 'jour' ? dayNights(model, day) : model.days;
    case 'budget':
      if (scope === 'jour' && day !== undefined) {
        const budget = dayBudget(model, day);
        return budget.none ? null : budget.known;
      }
      return model.budgetPerPerson.amount;
    default:
      return null;
  }
}

function format(id: PrepMetricId, value: number | null, unit: string, note?: string): string {
  if (id === 'budget' && value !== null && note !== undefined) {
    // La somme connue, et le mot qui empeche de la lire comme le total du
    // jour. Le detail part sur une ligne en dessous, portee par `note` :
    // inline il tronquait la tuile sur un telephone.
    return `${withUnit(value, unit, 0)} connus`;
  }
  if (id === 'duree') return formatMinutes(value);
  return withUnit(value, unit, id === 'budget' ? 0 : 1);
}

/**
 * Budget partiel d une journee : la somme reelle, et le nombre de prix qu il
 * reste a confirmer.
 *
 * La note disparait des que la journee est entierement pricee — dans ce cas la
 * valeur affichee EST le total, et une precision serait un bruit. Si aucun
 * prix n est connu, il n y a rien a preciser : l ecran affiche « a verifier ».
 */
function budgetNoteFor(
  model: ItineraryModel,
  scope: MetricScope,
  id: PrepMetricId,
  day: number | undefined,
): string | undefined {
  if (id !== 'budget' || scope !== 'jour' || day === undefined) return undefined;
  const budget = dayBudget(model, day);
  if (budget.none || budget.unknownCount === 0) return undefined;
  return `${budget.unknownCount} \u00e9tape${budget.unknownCount > 1 ? 's' : ''} \u00e0 v\u00e9rifier`;
}

/** Les trois mesures de la carte d une journee, dans l ordre de lecture. */
const JOUR_METRICS: readonly PrepMetricId[] = ['distance', 'duree', 'budget'];

function build(
  model: ItineraryModel,
  scope: MetricScope,
  id: PrepMetricId,
  day: number | undefined,
): PrepMetric {
  const value = raw(model, scope, id, day);
  const unit = value === null ? UNITS[id] : countableUnit(UNITS[id], value);
  const note = budgetNoteFor(model, scope, id, day);
  return {
    id,
    label: LABELS[id],
    value,
    unit,
    state: value === null ? ('a_verifier' as const) : ('connue' as const),
    formatted: format(id, value, unit, note),
    ...(note === undefined ? {} : { note }),
  };
}

/**
 * Les trois mesures de la carte d un jour.
 *
 * Elles ne suivent PAS le contexte de l activite, contrairement au bandeau du
 * haut. Ce bandeau choisit ce qui interessera le plus selon l activite ; la
 * carte d une journee, elle, repond toujours a la meme question — ce qu on a
 * franchi, ce que ca a occupe, ce que ca a coute. Un contexte « terrain »
 * qui n'afficherait pas le budget au jour 2 alors qu'il l'affiche au jour 1
 * ferait de la comparaison une illusion.
 */
export function dayMetrics(model: ItineraryModel, day: number): PrepMetric[] {
  return JOUR_METRICS.map((id) => build(model, 'jour', id, day));
}

/** Les trois mesures de l'ecran, choisies par le contexte de l'activite. */
export function metricsFor(
  model: ItineraryModel,
  scope: MetricScope,
  day?: number,
): PrepMetric[] {
  return ORDER[model.metricsContext].map((id) => build(model, scope, id, day));
}

export function metricValue(
  model: ItineraryModel,
  scope: MetricScope,
  id: PrepMetricId,
  day?: number,
): number | null {
  return raw(model, scope, id, day);
}

export { formatNumber };
