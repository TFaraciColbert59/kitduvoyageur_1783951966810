// @vitest-environment jsdom

/**
 * C5 - Tiroir Lieu : la recherche appelle VRAIMENT le service de geocodage.
 *
 * Ce que les tests deja presents ne prouvaient pas :
 *   - `use-geocode.test.ts` ne teste que `geocodeMessage`, une fonction de
 *     libelle. Il n'appelle jamais `fetch`.
 *   - `geocode-service.test.ts` teste le service serveur, en Node, sans tiroir.
 *
 * Entre les deux, un retour en arriere du CABLE - `const geo = useGeocode(query)`
 * remplace par un etat fige - laissait la suite entierement verte alors que le
 * tiroir ne chercherait plus rien. C'est le trou que comble ce fichier : il
 * monte le VRAI `PlaceSheet`, tape dans le VRAI champ, et attend le VRAI appel.
 *
 * Regle de preuve : le test ne verifie pas seulement que la liste est vide sans
 * reseau. Il verifie que la REPONSE DU SERVICE, et elle seule, remplit la
 * liste. Un rendu qui afficherait des lieux en dur passerait le premier test et
 * echouerait ici.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

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
    window.scrollTo = (() => {}) as unknown as typeof window.scrollTo;
    window.Element.prototype.scrollTo = function scrollTo() {};
    window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

import { PlaceSheet } from '../components/PrepSetupSheets';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type { GeocodeMatch } from '../geocodeService';

/** Un provider reel repond ; c'est la seule source de verite de ce fichier. */
const CHAMONIX: GeocodeMatch = {
  id: 'osm:relation/2988767',
  name: 'Chamonix-Mont-Blanc',
  context: 'Haute-Savoie',
  country: 'France',
  lat: 45.9237,
  lon: 6.8694,
  provider: 'nominatim',
  precision: 'commune',
};

const ARGENTIERE: GeocodeMatch = {
  id: 'osm:relation/2990704',
  name: 'Argentiere',
  context: 'Haute-Savoie',
  country: 'France',
  lat: 45.9822,
  lon: 6.9269,
  provider: 'nominatim',
  precision: 'commune',
};

/**
 * Capture chaque URL appelee et repond au geocodage avec les matchs donnes.
 * Le reverse-geocode de la position (appele au montage) echoue volontairement :
 * on ne veut pas qu'il nourrisse la liste de faux candidats.
 */
function stubNetwork(matches: readonly GeocodeMatch[]) {
  const urls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.startsWith('/api/geocode')) {
      return new Response(JSON.stringify({ status: 'ok', matches }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return Promise.reject(new Error('reseau indisponible'));
  });
  vi.stubGlobal('fetch', impl);
  return { urls, impl };
}

function renderPlaceSheet() {
  const state = useAdventurePrepStore.getState();
  return render(
    <PlaceSheet draft={state.draft} actions={state} onClose={() => {}} field="origin" />,
  );
}

describe('C5 - le tiroir Lieu appelle le service de geocodage et rend ses resultats', () => {
  beforeEach(() => {
    useAdventurePrepStore.getState().resetDraft();
    window.localStorage.clear();
  });

  it('C5-01 : taper une requete appelle /api/geocode avec cette requete', async () => {
    vi.useFakeTimers();
    const { urls } = stubNetwork([CHAMONIX]);

    renderPlaceSheet();
    fireEvent.change(screen.getByLabelText('Rechercher un lieu'), {
      target: { value: 'Chamonix' },
    });

    // 350 ms de debounce : sans cette attente, le test passerait meme sans reseau.
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(urls, 'le tiroir doit appeler le service de geocodage').toContain(
      '/api/geocode?q=Chamonix',
    );
  });

  it('C5-02 : les lieux renvoyes par le service sont affiches dans la liste', async () => {
    vi.useFakeTimers();
    stubNetwork([CHAMONIX, ARGENTIERE]);

    renderPlaceSheet();
    fireEvent.change(screen.getByLabelText('Rechercher un lieu'), {
      target: { value: 'Chamonix' },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    // waitFor programme son propre polling : il lui faut des horloges reelles.
    vi.useRealTimers();

    // Ces deux noms n'existent nulle part dans le code du tiroir : ils ne
    // peuvent venir que de la reponse du provider simule.
    await waitFor(() => {
      expect(document.body.textContent ?? '').toContain('Chamonix-Mont-Blanc');
    });
    expect(document.body.textContent ?? '').toContain('Argentiere');
  });

  it('C5-03 : une panne reseau rend un etat honnete, jamais une liste inventee', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('reseau indisponible'))));

    renderPlaceSheet();
    fireEvent.change(screen.getByLabelText('Rechercher un lieu'), {
      target: { value: 'Chamonix' },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(document.body.textContent ?? '').toContain('Recherche de lieu indisponible');
    });
    // Aucune ligne de lieu n a pu etre fabriquee : la panne ne remplit rien.
    expect(document.body.textContent ?? '').not.toContain('Chamonix-Mont-Blanc');
  });

  it('C5-04 : une saisie trop courte n appelle pas le service', async () => {
    vi.useFakeTimers();
    const { urls } = stubNetwork([CHAMONIX]);

    renderPlaceSheet();
    fireEvent.change(screen.getByLabelText('Rechercher un lieu'), { target: { value: 'C' } });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(urls.filter((u) => u.startsWith('/api/geocode'))).toEqual([]);
  });
});