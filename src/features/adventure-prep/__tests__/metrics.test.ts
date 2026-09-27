import { describe, expect, it } from 'vitest';
import { metricsFor, metricValue } from '../engine/metrics';
import { buildItinerary } from '../engine/itinerary';
import type { ItineraryModel } from '../types';
import { fullDraft } from './fixtures';

function modelWith(overrides: Parameters<typeof fullDraft>[0]): ItineraryModel {
  const built = buildItinerary(fullDraft(overrides));
  if (!built) throw new Error('modele attendu');
  return built;
}

const terrain = (): ItineraryModel => modelWith({});
const sejour = (): ItineraryModel => modelWith({ activities: { primary: 'snowboard-sejour', extra: [], nights: [] } });
const voyage = (): ItineraryModel => modelWith({ activities: { primary: 'roadtrip', extra: [], nights: [] } });

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
    expect(distance.formatted).toBe('À vérifier');
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


describe('accord des unites comptables', () => {
  const oneDay = () =>
    modelWith({
      calendar: { startDate: '2026-07-11', durationDays: 1, durationIsSuggested: true, returnDate: '2026-07-11' },
    });

  it('ecrit « 1 jour » et jamais « 1 jours »', () => {
    const duree = metricsFor(oneDay(), 'aventure').find((m) => m.id === 'duree');
    expect(duree?.value).toBe(1);
    expect(duree?.formatted).toBe('1 jour');
  });

  it('conserve le pluriel au-dela de 1', () => {
    const duree = metricsFor(sejour(), 'aventure').find((m) => m.id === 'duree');
    expect(duree?.formatted).toBe('3 jours');
  });

  it('accorda les nuitees sur le meme principe', () => {
    const uneNuitee = modelWith({
      activities: { primary: 'snowboard-sejour', extra: [], nights: [] },
      calendar: { startDate: '2026-07-11', durationDays: 1, durationIsSuggested: false, returnDate: '2026-07-11' },
    });
    expect(metricsFor(uneNuitee, 'aventure').find((m) => m.id === 'nuitees')?.formatted).toBe('1 jour');
  });

  it('laisse les unites non comptables intactes', () => {
    const budget = metricsFor(sejour(), 'aventure').find((m) => m.id === 'budget');
    expect(budget?.unit).toBe('€');
  });
});
