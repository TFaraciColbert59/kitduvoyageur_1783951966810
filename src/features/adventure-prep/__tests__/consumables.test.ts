import { describe, expect, it } from 'vitest';
import { mealNeeds, waterNeeds } from '../engine/consumables';
import { addStep, buildItinerary } from '../engine/itinerary';
import type { ItineraryModel } from '../types';
import { fullDraft } from './fixtures';

const model = (overrides: Parameters<typeof fullDraft>[0] = {}): ItineraryModel => {
  const built = buildItinerary(fullDraft(overrides));
  if (!built) throw new Error('modele attendu');
  return built;
};

describe('eau et repas', () => {
  it('relance la question de l\'eau pour chaque segment, sans quantite inventee', () => {
    const besoins = waterNeeds(model());
    expect(besoins.length).toBe(3);
    for (const need of besoins) {
      expect(need.litersPerPerson).toBeNull();
      expect(need.confidence).toBe('incertaine');
    }
  });

  it('rattache chaque besoin d\'eau a une etape reelle', () => {
    const built = model();
    const ids = new Set(built.steps.map((s) => s.id));
    for (const need of waterNeeds(built)) expect(ids.has(need.stepId)).toBe(true);
  });

  it('passe a « fiable » des qu\'un point de ravitaillement existe', () => {
    const built = addStep(model(), 2, 'ravitaillement', { title: 'Ravitaillement' });
    const jour2 = waterNeeds(built).find((w) => w.stepId.startsWith('d2'));
    expect(jour2?.confidence).toBe('fiable');
  });

  it('n\'invente jamais de point de rechange', () => {
    for (const need of waterNeeds(model())) {
      expect(need.alternativePlaceName).toBeNull();
    }
  });

  it('liste les trois repas de chaque journee', () => {
    const repas = mealNeeds(model());
    expect(repas).toHaveLength(9);
    expect(repas.filter((r) => r.day === 1).map((r) => r.slot)).toEqual([
      'petit_dejeuner',
      'dejeuner',
      'diner',
    ]);
  });

  it('laisse un repas non couvert tant que personne ne l\'a relie a une etape', () => {
    const besoin = mealNeeds(model()).find((r) => r.day === 1 && r.slot === 'diner');
    expect(besoin?.coveredByStepId).toBeNull();
    expect(besoin?.label.length).toBeGreaterThan(0);
  });

  it('couvre un repas des qu\'une etape de ravitaillement la porte', () => {
    const built = addStep(model(), 1, 'ravitaillement', {
      title: 'Déjeuner au refuge',
      mealSlot: 'dejeuner',
    });
    const besoin = mealNeeds(built).find((r) => r.day === 1 && r.slot === 'dejeuner');
    expect(besoin?.coveredByStepId).not.toBeNull();
    const petit = mealNeeds(built).find((r) => r.day === 1 && r.slot === 'petit_dejeuner');
    expect(petit?.coveredByStepId).toBeNull();
  });

  it('reste calme quand le parcours n\'existe pas encore', () => {
    const vide = buildItinerary(
      fullDraft({ activities: { primary: null, extra: [], nights: [] } }),
    );
    expect(vide).toBeNull();
    expect(waterNeeds(null)).toEqual([]);
    expect(mealNeeds(null)).toEqual([]);
  });
});
