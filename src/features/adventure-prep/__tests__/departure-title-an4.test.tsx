import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartureStep } from '../components/DepartureStep';
import { buildItinerary } from '../engine/itinerary';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/**
 * AN4 — ecran de depart : le titre et sa ligne d aide.
 *
 * Le defaut mesure : `activities.primary` vaut null, donc l ancienne ligne
 * d aide s ecroulait entierement sur « A verifier » — alors que la duree, elle,
 * est connue. Un A_VERIFIER ne doit jamais ecraser une valeur reelle.
 */

const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined }),
}));

function render(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(DepartureStep, { onOpenSheet: () => undefined }));
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const CORRIDOR: PlaceCandidate[] = [
  { id: 'o-gouter', name: 'Refuge du Gouter', category: 'refuge', lat: 45.8447, lon: 6.8427, description: null, region: null, country: 'France', pricePerNight: 75, phone: null, website: null, isVerifiable: true },
];

/**
 * Brouillon reellement genere, puis activities.primary remis a null.
 *
 * L ordre importe : le repli regles refuse de construire un modele sans
 * activite principale, donc on construit avec, puis on retire l activite — ce
 * qui reproduit exactement l etat releve sur l ecran (parcours REEL produit par
 * le modele, personne n avait coche d activite a l etape 1).
 */
function generated(overrides: Partial<AdventurePrepDraft> = {}, title: string | null = null): AdventurePrepDraft {
  const base = fullDraft(overrides);
  const built = buildItinerary(base);
  if (!built) throw new Error('modele de regles absent');
  const located = assignPlaces(built, CORRIDOR, CHAMONIX, ARGENTIERE);
  return {
    ...base,
    activities: { primary: null, extra: [], nights: [] },
    itinerary: { ...located, title },
  };
}

describe('AN4 — titre et ligne d aide de l ecran de depart', () => {
  it('AN4-01: sans nom saisi, le titre propose par le modele est affiche', () => {
    const text = visible(render(generated({ coverName: null }, 'Chamonix en deux jours')));
    expect(text).toContain('Chamonix en deux jours');
    expect(text).not.toContain('Ton aventure');
  });

  it('AN4-02: le nom saisi par la personne reste prioritaire', () => {
    const text = visible(render(generated({ coverName: 'Mon week-end' }, 'Chamonix en deux jours')));
    expect(text).toContain('Mon week-end');
    expect(text).not.toContain('Chamonix en deux jours');
  });

  it('AN4-03: sans activite choisie, la duree reste lue sous le titre', () => {
    // Portee volontairement etroite a la couverture. Le reste de l ecran peut
    // encore afficher « A verifier » : ce modele n a ni routage ni meteo, et
    // masquer ces manques serait exactement le mensonge que la checklist
    // interdit. Ce qui ne doit PAS arriver, c est la duree connue disparaitre
    // parce que l activite, elle, manque.
    const text = visible(render(generated({ coverName: null }, null)));
    expect(text.startsWith('Ton aventure 3 jours Modifier')).toBe(true);
  });

  it('AN4-03b: le titre du modele remplace le libelle neutre des qu il existe', () => {
    const text = visible(render(generated({ coverName: null }, 'Chamonix en trois jours')));
    expect(text.startsWith('Chamonix en trois jours 3 jours Modifier')).toBe(true);
  });

  it('AN4-04: le repli textuel ne reste que si le modele n a rien propose', () => {
    const text = visible(render(generated({ coverName: null }, null)));
    expect(text).toContain('Ton aventure');
  });

  it('AN4-05: avec une activite choisie, la ligne d aide la conserve', () => {
    const text = visible(render(fullDraft({ coverName: 'Trois jours de refuge' })));
    expect(text).toContain('Randonnée');
    expect(text).toContain('3 jours');
  });
});
