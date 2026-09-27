import { A_VERIFIER, formatNumber, withUnit } from './trust';
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
  duree: 'jours',
  nuitees: 'jours',
  budget: '€',
};

function dayTotals(model: ItineraryModel, day: number | undefined) {
  if (day === undefined) return model.totals;
  return model.perDay[Math.max(0, Math.min(day, model.perDay.length) - 1)] ?? model.totals;
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
      return scope === 'jour' ? (day ?? 1) : model.days;
    case 'nuitees':
      return scope === 'jour' ? (day ?? 1) : model.days;
    case 'budget':
      return model.budgetPerPerson.amount;
    default:
      return null;
  }
}

/** Les trois mesures de l'ecran, choisies par le contexte de l'activite. */
export function metricsFor(
  model: ItineraryModel,
  scope: MetricScope,
  day?: number,
): PrepMetric[] {
  return ORDER[model.metricsContext].map((id) => {
    const value = raw(model, scope, id, day);
    const unit = scope === 'jour' && (id === 'duree' || id === 'nuitees') ? 'jour' : UNITS[id];
    return {
      id,
      label: LABELS[id],
      value,
      unit,
      state: value === null ? ('a_verifier' as const) : ('connue' as const),
      formatted: value === null ? A_VERIFIER : withUnit(value, unit, id === 'budget' ? 0 : 1),
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
