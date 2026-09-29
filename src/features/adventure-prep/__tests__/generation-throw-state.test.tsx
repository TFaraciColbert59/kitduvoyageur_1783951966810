// @vitest-environment jsdom
/**
 * AI-P0.5 — une generation qui LEVE ne doit pas laisser le store en `en_cours`.
 *
 * Mesure du 2026-09-29 (`provider-failover.test.ts` pour le contexte) : le rail
 * restait bloque indefiniment, aucun message, aucun bouton. La cause n etait pas
 * le reseau : `startRun` avait un `try { ... } finally { ... }` et AUCUN
 * `catch`. Une levee — et une levee suffit — sortait de la fonction sans jamais
 * appeler `failGenerationRun`. Le `finally` liberait bien le controleur, donc
 * l ecran se croyait libre, mais le statut restait `en_cours` : plus aucun
 * lancement possible (`shouldLaunchGeneration` refuse un statut en cours sans
 * run vivant… et le run n existait plus), plus aucun echec affiche, plus
 * aucune sortie. Un etat terminal qui n est ni un succes ni un echec.
 *
 * Le parcours mesure ne levait pas encore — c est ce qui a laisse le defaut
 * dormir. Un store qui ne sait pas dire « j ai echoue » est un store qui
 * mentra au premier incident de production.
 *
 * Ces testsersistent sur le cycle COMPLET : montage → effet de lancement →
 * levee → etat du store. Ils ne verifient pas le rendu.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { GENERATION_PHASES, markPhaseDone, startGeneration } from '../engine/generation';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, GenerationState } from '../types';

const etat = vi.hoisted(() => ({
  store: null as Record<string, unknown> | null,
  marquees: [] as string[],
}));

/**
 * Le store est remplace par un etat REELLEMENT mutable : le statut doit
 * changer sous les yeux du composant, sinon le test ne verrait qu un mock qui
 * ne sait rien et ne pourrait pas distinguer « echec nomme » de « silence ».
 * Les actions que l ecran n appelle pas ici sont des no-ops : elles ne
 * participeraient qu a du bruit.
 */
vi.mock('../store/useAdventurePrepStore', () => {
  const store = {
    draft: null as AdventurePrepDraft | null,
    remeasuring: null,
    startGenerationRun() {
      store.draft = { ...(store.draft as AdventurePrepDraft), generation: startGeneration(store.draft!.generation) };
    },
    continueGeneration() {
      store.draft = { ...(store.draft as AdventurePrepDraft), generation: store.draft!.generation };
    },
    markPhase() {
      /* pas utile ici : le defaut porte sur l ISSUE, pas sur le detail */
    },
    stopGeneration() {
      store.draft = { ...(store.draft as AdventurePrepDraft), generation: { ...store.draft!.generation, status: 'interrompu' } };
    },
    failGenerationRun(message: string) {
      etat.marquees.push(message);
      store.draft = {
        ...(store.draft as AdventurePrepDraft),
        generation: { ...store.draft!.generation, status: 'echec', error: message },
      };
    },
    applyGenerated() {
      /* un succes n est pas le scenario de ce fichier */
    },
    addStepToDay() {},
    addWaypoint() {},
    keepStep() {},
    linkMeal() {},
    dropStep() {},
    adjust() {},
    setPacked() {},
    setGearWeight() {},
    assignGear() {},
    syncGear() {},
    remeasure: async () => undefined,
  };
  etat.store = store;
  const use = ((selector: (s: unknown) => unknown) => selector(store)) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => store;
  return { useAdventurePrepStore: use };
});

const runItineraryGeneration = vi.hoisted(() => vi.fn());
vi.mock('../engine/itineraryPhases', async (importOriginal) => {
  const reel = await importOriginal<typeof import('../engine/itineraryPhases')>();
  return { ...reel, runItineraryGeneration };
});

vi.mock('../placeSource', () => ({
  anchorsOf: () => [],
  loadPlaceInventoryFor: () => async () => ({ places: [], truncated: false }),
  resolvePlacesFor: () => async () => null,
  warmAmenitiesFor: () => undefined,
}));

vi.mock('../browserMeasurements', () => ({
  browserMeasurementRunners: () => ({}),
}));

vi.mock('@/app/prepare/actions', () => ({ fetchItineraryProposal: vi.fn() }));

function initial(): GenerationState {
  return {
    status: 'idle',
    phases: GENERATION_PHASES.map((p) => ({ ...p, done: false })),
    steps: [],
    days: 0,
    error: null,
    notice: null,
    failure: null,
    rejectedReason: null,
    outcomes: [],
  };
}

/** Un brouillon reelement constructible, generation encore `idle`. */
function brouillon(): AdventurePrepDraft {
  let generation: GenerationState = startGeneration(initial());
  generation = markPhaseDone(generation, 'recherche_parcours');
  // On rebascule a `idle` : c est l etat d arrivee de l etape 1, celui qui
  // declenche le lancement automatique.
  generation = { ...generation, status: 'idle' };
  return fullDraft({ itinerary: null, generation });
}

const noop = () => undefined;

beforeEach(() => {
  etat.marquees = [];
  runItineraryGeneration.mockReset();
  etat.store!.draft = brouillon();
});

/** Le statut que l utilisateur voit sur le rail. */
function statut(): string {
  return (etat.store!.draft as AdventurePrepDraft).generation.status;
}

describe('AI-P0.5 — une generation qui leve laisse un etat, jamais un silence', () => {
  it('AI-P0.5a le run demarre bien depuis l etat idle', async () => {
    runItineraryGeneration.mockResolvedValue({ model: null, days: [], steps: [] });
    render(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
    await waitFor(() => expect(runItineraryGeneration).toHaveBeenCalled());
    cleanup();
  });

  it('AI-P0.5b une levee conduit a un echec nomme, pas a un statut fige', async () => {
    runItineraryGeneration.mockRejectedValue(new Error('panne du moteur'));
    render(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
    await waitFor(() => expect(etat.marquees.length).toBeGreaterThan(0));
    expect(etat.marquees[0]).toContain('panne du moteur');
    expect(statut()).not.toBe('en_cours');
    cleanup();
  });

  it('AI-P0.5c le store recoit exactement une issue, jamais zero', async () => {
    // Zero issue = le statut reste `en_cours` pour toujours. C est le defaut.
    runItineraryGeneration.mockRejectedValue(new Error('panne du moteur'));
    render(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
    await waitFor(() => expect(runItineraryGeneration).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(etat.marquees.length).toBe(1);
    expect(statut()).toBe('echec');
    cleanup();
  });

  it('AI-P0.5d une levee ne fait pas planter le rendu', async () => {
    runItineraryGeneration.mockRejectedValue(new Error('panne du moteur'));
    expect(() =>
      render(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }))
    ).not.toThrow();
    await waitFor(() => expect(etat.marquees.length).toBeGreaterThan(0));
    cleanup();
  });
});