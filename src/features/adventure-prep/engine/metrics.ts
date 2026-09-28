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
}

export type MetricScope = 'jour' | 'aventure';

const ORDER: Readonly<Record<MetricsContext, readonly PrepMetricId[]>> = {
  terrain: ['distance', 'denivele', 'duree'],
  sejour: ['nuitees', 'budget', 'duree'],
  voyage: ['distance', 'duree', 'budget'],
};

const LABELS: Readonly<Record<PrepMetricId, string>> = {
  distance: 'Distance',
  denivele: 'Dénivelé +',
  duree: 'Durée',
  nuitees: 'Nuitées',
  budget: 'Budget / personne',
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
      if (scope === 'jour' && day !== undefined) return dayBudget(model, day);
      return model.budgetPerPerson.amount;
    default:
      return null;
  }
}

function format(id: PrepMetricId, value: number | null, unit: string): string {
  if (id === 'duree') return formatMinutes(value);
  return withUnit(value, unit, id === 'budget' ? 0 : 1);
}

/** Les trois mesures de l'ecran, choisies par le contexte de l'activite. */
export function metricsFor(
  model: ItineraryModel,
  scope: MetricScope,
  day?: number,
): PrepMetric[] {
  return ORDER[model.metricsContext].map((id) => {
    const value = raw(model, scope, id, day);
    const unit = value === null ? UNITS[id] : countableUnit(UNITS[id], value);
    return {
      id,
      label: LABELS[id],
      value,
      unit,
      state: value === null ? ('a_verifier' as const) : ('connue' as const),
      formatted: format(id, value, unit),
    };
  });
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
