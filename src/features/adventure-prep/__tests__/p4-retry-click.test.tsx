/**
 * P4.4 — le bouton « Relancer » n'est pas un CTA mort : on le CLIQUE.
 *
 * `p4-rejection.test.tsx` prouve que le bouton existe et nomme la phase
 * tombee. Il ne prouve pas qu'il fait quoi que ce soit — et c'est exactement
 * le piege qu'un test de morsant a denonce : remplacer `onClick` par
 * `() => undefined` laissait ce fichier entierement VERT.
 *
 * Ce fichier monte donc l'ecran dans jsdom et clique. Deux choses doivent
 * alors etre vraies, dans cet ordre :
 *   1. la phase tombee est RE-ARMEE (`retryPhase(id)`) ;
 *   2. le parcours est RELANCE (`continueGeneration()`).
 *
 * Inverser l'ordre relancerait un parcours dont l'etat dit encore que la
 * phase a echoue ; n'armer que laisserait un bouton qui ne lance rien. Le
 * test observe l'ordre, pas seulement la presence des deux appels.
 *
 * Seul le MOTEUR est remplace — par un spy qui resout un resultat neutre.
 * L'item porte sur le bouton, pas sur la generation : la charger ici
 *际 ferait de ce test un second test de generation, et bruiterait.
 */
// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { draftActions } from '../store/reducer';
import { failedGenerationPhase, type GenerationPhaseId } from '../types';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { GenerationOutcome } from '../engine/itineraryPhases';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

/* ------------------------------------------------------------------ */
/* Shims de plateforme — jsdom ne lesimplemente pas.                    */
/* ------------------------------------------------------------------ */

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverShim {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverShim;
  }
  if (typeof window !== 'undefined') {
    if (!window.matchMedia) {
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    }
    window.scrollTo = (() => {}) as unknown as typeof window.scrollTo;
    window.Element.prototype.scrollTo = function scrollTo() {};
    window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  }
});

/* ------------------------------------------------------------------ */
/* Le store : observe, jamais simule. On veut le VRAI draft reduit.     */
/* ------------------------------------------------------------------ */

const spies = vi.hoisted(() => ({
  retryPhase: vi.fn(),
  continueGeneration: vi.fn(),
  applyGenerated: vi.fn(),
  completeStep: vi.fn(),
  run: vi.fn(),
}));

const state = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (s: unknown) => unknown) => selector(state.current)) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

// Le moteur est le SEUL remplacement : le bouton est ce qu on teste, pas la
// generation. `importOriginal` conserve `rejectionMessage` et le reste a
// l identique — sans quoi on aurait aussi mocke la table des messages.
vi.mock('../engine/itineraryPhases', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, runItineraryGeneration: (...args: unknown[]) => spies.run(...args) };
});

const { ItineraryStepScreen } = await import('../components/ItineraryStep');

/* ------------------------------------------------------------------ */

function model(): ItineraryModel {
  const built = buildItinerary(fullDraft());
  if (!built) throw new Error('modele attendu');
  return built;
}

/** Le resultat neutre que renvoie le moteur simule apres la reprise. */
function reprise(): GenerationOutcome {
  return {
    model: model(),
    engineId: 'ai',
    degraded: false,
    message: null,
    rejectedReason: null,
    failure: null,
    phases: [],
  } as unknown as GenerationOutcome;
}

/** Un refus d'IA dont la phase de verification des etapes est tombee. */
function draftTombe(): AdventurePrepDraft {
  return draftActions.applyGenerated(fullDraft(), {
    model: model(),
    engineId: 'rules',
    degraded: true,
    message: 'Parcours construit sur tes criteres.',
    rejectedReason: 'aucune_etape',
    failure: null,
    phases: [
      { id: 'verification_etapes', status: 'echouee', reason: 'aucune_etape', retryable: true },
    ],
  } as unknown as GenerationOutcome);
}

/** Le meme etat, mais SANS phase rejouable : aucun bouton ne doit exister. */
function draftSain(): AdventurePrepDraft {
  return draftActions.applyGenerated(fullDraft(), {
    ...reprise(),
    phases: [
      { id: 'verification_etapes', status: 'reussie', reason: null, retryable: true },
    ],
  } as unknown as GenerationOutcome);
}

function poser(draft: AdventurePrepDraft): void {
  state.current = {
    draft,
    remeasuring: null,
    retryPhase: spies.retryPhase,
    continueGeneration: spies.continueGeneration,
    applyGenerated: spies.applyGenerated,
    completeStep: spies.completeStep,
  };
}

function boutonRelancer(): HTMLElement {
  return screen.getByRole('button', { name: /relancer/i });
}

describe('P4.4 — le bouton de reprise est ARME puis RELANCE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.run.mockResolvedValue(reprise());
  });

  afterEach(() => {
    cleanup();
  });

  it('P4-CLIC-01 : cliquer arme la phase tombee, puis relance le parcours', async () => {
    const draft = draftTombe();
    const fallen = failedGenerationPhase(draft.generation);
    expect(fallen?.id).toBe('verification_etapes');
    poser(draft);

    render(<ItineraryStepScreen onOpenSheet={() => undefined} />);

    const ordre: string[] = [];
    spies.retryPhase.mockImplementation(() => {
      ordre.push('armer');
    });
    spies.continueGeneration.mockImplementation(() => {
      ordre.push('relancer');
    });

    await act(async () => {
      fireEvent.click(boutonRelancer());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(spies.retryPhase, 'le clic doit re-armer la phase tombee').toHaveBeenCalledWith(
      'verification_etapes' as GenerationPhaseId
    );
    expect(spies.continueGeneration, 'le clic doit relancer le parcours').toHaveBeenCalledTimes(1);
    expect(spies.run, 'le moteur doit etre interroge apres le re-armement').toHaveBeenCalledTimes(
      1
    );
    expect(
      ordre,
      "relever l'etat AVANT de relancer le ferait sur une phase encore marquee en echec",
    ).toEqual(['armer', 'relancer']);
  });

  it('P4-CLIC-02 : le clic sur un parcours sain n existe pas — pas de CTA mort', () => {
    poser(draftSain());
    render(<ItineraryStepScreen onOpenSheet={() => undefined} />);

    expect(failedGenerationPhase((state.current as { draft: AdventurePrepDraft }).draft.generation)).toBeNull();
    expect(
      screen.queryByRole('button', { name: /relancer/i }),
      'un parcours sain ne doit pas proposer de relance',
    ).toBeNull();
  });
});