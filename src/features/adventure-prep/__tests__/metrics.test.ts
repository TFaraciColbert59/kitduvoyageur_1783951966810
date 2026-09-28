import { describe, expect, it } from 'vitest';
import { metricsFor, metricValue } from '../engine/metrics';
import { buildItinerary } from '../engine/itinerary';
import { A_VERIFIER } from '../engine/trust';
import { PRICE_TO_CHECK, type ItineraryModel, type MoneyValue } from '../types';
import { fullDraft } from './fixtures';

function modelWith(overrides: Parameters<typeof fullDraft>[0]): ItineraryModel {
  const built = buildItinerary(fullDraft(overrides));
  if (!built) throw new Error('modele attendu');
  return built;
}

const terrain = (): ItineraryModel => modelWith({});
const sejour = (): ItineraryModel => modelWith({ activities: { primary: 'snowboard-sejour', extra: [], nights: [] } });
const voyage = (): ItineraryModel => modelWith({ activities: { primary: 'roadtrip', extra: [], nights: [] } });

/**
 * Duree d'activite reelle, minute par minute. Les totaux ne sont pas touches :
 * seule la somme des journees peut alimenter la duree de l'aventure.
 */
function withActivityMin(
  model: ItineraryModel,
  minutes: readonly (number | null)[],
): ItineraryModel {
  return {
    ...model,
    perDay: model.perDay.map((totals, index) => ({
      ...totals,
      activityMin: index < minutes.length ? minutes[index] : null,
    })),
  };
}

const euros = (amount: number): MoneyValue => ({ amount, currency: 'EUR', state: 'propose' });

/** Prixplique une journee entiere, ou `null` pour un prix encore inconnu. */
function withStepPrices(
  model: ItineraryModel,
  amount: number | null,
  day?: number,
): ItineraryModel {
  return {
    ...model,
    steps: model.steps.map((step) => {
      if (day !== undefined && step.day !== day) return step;
      return { ...step, price: amount === null ? PRICE_TO_CHECK : euros(amount) };
    }),
  };
}

const pick = (model: ItineraryModel, scope: 'jour' | 'aventure', id: string, day?: number) =>
  metricsFor(model, scope, day).find((metric) => metric.id === id);

describe('trois metriques par contexte', () => {
  it('affiche exactement trois metriques, toujours les memes par contexte', () => {
    expect(metricsFor(terrain(), 'aventure').map((m) => m.id)).toEqual([
      'distance',
      'denivele',
      'duree',
    ]);
    expect(metricsFor(sejour(), 'aventure').map((m) => m.id)).toEqual([
      'nuitees',
      'budget',
      'duree',
    ]);
    expect(metricsFor(voyage(), 'aventure').map((m) => m.id)).toEqual([
      'distance',
      'duree',
      'budget',
    ]);
  });

  it('marque une valeur inconnue « a verifier » au lieu de zero', () => {
    for (const model of [terrain(), sejour(), voyage()]) {
      for (const metric of metricsFor(model, 'aventure')) {
        if (metric.value === null) {
          expect(metric.state).toBe('a_verifier');
        } else {
          expect(metric.state).toBe('connue');
        }
      }
    }
    const distance = metricsFor(terrain(), 'aventure')[0];
    expect(distance.value).toBeNull();
    expect(distance.formatted).toBe(A_VERIFIER);
    expect(distance.formatted).not.toBe('0 km');
  });

  it('affiche une valeur reelle quand elle existe', () => {
    const budget = metricsFor(sejour(), 'aventure').find((m) => m.id === 'budget');
    expect(budget?.value).toBe(90);
    expect(budget?.formatted).toContain('90');
    const nuitees = metricsFor(sejour(), 'aventure').find((m) => m.id === 'nuitees');
    expect(nuitees?.value).toBe(3);
  });

  it('change d\'unité entre la journee et l\'aventure', () => {
    const jour = metricsFor(sejour(), 'jour')[0];
    const aventure = metricsFor(sejour(), 'aventure')[0];
    expect(jour.id).toBe('nuitees');
    expect(aventure.id).toBe('nuitees');
  });

  it('utilise les totaux du jour selectionne', () => {
    const model = terrain();
    const jour2 = metricsFor(model, 'jour', 2);
    const jour1 = metricsFor(model, 'jour', 1);
    expect(jour2).toHaveLength(3);
    expect(jour1).toHaveLength(3);
  });

  it('renvoie la valeur brute, ou null si elle est inconnue', () => {
    const model = terrain();
    expect(metricValue(model, 'aventure', 'distance')).toBeNull();
    const budget = modelWith({
      activities: { primary: 'roadtrip', extra: [], nights: [] },
    });
    expect(metricValue(budget, 'aventure', 'budget')).toBe(90);
  });
});

describe('duree : une duree reelle, jamais un nombre de jours', () => {
  it('renvoie la duree d activite du jour selectionne', () => {
    const model = withActivityMin(terrain(), [300, 120, 45]);
    const jour1 = pick(model, 'jour', 'duree', 1);
    expect(jour1?.value).toBe(300);
    expect(jour1?.formatted).toBe('5 h');
    expect(jour1?.state).toBe('connue');
    expect(pick(model, 'jour', 'duree', 2)?.formatted).toBe('2 h');
    expect(pick(model, 'jour', 'duree', 3)?.formatted).toBe('45 min');
  });

  it('reste une duree sous l heure', () => {
    const model = withActivityMin(terrain(), [45, null, null]);
    expect(pick(model, 'jour', 'duree', 1)?.formatted).toBe('45 min');
  });

  it('ne renvoie jamais l index du jour', () => {
    const model = withActivityMin(terrain(), [null, null, null]);
    const jour3 = pick(model, 'jour', 'duree', 3);
    expect(jour3?.value).toBeNull();
    expect(jour3?.formatted).toBe(A_VERIFIER);
    expect(jour3?.formatted).not.toContain('jour');
  });

  it('marque « a verifier » des qu une journee n a pas de duree connue', () => {
    const model = withActivityMin(terrain(), [300, null, 45]);
    const jour2 = pick(model, 'jour', 'duree', 2);
    expect(jour2?.value).toBeNull();
    expect(jour2?.state).toBe('a_verifier');
    expect(jour2?.formatted).toBe(A_VERIFIER);
    expect(jour2?.formatted).not.toBe('0 h');
  });

  it('additionne les durees des journees de l aventure', () => {
    const model = withActivityMin(terrain(), [300, 120, 45]);
    const duree = pick(model, 'aventure', 'duree');
    expect(duree?.value).toBe(465);
    expect(duree?.formatted).toBe('7 h 45 min');
    expect(metricValue(model, 'aventure', 'duree')).toBe(465);
  });

  it('ne presente jamais un total partiel si un seul jour est inconnu', () => {
    const model = withActivityMin(terrain(), [300, null, 45]);
    const duree = pick(model, 'aventure', 'duree');
    expect(duree?.value).toBeNull();
    expect(duree?.state).toBe('a_verifier');
    expect(duree?.formatted).toBe(A_VERIFIER);
  });

  it('exprime la duree en heures et non en jours', () => {
    const model = withActivityMin(terrain(), [300, 120, 45]);
    const duree = pick(model, 'jour', 'duree', 1);
    expect(duree?.unit).toBe('h');
    expect(duree?.unit).not.toBe('jours');
    expect(pick(terrain(), 'aventure', 'duree')?.unit).toBe('h');
  });
});

describe('budget : la depense du jour quand un jour est selectionne', () => {
  it('somme les prix de la journee selectionnee', () => {
    const model = withStepPrices(sejour(), 12, 2);
    const steps = model.steps.filter((step) => step.day === 2);
    expect(steps.length).toBeGreaterThan(0);
    const budget = pick(model, 'jour', 'budget', 2);
    expect(budget?.value).toBe(12 * steps.length);
    expect(budget?.formatted).toBe(`${12 * steps.length} €`);
    expect(metricValue(model, 'jour', 'budget', 2)).toBe(12 * steps.length);
  });

  it('ne presente pas un budget partiel quand un prix manque', () => {
    const model = withStepPrices(sejour(), null, 2);
    const budget = pick(model, 'jour', 'budget', 2);
    expect(budget?.value).toBeNull();
    expect(budget?.state).toBe('a_verifier');
    expect(budget?.formatted).toBe(A_VERIFIER);
  });

  it('conserve le budget global de l aventure', () => {
    const model = withStepPrices(sejour(), 12, 2);
    const budget = pick(model, 'aventure', 'budget');
    expect(budget?.value).toBe(90);
    expect(budget?.formatted).toBe('90 €');
  });

  it('retombe sur le budget global quand aucun jour n est selectionne', () => {
    const model = withStepPrices(sejour(), 12, 2);
    expect(pick(model, 'jour', 'budget')?.value).toBe(90);
  });
});

describe('accord des unites comptables', () => {
  const oneDay = () =>
    modelWith({
      activities: { primary: 'snowboard-sejour', extra: [], nights: [] },
      calendar: { startDate: '2026-07-11', durationDays: 1, durationIsSuggested: true, returnDate: '2026-07-11' },
    });

  it('ecrit « 1 jour » et jamais « 1 jours »', () => {
    const uneNuit = modelWith({
      activities: { primary: 'snowboard-sejour', extra: [], nights: [] },
      calendar: { startDate: '2026-07-11', durationDays: 2, durationIsSuggested: false, returnDate: '2026-07-12' },
    });
    const nuitees = pick(uneNuit, 'jour', 'nuitees', 1);
    expect(nuitees?.value).toBe(1);
    expect(nuitees?.formatted).toBe('1 jour');
  });

  it('une journee sans etape nuit vaut zero, pas son index', () => {
    const sansNuit = modelWith({
      activities: { primary: 'snowboard-sejour', extra: [], nights: [] },
      calendar: { startDate: '2026-07-11', durationDays: 2, durationIsSuggested: false, returnDate: '2026-07-12' },
    });
    const nuitees = pick(sansNuit, 'jour', 'nuitees', 2);
    expect(nuitees?.value).toBe(0);
    expect(nuitees?.formatted).toBe('0 jour');
  });

  it('l index du jour ne se lit jamais comme un compte de nuits', () => {
    const model = sejour();
    for (const day of [1, 2, 3]) {
      const nuitees = pick(model, 'jour', 'nuitees', day);
      const reelles = model.steps.filter((step) => step.day === day && step.kind === 'nuit').length;
      expect(nuitees?.value).toBe(reelles);
    }
  });

  it('accorda les nuitees sur le meme principe', () => {
    const uneNuitee = modelWith({
      activities: { primary: 'snowboard-sejour', extra: [], nights: [] },
      calendar: { startDate: '2026-07-11', durationDays: 1, durationIsSuggested: false, returnDate: '2026-07-11' },
    });
    expect(pick(uneNuitee, 'aventure', 'nuitees')?.formatted).toBe('1 jour');
  });

  it('laisse les unites non comptables intactes', () => {
    const budget = metricsFor(sejour(), 'aventure').find((m) => m.id === 'budget');
    expect(budget?.unit).toBe('€');
    const distance = pick(voyage(), 'jour', 'distance', 1);
    expect(distance?.unit).toBe('km');
    const denivele = pick(terrain(), 'jour', 'denivele', 1);
    expect(denivele?.unit).toBe('m');
  });
});
