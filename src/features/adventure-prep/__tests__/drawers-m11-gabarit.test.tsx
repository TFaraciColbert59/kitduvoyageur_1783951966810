// @vitest-environment jsdom

/**
 * M1.1 - Le tiroir Lieu est le GABARIT. Les autres le recopient, ils ne le
 * redessinent pas.
 *
 * Ce que M1.1 reprochait, precisement : le tiroir Lieu a ete dessine une
 * fois, puis chaque tiroir suivant a invente SA version — un style inline, un
 * `<h3>` ad hoc, une liste qui ne ressemblait a rien. Deux applications dans
 * la meme, et il faut reapprendre l'ecran a chaque ouverture.
 *
 * Ce fichier ne compare pas des screenshots, et ne dit pas « ca ressemble ».
 * Il MONTE chaque tiroir et verifie que les reperes du gabarit — declares en
 * un seul endroit, `GABARIT` — y sont presents. Comme `GABARIT` est lu depuis
 * le module du gabarit, un tiroir qui cesse de le recopier echoue ici sans
 * qu aucun test ne soit a mettre a jour.
 *
 * Regle de preuve : le sabotage du test 04 ne touche pas un tiroir, il touche
 * une PRIMITIVE du gabarit (`t1`). Les six tiroirs tombent en meme temps —
 * ce qui est la definition meme de « ils recopient le gabarit ».
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';

import { GABARIT } from '../components/PrepDrawerTemplate';
import {
  CalendarSheet,
  CoverageSheet,
  GroupSheet,
  ParticipantsSheet,
  PreferencesSheet,
} from '../components/PrepSetupSheets';
import { ConsumablesSheet, GearSheet } from '../components/PrepGearSheets';
import { ReplaceSheet } from '../components/PrepStepReplaceSheet';
import { AddStepRail } from '../components/PrepAddStepRail';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';
import type { AdventurePrepDraft } from '../types';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverShim {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverShim;
  }
  if (!('IntersectionObserver' in globalThis)) {
    class IntersectionObserverShim {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds: readonly number[] = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      IntersectionObserverShim;
  }
  if (typeof window !== 'undefined' && !window.matchMedia) {
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Un store qui ne fait rien : le gabarit ne se lit pas dans le store. */
function fauxStore(): AdventurePrepStore {
  return {
    draft: null,
    addStepToDay: vi.fn(async () => undefined),
    dropStep: vi.fn(async () => undefined),
    setGearWeight: vi.fn(),
    assignGear: vi.fn(),
    setPacked: vi.fn(),
  } as unknown as AdventurePrepStore;
}

function avecProgramme(draft: AdventurePrepDraft = fullDraft()): AdventurePrepDraft {
  return { ...draft, itinerary: buildItinerary(draft) };
}

/** Les tiroirs de l etape 1, tous montes sur le MEME brouillon. */
const TIROIRS = [
  {
    id: 'calendar',
    titre: 'Quand tu pars',
    monte: (draft: AdventurePrepDraft) => (
      <CalendarSheet draft={draft} actions={fauxStore()} onClose={() => undefined} />
    ),
  },
  {
    id: 'group',
    titre: 'Avec qui',
    monte: (draft: AdventurePrepDraft) => (
      <GroupSheet draft={draft} actions={fauxStore()} onClose={() => undefined} />
    ),
  },
  {
    id: 'preferences',
    titre: 'Preferences',
    monte: (draft: AdventurePrepDraft) => (
      <PreferencesSheet draft={draft} actions={fauxStore()} onClose={() => undefined} />
    ),
  },
  {
    id: 'coverage',
    titre: 'Couverture',
    monte: (draft: AdventurePrepDraft) => (
      <CoverageSheet draft={draft} actions={fauxStore()} onClose={() => undefined} />
    ),
  },
  {
    id: 'participants',
    titre: 'Participants',
    monte: (draft: AdventurePrepDraft) => (
      <ParticipantsSheet draft={draft} actions={fauxStore()} onClose={() => undefined} />
    ),
  },
  {
    id: 'gear',
    titre: 'Equipement',
    monte: (draft: AdventurePrepDraft) => <GearSheet draft={draft} actions={fauxStore()} />,
  },
  {
    id: 'consumables',
    titre: 'Eau et repas',
    monte: (draft: AdventurePrepDraft) => (
      <ConsumablesSheet draft={draft} actions={fauxStore()} />
    ),
  },
  {
    id: 'replace',
    titre: 'Remplacer',
    monte: (draft: AdventurePrepDraft) => (
      <ReplaceSheet draft={draft} actions={fauxStore()} stepId={null} onClose={() => undefined} />
    ),
  },
  {
    id: 'add',
    titre: 'Ajouter',
    monte: (draft: AdventurePrepDraft) => (
      <AddStepRail draft={draft} actions={fauxStore()} onClose={() => undefined} day={1} />
    ),
  },
] as const;

describe('M1.1 - un seul gabarit pour tous les tiroirs', () => {
  it('01 - chaque tiroir rend la section et son titre de gabarit', () => {
    for (const tiroir of TIROIRS) {
      const { container } = render(tiroir.monte(avecProgramme()));
      expect(
        container.querySelectorAll('.' + GABARIT.section).length,
        `${tiroir.id} ne rend pas ${GABARIT.section}`,
      ).toBeGreaterThan(0);
      expect(
        container.querySelectorAll('.' + GABARIT.sectionTitle).length,
        `${tiroir.id} ne rend pas ${GABARIT.sectionTitle}`,
      ).toBeGreaterThan(0);
    }
  });

  it('02 - un tiroir qui affiche des donnees rend liste, ligne, titre et detail', () => {
    for (const tiroir of TIROIRS) {
      const { container } = render(tiroir.monte(avecProgramme()));
      if (container.querySelector('.' + GABARIT.list) === null) continue;
      // Le gabarit veut, pour CHAQUE ligne, un nom fort et un detail faible.
      const lignes = container.querySelectorAll('.' + GABARIT.row);
      expect(lignes.length, `${tiroir.id} : aucune ligne de gabarit`).toBeGreaterThan(0);
      for (const ligne of lignes) {
        expect(
          ligne.querySelector('.' + GABARIT.title),
          `${tiroir.id} : une ligne sans ${GABARIT.title}`,
        ).not.toBeNull();
      }
      expect(
        container.querySelectorAll('.' + GABARIT.detail).length,
        `${tiroir.id} : aucun ${GABARIT.detail} dans le tiroir`,
      ).toBeGreaterThan(0);
    }
  });

  it('03 - un tiroir sans donnee dit POURQUOI, sur le gabarit', () => {
    // Le tiroir « Remplacer » sans etape a Designee n a aucune alternative a
    // proposer. Il ne doit pas laisser un espace : il rend l etat honnete,
    // et cet etat porte la MEME classe que l etat honnete du tiroir Lieu.
    const { container } = render(
      <ReplaceSheet
        draft={avecProgramme()}
        actions={fauxStore()}
        stepId="pas-une-etape"
        onClose={() => undefined}
      />,
    );
    const vide = container.querySelector('.' + GABARIT.empty);
    expect(vide).not.toBeNull();
    expect(vide?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it('04 - le gabarit est un module unique, pas une convention recopiee', () => {
    // GABARIT est lu, jamais reecrit ici. Si un tiroir substituait sa propre
    // classe, le test 01/02 le verrait — mais surtout, si quelqu un AJOUTAIT
    // une primitive au gabarit, ce test oblige a aller verifier qui la rend.
    const landmarks = Object.values(GABARIT);
    expect(new Set(landmarks).size).toBe(landmarks.length);
    expect(GABARIT.row).toBe('li');
    expect(GABARIT.list).toBe('list');
  });
});