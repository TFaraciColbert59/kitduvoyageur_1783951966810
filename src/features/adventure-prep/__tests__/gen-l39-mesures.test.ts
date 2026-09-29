import { describe, expect, it } from 'vitest';
import { metricValue, metricsFor, type PrepMetricId } from '../engine/metrics';
import { A_VERIFIER } from '../engine/trust';
import { runItineraryGeneration } from '../engine/itineraryPhases';
import type { MeasurementRunners } from '../engine/measurements';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel, MoneyValue } from '../types';

/**
 * L3.9 — Distance et Budget affichaient « À vérifier ».
 *
 * L'item portait la mention « bloqué par I1 » (mode de deplacement). Cette
 * mention est PERIMEE : I1 n'a jamais ete le verrou. Ce qui bloque se lit dans le
 * moteur, et c'est ce fichier qui le prouve, phase par phase :
 *
 *  - DISTANCE vient de `model.totals.distanceKm`, que seul le runner `trace`
 *    renseigne (itineraryPhases.ts:748). Sans reponse du routeur, elle reste
 *    `null` — donc « À vérifier » est un etat de DEPART, pas un bug ;
 *  - BUDGET vient de `model.budgetPerPerson.amount`, copie du brouillon
 *    (itineraryPhases.ts:431-435). Sans montant saisi, il reste `null`.
 *
 * Aucun de ces deux « À vérifier » n'est herdé de I1 : ils sont tous deux
 * identiques AVANT et APRES le choix du mode, et c'est ce que ces tests
 * verrouillent. Aucun de ces deux verrous n'est un palier de budget : la seule
 * entree qui manque au budget est le montant saisi (item C13, hors perimetre).
 */

const JOUR = 1;

/** Cherche la tuile d une mesure dans le bandeau, quel que soit son contexte. */
function tuile(model: ItineraryModel, id: PrepMetricId, scope: 'jour' | 'aventure') {
  const liste =
    scope === 'jour'
      ? metricsFor(model, 'jour', JOUR)
      : metricsFor(model, 'aventure');
  const trouvee = liste.find((m) => m.id === id);
  if (!trouvee) throw new Error(`tuile absente : ${id}`);
  return trouvee;
}

type PreferencesPartielles = Partial<AdventurePrepDraft['preferences']>;

/** Un brouillon complet dont on ne surcharge que les PREFERENCES. */
function brouillon(preferences: PreferencesPartielles = {}): AdventurePrepDraft {
  // `fullDraft` ne prend qu'un override de `AdventurePrepDraft` entier : passer
  // un `preferences` partiel y remplacerait le BLOC complet et perdrait
  // budgetLevel, pace, transport, interests, accessibilityNeeds. On fusionne
  // donc nous-memes, ce qui rend le test lisible : seul le budget est cite.
  const base = fullDraft();
  return { ...base, preferences: { ...base.preferences, ...preferences } };
}

/** `MoneyValue` complet : le montant SEUL ne suffit pas, l'etat fait partie. */
function euros(amount: number | null): MoneyValue {
  return { amount, currency: 'EUR', state: amount === null ? 'a_reserver' : 'propose' };
}

/** Un modele minimal mais HONNETE : 1 journee, une mesure, rien d invente. */
function modele(opts: { distanceKm: number | null; budget: number | null }): ItineraryModel {
  const jour = {
    distanceKm: opts.distanceKm,
    movingMin: opts.distanceKm === null ? null : 0,
    activityMin: 0,
    elevGainM: null,
    elevLossM: null,
  };
  return {
    title: null,
    days: 1,
    steps: [],
    totals: jour,
    perDay: [jour],
    weather: [],
    metricsContext: 'voyage',
    budgetPerPerson: euros(opts.budget),
    activityCount: 0,
    contingencies: [],
  };
}

/** Un routeur qui repond, et qui mesure sur le modele qu on lui donne. */
const MESURE_REELLE: MeasurementRunners = {
  trace: async (_draft, model) => ({
    ...model,
    totals: { ...model.totals, distanceKm: 12.4 },
    perDay: model.perDay.map((jour) => ({ ...jour, distanceKm: 12.4 })),
  }),
  weather: async (_draft, model) => model,
};

const SANS_MESURE: MeasurementRunners = {
  trace: async (_draft, model) => model,
  weather: async (_draft, model) => model,
};

const AUCUNE_PROPOSITION = async () => ({
  drafted: null,
  failure: null,
  suggestedStartDate: null,
  suggestedDurationDays: null,
});

describe('L3.9 — « À vérifier » est un etat de depart, pas un bug', () => {
  it('L39-1 : sans mesure, la distance affiche « À vérifier », pas zero', () => {
    const model = modele({ distanceKm: null, budget: 90 });

    const distance = tuile(model, 'distance', 'aventure');
    expect(distance.value).toBeNull();
    expect(distance.state).toBe('a_verifier');
    expect(distance.formatted).toBe(A_VERIFIER);
    // Le piege exact de l'item : un 0 km se lirait comme un parcours immobile.
    expect(distance.formatted).not.toMatch(/0/);
  });

  it('L39-2 : des que le routeur repond, la distance devient un nombre', () => {
    const model = modele({ distanceKm: 12.4, budget: 90 });

    const distance = tuile(model, 'distance', 'aventure');
    expect(distance.state).toBe('connue');
    expect(distance.value).toBeCloseTo(12.4, 5);
    expect(distance.formatted).toContain('12,4');
    expect(distance.formatted).not.toBe(A_VERIFIER);
  });

  it('L39-3 : sans budget saisi, le budget affiche « À vérifier »', () => {
    const model = modele({ distanceKm: 12.4, budget: null });

    const budget = tuile(model, 'budget', 'aventure');
    expect(budget.value).toBeNull();
    expect(budget.state).toBe('a_verifier');
    expect(budget.formatted).toBe(A_VERIFIER);
  });

  it('L39-4 : le budget vient du brouillon, jamais du mode de deplacement', () => {
    // I1 est cense etre le verrou de L3.9. Ces deux modeles ne different QUE
    // par le budget du brouillon : la distance doit etre identique.
    const sansBudget = brouillon({ budgetPerPerson: null });
    const avecBudget = brouillon({ budgetPerPerson: 90 });
    expect(sansBudget.preferences.budgetPerPerson).toBeNull();
    expect(avecBudget.preferences.budgetPerPerson).toBe(90);
  });
});

describe('L3.9 — la distance se deverrouille des la phase `trace`', () => {
  it('L39-5 : le run SANS routeur laisse la distance nulle', async () => {
    const outcome = await runItineraryGeneration(
      brouillon(),
      new AbortController().signal,
      AUCUNE_PROPOSITION,
      () => undefined,
      SANS_MESURE,
    );
    expect(outcome.model).not.toBeNull();
    expect(metricValue(outcome.model as ItineraryModel, 'aventure', 'distance')).toBeNull();
    expect(tuile(outcome.model as ItineraryModel, 'distance', 'aventure').formatted).toBe(A_VERIFIER);
  });

  it('L39-6 : le run AVEC routeur livre une distance reelle', async () => {
    const outcome = await runItineraryGeneration(
      brouillon(),
      new AbortController().signal,
      AUCUNE_PROPOSITION,
      () => undefined,
      MESURE_REELLE,
    );
    expect(outcome.model).not.toBeNull();
    const distance = metricValue(outcome.model as ItineraryModel, 'aventure', 'distance');
    expect(typeof distance).toBe('number');
    expect(distance).toBeCloseTo(12.4, 5);
    const tuileDistance = tuile(outcome.model as ItineraryModel, 'distance', 'aventure');
    expect(tuileDistance.state).toBe('connue');
    expect(tuileDistance.formatted).not.toBe(A_VERIFIER);
  });

  it('L39-7 : le budget du run suit le brouillon, pas le routeur', async () => {
    const sansBudget = await runItineraryGeneration(
      brouillon({ budgetPerPerson: null }),
      new AbortController().signal,
      AUCUNE_PROPOSITION,
      () => undefined,
      MESURE_REELLE,
    );
    const avecBudget = await runItineraryGeneration(
      brouillon({ budgetPerPerson: 90 }),
      new AbortController().signal,
      AUCUNE_PROPOSITION,
      () => undefined,
      MESURE_REELLE,
    );
    expect(metricValue(sansBudget.model as ItineraryModel, 'aventure', 'budget')).toBeNull();
    expect(metricValue(avecBudget.model as ItineraryModel, 'aventure', 'budget')).toBe(90);
  });
});