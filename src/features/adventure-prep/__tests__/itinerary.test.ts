import { describe, expect, it } from 'vitest';
import {
  addStep,
  buildItinerary,
  daySteps,
  isBuildable,
  knownGaps,
  setStepKept,
  stepById,
} from '../engine/itinerary';
import type { ItineraryModel } from '../types';
import { draftWithoutItineraryInput, fullDraft } from './fixtures';

const model = (): ItineraryModel => {
  const built = buildItinerary(fullDraft());
  if (!built) throw new Error('modele attendu');
  return built;
};

describe('proposition de parcours', () => {
  it('ne construit rien sans activite principale', () => {
    expect(isBuildable(draftWithoutItineraryInput())).toBe(false);
    expect(buildItinerary(draftWithoutItineraryInput())).toBeNull();
  });

  it('ne construit rien sans point de depart', () => {
    const draft = fullDraft();
    const sansDepart = { ...draft, route: { ...draft.route, origin: null } };
    expect(buildItinerary(sansDepart)).toBeNull();
  });

  it('ne construit rien sans duree choisie', () => {
    const draft = fullDraft();
    const sansDuree = { ...draft, calendar: { ...draft.calendar, durationDays: null } };
    expect(buildItinerary(sansDuree)).toBeNull();
  });

  it('utilise la duree choisie par la personne, jamais une duree inventee', () => {
    expect(model().days).toBe(3);
    const long = buildItinerary(
      fullDraft({ calendar: { startDate: '2026-07-11', durationDays: 6, durationIsSuggested: true, returnDate: '2026-07-16' } }),
    );
    expect(long?.days).toBe(6);
  });

  it('place un trajet le premier jour, entre le depart et l\'arrivee', () => {
    const steps = model().steps;
    const premier = steps[0];
    expect(premier.kind).toBe('trajet');
    expect(premier.day).toBe(1);
    expect(premier.placeName).toBe('Chamonix');
  });

  it('donne des identifiants uniques et un ordre continu par jour', () => {
    const steps = model().steps;
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    for (const day of [1, 2, 3]) {
      const ordre = daySteps(model(), day).map((s) => s.order);
      expect(ordre).toEqual(ordre.map((_, i) => i));
    }
  });

  it('propose une nuit par journee terminee, jamais pour le dernier soir', () => {
    const nuits = model().steps.filter((s) => s.kind === 'nuit');
    expect(nuits).toHaveLength(2);
    expect(nuits.map((n) => n.day)).toEqual([1, 2]);
    expect(nuits.every((n) => n.state === 'a_reserver')).toBe(true);
  });

  it('ajoute une pause de repos quand le rythme ou les enfants l\'imposent', () => {
    const tranquille = buildItinerary(
      fullDraft({ preferences: { ...fullDraft().preferences, pace: 'tranquille' } }),
    );
    expect(tranquille?.steps.some((s) => s.kind === 'repos')).toBe(true);
    const rapide = buildItinerary(
      fullDraft({ preferences: { ...fullDraft().preferences, pace: 'rapide' } }),
    );
    expect(rapide?.steps.some((s) => s.kind === 'repos')).toBe(false);
  });

  it('laisse les donnees de terrain inconnues a null, jamais a zero', () => {
    const built = model();
    expect(built.totals.distanceKm).toBeNull();
    expect(built.totals.elevGainM).toBeNull();
    expect(built.totals.movingMin).toBeNull();
    expect(built.perDay).toHaveLength(3);
    expect(built.perDay.every((d) => d.distanceKm === null)).toBe(true);
    for (const step of built.steps) {
      expect(step.durationMin).toBeNull();
      expect(step.price.amount).toBeNull();
    }
  });

  it('reprend le budget saisi, sinon le laisse a verifier', () => {
    expect(model().budgetPerPerson).toEqual({
      amount: 90,
      currency: 'EUR',
      state: 'propose',
    });
    const sansBudget = buildItinerary(
      fullDraft({ preferences: { ...fullDraft().preferences, budgetPerPerson: null } }),
    );
    expect(sansBudget?.budgetPerPerson.amount).toBeNull();
    expect(sansBudget?.budgetPerPerson.state).toBe('a_reserver');
  });

  it('reprend le contexte de metrique et compte les activites', () => {
    const built = model();
    expect(built.metricsContext).toBe('terrain');
    expect(built.activityCount).toBe(1);
  });

  it('declare ce qui manque plutot que de le deviner', () => {
    const gaps = knownGaps(model());
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((g) => typeof g.label === 'string' && g.label.length > 2)).toBe(true);
    expect(JSON.stringify(gaps)).not.toContain('0 km');
  });

  it('ne modifie jamais le modele d\'origine', () => {
    const avant = model();
    const copie = JSON.stringify(avant);
    addStep(avant, 1, 'arret', { title: 'Pause' });
    setStepKept(avant, avant.steps[0].id, true);
    expect(JSON.stringify(avant)).toBe(copie);
  });

  it('ajoute une etape a un jour donne sans toucher aux autres', () => {
    const built = model();
    const avant = daySteps(built, 2).length;
    const suivant = addStep(built, 2, 'ravitaillement', { title: 'Ravitaillement' });
    expect(daySteps(suivant, 2)).toHaveLength(avant + 1);
    expect(daySteps(suivant, 1)).toHaveLength(daySteps(built, 1).length);
    const added = daySteps(suivant, 2).at(-1);
    expect(stepById(suivant, added!.id)).toBeDefined();
  });

  it('marque une etape comme a conserver', () => {
    const built = model();
    const cible = built.steps[0];
    const suivant = setStepKept(built, cible.id, true);
    expect(stepById(suivant, cible.id)?.kept).toBe(true);
    expect(stepById(built, cible.id)?.kept).toBe(false);
  });
});
