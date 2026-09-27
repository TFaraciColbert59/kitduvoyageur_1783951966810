import { describe, expect, it } from 'vitest';
import type { AdventurePrepDraft } from '../types';
import { buildItinerary } from '../engine/itinerary';
import {
  canOpenStep,
  firstUnsatisfiedStep,
  isStepSatisfied,
  progressOf,
  stepCountDone,
} from '../engine/steps';
import { draftWithoutItineraryInput, fullDraft } from './fixtures';

describe('progression des etapes', () => {
  it('compte trois etapes, jamais un pourcentage', () => {
    const progress = progressOf(fullDraft());
    expect(progress.total).toBe(3);
    expect(progress.current).toBe(1);
    expect(progress.label).toBe('Étape 1 sur 3');
    expect(JSON.stringify(progress)).not.toContain('%');
  });

  it('considere l\'etape destination satisfaite avec activite, depart et duree', () => {
    expect(isStepSatisfied(fullDraft(), 'destination')).toBe(true);
    expect(isStepSatisfied(draftWithoutItineraryInput(), 'destination')).toBe(false);
  });

  it('bloque une etape tant que la precedente n\'est pas satisfaite', () => {
    const vide = fullDraft({ activities: { primary: null, extra: [], nights: [] } });
    expect(canOpenStep(vide, 'itinerary')).toBe(false);
    expect(canOpenStep(vide, 'departure')).toBe(false);
    expect(canOpenStep(fullDraft(), 'itinerary')).toBe(true);
  });

  it('donne la premiere etape non satisfaite', () => {
    expect(firstUnsatisfiedStep(fullDraft())).toBe('itinerary');
    const model = buildItinerary(fullDraft());
    const avecModele = fullDraft({ itinerary: model });
    expect(firstUnsatisfiedStep(avecModele)).toBe('departure');
  });

  it('compte les etapes terminees sans compter deux fois', () => {
    const draft: AdventurePrepDraft = fullDraft({ completedSteps: ['destination', 'destination'] });
    expect(stepCountDone(draft)).toBe(1);
  });
});
