import { describe, it, expect } from 'vitest';
import { PREP_STEPS, PREP_STEP_LABELS, type PrepStepId } from '../types';
import { canOpenStep } from '../engine/steps';
import { fullDraft } from './fixtures';

/**
 * Le fil d'Ariane remplace le « Étape 1 sur 3 » : trois segments nommés, un
 * actif. C'est la maquette qui fait foi — un compteur ne dit pas ou l'on est.
 */
describe('Fil d’Ariane — segments', () => {
  it('NA-01: les trois étapes sont nommées dans l’ordre', () => {
    expect(PREP_STEPS).toEqual(['destination', 'itinerary', 'departure']);
    expect(PREP_STEP_LABELS.destination).toBe('Destination');
    expect(PREP_STEP_LABELS.itinerary).toBe('Parcours');
    expect(PREP_STEP_LABELS.departure).toBe('Départ');
  });

  it('NA-02: le libellé d’un segment est celui de son étape', () => {
    const labels = PREP_STEPS.map((id: PrepStepId) => PREP_STEP_LABELS[id]);
    expect(labels).toEqual(['Destination', 'Parcours', 'Départ']);
  });
});

describe('Fil d’Ariane — ce qui est atteignable', () => {
  it('NA-03: on peut revenir d’une étape, jamais en avancer d’une', () => {
    const draft = fullDraft({ completedSteps: ['destination', 'itinerary'] });
    expect(canOpenStep(draft, 'destination')).toBe(true);
    expect(canOpenStep(draft, 'departure')).toBe(false);
  });

  it('NA-04: tant que la destination n’est pas remplie, l’étape 2 reste fermée', () => {
    const draft = fullDraft({ route: { origin: null, destination: null, shape: 'boucle' } });
    expect(canOpenStep(draft, 'itinerary')).toBe(false);
    expect(canOpenStep(draft, 'destination')).toBe(true);
  });

  it('NA-06: l’étape 2 s’ouvre dès que la destination est complète', () => {
    // C’est là que le parcours se construit : elle ne peut pas exiger un
    // itinéraire qui n’existe pas encore.
    expect(canOpenStep(fullDraft(), 'itinerary')).toBe(true);
  });

  it('NA-05: la toute première étape reste toujours ouverte', () => {
    expect(canOpenStep(fullDraft(), 'destination')).toBe(true);
  });
});