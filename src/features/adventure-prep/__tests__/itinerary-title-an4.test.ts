import { describe, expect, it } from 'vitest';
import {
  itineraryOutputSchema,
  strictItineraryOutputSchema,
} from '@/lib/ai/features/itinerary';
import { assembleModel } from '../engine/itineraryPhases';
import { buildItinerary } from '../engine/itinerary';
import { materializeSteps, type DraftedItinerary, type DraftedStep } from '../engine/itineraryEngine';
import { fullDraft } from './fixtures';

/**
 * AN4 — le titre du parcours affiche « A verifier ».
 *
 * Cause racine relevee sur un vrai parcours : `draft.activities.primary` vaut
 * null (la personne n a rien coche a l etape 1) alors qu un itineraiire REEL de
 * deux jours existe. L ecran 3 affiche donc le repli « Ton aventure » puis
 * « A verifier » — alors que la duree, elle, est connue.
 *
 * Ces tests verrouillent deux choses :
 * 1. le modele peut nommer l aventure (donnee IA reelle, pas unilibre) ;
 * 2. le repli regles n invente JAMAIS de titre.
 */

const ETAPE: DraftedStep = {
  day: 1,
  kind: 'trajet',
  title: 'Depart de Chamonix',
  placeName: 'Chamonix',
  startTime: null,
  durationMin: null,
  reason: null,
};

function drafted(overrides: Partial<DraftedItinerary> = {}): DraftedItinerary {
  return {
    days: 2,
    steps: [ETAPE],
    hypotheses: [],
    title: null,
    ...overrides,
  };
}

const CORPS = {
  days: [1, 2],
  steps: [
    {
      day: 1,
      kind: 'trajet',
      title: 'Depart de Chamonix',
      placeName: 'Chamonix',
      startTime: null,
      durationMin: null,
      reason: null,
    },
  ],
  hypotheses: [],
};

describe('AN4 — le contrat de sortie accepte un titre', () => {
  it('lit un titre propose par le modele', () => {
    const parsed = strictItineraryOutputSchema.safeParse({ ...CORPS, title: 'Chamonix en deux jours' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.title).toBe('Chamonix en deux jours');
  });

  it('accepte une reponse sans titre : le champ reste optionnel', () => {
    const parsed = strictItineraryOutputSchema.safeParse(CORPS);
    expect(parsed.success).toBe(true);
  });

  it('accepte un titre explicite null plutot que de le rejeter', () => {
    const parsed = itineraryOutputSchema.safeParse({ ...CORPS, title: null });
    expect(parsed.success).toBe(true);
  });

  it('refuse un titre qui n est pas une etiquette courte', () => {
    const parsed = strictItineraryOutputSchema.safeParse({ ...CORPS, title: 'x'.repeat(81) });
    expect(parsed.success).toBe(false);
  });
});

describe('AN4 — le titre parcourt la chaine jusqu au modele', () => {
  it('assembleModel reprend le titre du modele', () => {
    const source = drafted({ title: 'Chamonix en deux jours' });
    const model = assembleModel(fullDraft(), source, materializeSteps(source, source.days));
    expect(model.title).toBe('Chamonix en deux jours');
  });

  it('un parcours sans titre reste sans titre : pas de repli invente', () => {
    const source = drafted({ title: null });
    const model = assembleModel(fullDraft(), source, materializeSteps(source, source.days));
    expect(model.title).toBeNull();
  });

  it('le repli regles ne fabrique aucun titre', () => {
    const model = buildItinerary(fullDraft());
    expect(model).not.toBeNull();
    expect(model?.title).toBeNull();
  });
});
