import { describe, expect, it } from 'vitest';

import { NO_MEASUREMENTS } from '../engine/measurements';
import {
  runItineraryGeneration,
  screenFeasibility,
  applyFeasibility,
  type FeasibilityDeps,
  type FeasibilityVerdict,
} from '../engine/itineraryPhases';
import { buildItinerary } from '../engine/itinerary';
import type { AdventurePrepDraft, ItineraryStep } from '../types';
import type { DraftedItinerary, DraftedStep } from '../engine/itineraryEngine';
import { fullDraft } from './fixtures';

function step(overrides: Partial<ItineraryStep> = {}): ItineraryStep {
  return {
    id: 's1',
    day: 1,
    order: 1,
    kind: 'arret',
    title: 'Pause au col',
    placeName: null,
    startTime: null,
    durationMin: null,
    reason: null,
    price: { amount: null, currency: 'EUR', state: 'a_reserver' },
    state: 'propose',
    kept: false,
    icon: 'map',
    lat: null,
    lon: null,
    mealSlot: null,
    ...overrides,
  };
}

/** Un groupe avec enfants, depuis la banlieue parisienne : le cas P0.4. */
function draftWithChildren(overrides: Partial<AdventurePrepDraft> = {}): AdventurePrepDraft {
  return fullDraft({
    group: { mode: 'groupe', adults: 2, children: 2, hasPets: false, knownMembers: [] },
    ...overrides,
  });
}

function draftStep(overrides: Partial<DraftedStep> = {}): DraftedStep {
  return {
    day: 1,
    kind: 'arret',
    title: 'Étape',
    placeName: null,
    startTime: null,
    durationMin: null,
    reason: null,
    lat: null,
    lon: null,
    ...overrides,
  };
}

function drafted(overrides: Partial<DraftedItinerary> = {}): DraftedItinerary {
  return { days: 1, steps: [draftStep()], hypotheses: [], ...overrides };
}

async function verdictFor(
  draft: AdventurePrepDraft,
  steps: readonly ItineraryStep[],
  deps: FeasibilityDeps = {},
): Promise<FeasibilityVerdict> {
  return screenFeasibility(draft, steps, deps);
}

describe('P0.4 — faisabilite avant affichage', () => {
  it('FS-01 : la plongée est retirée quand le groupe compte des enfants', async () => {
    const diving = step({ id: 'dive', title: 'Plongée autonome sur le récif' });
    const verdict = await verdictFor(draftWithChildren(), [diving]);

    expect(verdict.kept.map((s) => s.id)).toEqual([]);
    expect(verdict.dropped).toHaveLength(1);
    expect(verdict.dropped[0].rule).toBe('plongee_avec_mineurs');
  });

  it('FS-02 : le motif de la plongée nomme les enfants, il ne se contente pas d un code', async () => {
    const verdict = await verdictFor(draftWithChildren(), [step({ title: 'Plongée autonome' })]);

    const reason = verdict.dropped[0]?.reason ?? '';
    expect(reason).toContain('enfant');
    expect(reason).toContain('plongée');
    // Aucun detail technique ne doit fuir dans une phrase affichee.
    expect(reason).not.toMatch(/Error|undefined|null|NaN|regime?ex/i);
  });

  it('FS-03 : la plongée reste proposée quand aucun mineur n est inscrit', async () => {
    const verdict = await verdictFor(fullDraft(), [step({ title: 'Plongée autonome' })]);

    expect(verdict.kept.map((s) => s.id)).toEqual(['s1']);
    expect(verdict.dropped).toEqual([]);
  });

  it('FS-04 : une activité nautique à 120 km du rivage est retirée', async () => {
    const sea = step({ id: 'regate', title: 'Régate en mer' });
    const verdict = await verdictFor(fullDraft(), [sea], {
      distanceToShoreKm: async () => 120,
    });

    expect(verdict.kept).toEqual([]);
    expect(verdict.dropped[0]?.rule).toBe('nautique_hors_rivage');
    expect(verdict.dropped[0]?.reason).toContain('120');
  });

  it('FS-05 : la même activité nautique à 400 m du rivage est conservée', async () => {
    const verdict = await verdictFor(fullDraft(), [step({ id: 'canoe', title: 'Canoë sur le lac' })], {
      distanceToShoreKm: async () => 0.4,
    });

    expect(verdict.kept.map((s) => s.id)).toEqual(['canoe']);
    expect(verdict.dropped).toEqual([]);
  });

  it('FS-06 : rivage muet, on ne rejette pas et on n invente aucune distance', async () => {
    const verdict = await verdictFor(fullDraft(), [step({ id: 'regate', title: 'Régate en mer' })], {
      distanceToShoreKm: async () => null,
    });

    // Rejeter sur une distance qu on n a pas mesurée serait exactement
    // l invention que la regle du projet interdit.
    expect(verdict.kept.map((s) => s.id)).toEqual(['regate']);
    expect(verdict.dropped).toEqual([]);
    expect(verdict.toVerify).toHaveLength(1);
    expect(verdict.toVerify[0].rule).toBe('nautique_hors_rivage');
  });

  it('FS-07 : sans sonde injectée, une activité nautique reste à vérifier', async () => {
    const verdict = await verdictFor(fullDraft(), [step({ id: 'regate', title: 'Régate en mer' })]);

    expect(verdict.dropped).toEqual([]);
    expect(verdict.toVerify[0]?.reason).toBeTruthy();
  });

  it('FS-08 : des coordonnées hors de la plage terrestre sont retirées', async () => {
    const verdict = await verdictFor(fullDraft(), [
      step({ id: 'bogus', title: 'Escalier du ciel', lat: 145.2, lon: 6.8 }),
    ]);

    expect(verdict.kept).toEqual([]);
    expect(verdict.dropped[0]?.rule).toBe('coordonnees_hors_plage');
  });

  it('FS-09 : une longitude impossible est retirée elle aussi', async () => {
    const verdict = await verdictFor(fullDraft(), [
      step({ id: 'bogus', title: 'Point', lat: 45.9, lon: -900 }),
    ]);

    expect(verdict.dropped[0]?.rule).toBe('coordonnees_hors_plage');
  });

  it('FS-10 : un effectif minimum supérieur au groupe est impossible', async () => {
    const group = draftWithChildren(); // 2 adultes + 2 enfants = 4
    const verdict = await verdictFor(group, [
      step({ id: 'voilier', title: 'Sortie en voilier, minimum 6 personnes' }),
    ]);

    expect(verdict.kept).toEqual([]);
    expect(verdict.dropped[0]?.rule).toBe('effectif_insuffisant');
    expect(verdict.dropped[0]?.reason).toContain('6');
  });

  it('FS-11 : un effectif minimum compatible est conservé', async () => {
    const verdict = await verdictFor(draftWithChildren(), [
      step({ id: 'voilier', title: 'Sortie en voilier, minimum 4 personnes' }),
    ]);

    expect(verdict.kept.map((s) => s.id)).toEqual(['voilier']);
    expect(verdict.dropped).toEqual([]);
  });

  it('FS-12 : une activité encadrée est impossible sans adulte inscrit', async () => {
    const draft = fullDraft({ group: { mode: 'groupe', adults: 0, children: 3, hasPets: false, knownMembers: [] } });
    const verdict = await verdictFor(draft, [
      step({ id: 'course', title: 'Course encadrée par un moniteur' }),
    ]);

    expect(verdict.kept).toEqual([]);
    expect(verdict.dropped[0]?.rule).toBe('encadrement_adulte_manquant');
  });

  it('FS-13 : retirer une étape n entraine jamais les étapes voisines', async () => {
    const steps = [
      step({ id: 'ok1', day: 1, order: 1, title: 'Départ de Chamonix' }),
      step({ id: 'dive', day: 1, order: 2, title: 'Plongée autonome' }),
      step({ id: 'ok2', day: 1, order: 3, title: 'Pause au col' }),
    ];
    const verdict = await verdictFor(draftWithChildren(), steps);

    expect(verdict.kept.map((s) => s.id)).toEqual(['ok1', 'ok2']);
    expect(verdict.dropped.map((d) => d.stepId)).toEqual(['dive']);
  });

  it('FS-14 : le modèle renvoyé est renuméroté après retrait', async () => {
    const draft = draftWithChildren();
    const base = buildItinerary(draft);
    expect(base).not.toBeNull();
    if (!base) return;

    const polluted = {
      ...base,
      steps: [...base.steps, step({ id: 'dive', day: 1, order: 99, title: 'Plongée autonome' })],
    };
    const applied = await applyFeasibility(draft, polluted, {});

    expect(applied.model.steps.map((s) => s.id)).not.toContain('dive');
    // La numerotation est PAR JOURNEE : un trou y afficherait « 1, 3 » et
    // laisserait croire a une etape manquante.
    const days = [...new Set(applied.model.steps.map((s) => s.day))];
    for (const day of days) {
      const orders = applied.model.steps.filter((s) => s.day === day).map((s) => s.order);
      expect(orders).toEqual(orders.map((_, index) => index));
    }
    expect(applied.model.days).toBe(base.days);
  });

  it('FS-15 : la generation n affiche plus l étape refusée et conserve le motif', async () => {
    const outcome = await runItineraryGeneration(
      draftWithChildren(),
      new AbortController().signal,
      async () =>
        ({
          drafted: drafted({
            steps: [draftStep({ title: 'Plongée autonome' }), draftStep({ day: 1, title: 'Départ de Chamonix' })],
          }),
          failure: null,
        }),
      () => {},
      NO_MEASUREMENTS,
    );

    expect(outcome.model).not.toBeNull();
    expect(outcome.model?.steps.map((s) => s.title)).not.toContain('Plongée autonome');
    expect(outcome.infeasible.map((f) => f.rule)).toContain('plongee_avec_mineurs');
    expect(outcome.infeasible[0]?.reason).toBeTruthy();
  });

  it('FS-16 : si toute la proposition est refusée, on retombe sur le moteur de règles', async () => {
    const outcome = await runItineraryGeneration(
      draftWithChildren(),
      new AbortController().signal,
      async () => ({ drafted: drafted({ steps: [draftStep({ title: 'Plongée autonome' })] }), failure: null }),
      () => {},
      NO_MEASUREMENTS,
    );

    // Une écran vide serait un parcours inexistant : on montre le repli, et on
    // garde le motif affiché pour que la personne sache POURQUOI.
    expect(outcome.model).not.toBeNull();
    expect(outcome.engineId).toBe('rules');
    expect(outcome.infeasible).toHaveLength(1);
  });

  it('FS-17 : la distance mesurée exactement au seuil reste acceptable', async () => {
    const verdict = await verdictFor(fullDraft(), [step({ id: 'canoe', title: 'Kayak' })], {
      distanceToShoreKm: async () => 25,
    });

    // 25 km n est pas « loin du rivage » : rejeter ici serait un seuil arbitraire.
    expect(verdict.kept.map((s) => s.id)).toEqual(['canoe']);
  });

  it('FS-18 : une sonde qui lève ne fait pas tomber la génération', async () => {
    const verdict = await verdictFor(fullDraft(), [step({ id: 'canoe', title: 'Kayak' })], {
      distanceToShoreKm: async () => {
        throw new Error('provider 503');
      },
    });

    expect(verdict.kept.map((s) => s.id)).toEqual(['canoe']);
    expect(verdict.toVerify).toHaveLength(1);
  });

  it('FS-19 : rien n est Screené quand la liste est vide', async () => {
    const verdict = await verdictFor(fullDraft(), [], {});

    expect(verdict.kept).toEqual([]);
    expect(verdict.dropped).toEqual([]);
    expect(verdict.toVerify).toEqual([]);
  });
});
