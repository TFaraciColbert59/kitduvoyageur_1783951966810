/**
 * Passage de l'etape 1 a l'etape 2 — la decision qui decide si l'IA tourne.
 *
 * Ces tests verrouillent une regression precise et observee : le bouton
 * « Creer mon parcours » construisait un parcours par les REGLES et sautait
 * l'etape 2. L'ecran arrivait donc toujours avec un modele deja present, la
 * generation IA n'etait jamais demandee, et l'utilisateur voyait un parcours
 * generique sans jamais apprendre qu'aucune IA n'avait repondu.
 */

import { describe, it, expect } from 'vitest';
import { shouldLaunchGeneration } from '../engine/stepTransition';
import { startGeneration, initialGeneration, markPhaseDone, finishGeneration, failGeneration } from '../engine/generation';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft, draftWithoutItineraryInput } from './fixtures';
import type { AdventurePrepDraft } from '../types';

function withGeneration(
  draft: AdventurePrepDraft,
  next: (state: ReturnType<typeof initialGeneration>) => ReturnType<typeof initialGeneration>,
): AdventurePrepDraft {
  return { ...draft, generation: next(draft.generation) };
}

describe('ST — le passage a l etape 2 doit lancer la generation', () => {
  it('ST-01: un brouillon complet sans parcours lance la generation', () => {
    const draft = fullDraft({ itinerary: null, generation: initialGeneration() });
    expect(shouldLaunchGeneration(draft)).toBe(true);
  });

  it('ST-02: un parcours deja construit ne relance rien', () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    expect(model).not.toBeNull();
    expect(shouldLaunchGeneration({ ...draft, itinerary: model })).toBe(false);
  });

  it('ST-03: une generation en cours sur cet ecran ne se relance pas elle-meme', () => {
    const draft = withGeneration(
      fullDraft({ itinerary: null }),
      startGeneration,
    );
    expect(shouldLaunchGeneration(draft, { live: true })).toBe(false);
  });

  it('ST-04: une generation terminee ne se relance pas toute seule', () => {
    const draft = withGeneration(
      fullDraft({ itinerary: null }),
      (state) => markPhaseDone(finishGeneration(state), 'synthese'),
    );
    expect(shouldLaunchGeneration(draft)).toBe(false);
  });

  it('ST-05: un brouillon incomplet ne lance rien — l ecran doit le dire', () => {
    const draft = draftWithoutItineraryInput({ itinerary: null, generation: initialGeneration() });
    expect(shouldLaunchGeneration(draft)).toBe(false);
  });

  it('ST-06: une generation en echec ne relance rien tout seul, il faut un clic', () => {
    const draft = withGeneration(
      fullDraft({ itinerary: null }),
      (state) => failGeneration(state, 'casse'),
    );
    expect(shouldLaunchGeneration(draft)).toBe(false);
  });

  it('ST-07: la decision ne mute jamais le brouillon', () => {
    const draft = fullDraft({ itinerary: null, generation: initialGeneration() });
    const avant = JSON.stringify(draft);
    shouldLaunchGeneration(draft);
    expect(JSON.stringify(draft)).toBe(avant);
  });

/* ------------------------------------------------------------------ */
/* ST-08 a ST-12 : un remontage ne doit jamais laisser la generation morte  */
/* ------------------------------------------------------------------ */

describe('relance apres un remontage de l ecran', () => {
  it('ST-08 relance quand le statut est « en_cours » mais qu aucune generation ne tourne', () => {
    const draft = withGeneration(fullDraft({ itinerary: null }), startGeneration);
    expect(shouldLaunchGeneration(draft, { live: false })).toBe(true);
  });


  it('ST-10 ne relance jamais une generation arretee par l utilisateur', () => {
    const draft = withGeneration(fullDraft({ itinerary: null }), (state) => ({ ...state, status: 'interrompu' }));
    expect(shouldLaunchGeneration(draft, { live: false })).toBe(false);
  });

  it('ST-11 ne relance jamais une generation en echec : c est le bouton qui decide', () => {
    const draft = withGeneration(fullDraft({ itinerary: null }), (state) => failGeneration(state, 'reseau'));
    expect(shouldLaunchGeneration(draft, { live: false })).toBe(false);
  });

  it('ST-12 un brouillon non constructible ne relance rien, meme apres un remontage', () => {
    const partial = draftWithoutItineraryInput();
    const draft = withGeneration(partial, startGeneration);
    expect(shouldLaunchGeneration(draft, { live: false })).toBe(false);
  });
});
});
