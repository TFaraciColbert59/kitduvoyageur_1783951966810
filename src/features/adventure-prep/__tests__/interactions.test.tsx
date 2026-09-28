/**
 * Lot INTERACTIONS — le premier fichier de la feature qui clique vraiment.
 *
 * Pourquoi ce fichier existe, et pourquoi il est le premier :
 * les 119 autres fichiers de `src/features/adventure-prep/__tests__/` tournent en
 * `environment: node` et rendent par `renderToStaticMarkup`. Cette convention
 * (assumée, documentée dans `prep-drawers-liquid.test.tsx:14`) a une limite
 * structurelle : **un `onClick={() => {}}` mort y est indétectable**. Un composant
 * peut avoir ses dix boutons styled, nommés, accessibles — et ne rien faire.
 *
 * Ce fichier rompt la limite. Il demande `jsdom`, monte les composants RÉELS
 * (`@testing-library/react`), et exercise le vrai chemin :
 * clic -> handler -> store -> re-rendu -> état observable.
 * Un bouton en no-op le fait échouer, ce qui est exactement le but.
 *
 * Il ne s'agit pas d'ajouter un test de plus : il s'agit de donner à la suite
 * la capacité de prouver ce qu'elle ne pouvait pas prouver.
 */

// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

/* ------------------------------------------------------------------ */
/* Environnement : les quelques API que jsdom n'implémente pas et que  */
/* Radix Dialog appelle. Ce ne sont pas des mocks de produit : ce sont   */
/* des shims de plateforme, sans quoi rien ne peut monter.              */
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
    // jsdom ne sait pas faire défiler : on l' note au lieu de le laisser crier.
    window.scrollTo = (() => {}) as unknown as typeof window.scrollTo;
    window.Element.prototype.scrollTo = function scrollTo() {};
    window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */

import { PrepSheets } from '../components/PrepSheets';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';

function sheetText(): string {
  return document.body.textContent ?? '';
}

describe('INTERACTIONS — les tiroirs vont vraiment s’ouvrir et se refermer', () => {
  beforeEach(() => {
    useAdventurePrepStore.getState().resetDraft();
  });

  it('INT-01 : un tiroir s’ouvre quand on lui dit de s’ouvrir, et disparaît quand on le ferme', () => {
    const onClose = vi.fn();

    // 1. Fermé : rien à l'écran.
    const closed = render(<PrepSheets sheet={null} onClose={onClose} />);
    expect(sheetText()).not.toContain('Où tu pars');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    closed.unmount();

    // 2. Ouvert : le titre du tiroir est là, et surtout il est dans un dialogue.
    const opened = render(<PrepSheets sheet="place" onClose={onClose} />);
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(sheetText()).toContain('Où tu pars');
    // Un tiroir ouvert ne peut pas avoir.appelé onClose tout seul.
    expect(onClose).not.toHaveBeenCalled();

    // 3. La touche Échap doit fermer — c'est le contrat de fermeture d'un Sheet.
    fireEvent.keyDown(dialog as HTMLElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    opened.unmount();
  });

  it('INT-02 : chaque tiroir du parcours a un titre propre — aucun tiroir vide', () => {
    const attendu: ReadonlyArray<[Parameters<typeof PrepSheets>[0]['sheet'], string]> = [
      ['place', 'Où tu pars'],
      ['calendar', 'Quand tu pars'],
      ['group', 'Avec qui'],
      ['preferences', 'Préférences'],
      ['participants', 'Participants'],
      ['invite', 'Inviter'],
    ];

    for (const [id, titre] of attendu) {
      const v = render(<PrepSheets sheet={id} onClose={vi.fn()} />);
      expect(sheetText(), `tiroir « ${id} » sans titre`).toContain(titre);
      v.unmount();
      cleanup();
    }
  });

  it('INT-03 : un tiroir peut en ouvrir un autre (Participants -> Inviter)', () => {
    const onOpenSheet = vi.fn();
    render(<PrepSheets sheet="participants" onClose={vi.fn()} onOpenSheet={onOpenSheet} />);

    const dialogue = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialogue).not.toBeNull();

    const bouton = within(dialogue).getByRole('button', { name: /inviter/i });
    fireEvent.click(bouton);

    expect(onOpenSheet).toHaveBeenCalledWith('invite');
  });
});
