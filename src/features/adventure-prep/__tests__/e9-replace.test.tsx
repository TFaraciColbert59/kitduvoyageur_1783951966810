/**
 * E9 — le bouton « Remplacer » ne faisait RIEN.
 *
 * Un `onClick={() => {}}` est la pire des promesses : le bouton advertise une
 * action que le moteur n'a pas. Ce test fixe ce qu'on a decide.
 *
 * Decision : le bouton est RETIRE, pas cable.
 * Ce que le moteur sait faire, verifie dans le code et non suppose :
 * - poser un point de passage (`insertWaypoint`) ;
 * - affecter un lieu reel a une etape (`assignPlaces`) ;
 * - rejouer la recherche d'un parcours ENTIER (phase `recherche_parcours`).
 * Ce qu'il ne sait pas faire : proposer des alternatives a UNE etape. Les
 * candidats de `resolvePlacesFor` vivent dans la fermeture de la generation et
 * ne sont jamais conserves ; `nearestCompatible` est prive de `places.ts` et son
 * jeu `used` est local a un seul `assignPlaces`. Rejouer l'affectation sur le
 * meme modele et le meme depot rendrait le meme parcours — ce n'est pas une
 * alternative, c'est le meme choix.
 *
 * E9 reste donc OUVERT : le test E9-03 verrouille ce constat et le fera
 * echouer le jour ou un vrai moteur d'alternatives existera.
 *
 * Meme harnais que `prep-screens.test.tsx` : sous `renderToStaticMarkup`,
 * zustand v5 sert l'etat INITIAL et `setState` n'a aucun effet, donc le store
 * est remplace par un selecteur pur — le composant est reellement execute.
 */

import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { buildItinerary } from '../engine/itinerary';
import * as places from '../engine/places';
import * as proposedStops from '../engine/proposedStops';
import * as itineraryEngine from '../engine/itineraryEngine';
import * as reducer from '../store/reducer';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';

const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

/** Brouillon complet + itineraire reellement construit par le moteur. */
function built(): AdventurePrepDraft {
  const draft = fullDraft();
  const model = buildItinerary(draft);
  if (!model) throw new Error('fixture : le brouillon de base doit etre construisible');
  return { ...draft, itinerary: model };
}

function render(draft: AdventurePrepDraft = built()): string {
  state.current = { draft };
  return renderToStaticMarkup(
    React.createElement(ItineraryStepScreen, { onOpenSheet: () => undefined }),
  );
}

/** Ce que l'utilisateur LIT, balises et attributs retires. */
function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Les libelles de la rangee d'actions du detail d'etape, dans l'ordre.
 *
 * On lit le CONTENU rendu, pas l'intention du code : un bouton promesse une
 * action, donc c'est ce que la personne voit qu'il faut comparer.
 */
function actionLabels(html: string): string[] {
  return Array.from(html.matchAll(/<div class="prep-step__actions"[^>]*>([\s\S]*?)<\/div>/g)).flatMap(
    (bloc) =>
      Array.from(bloc[1].matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)).map(
        (bouton) => visible(bouton[1]),
      ),
  );
}

describe('E9 — « Remplacer » ne promet plus une action que le moteur n a pas', () => {
  it('E9-01: le detail d une etape ne rend plus « Remplacer »', () => {
    const text = visible(render());
    expect(text).not.toContain('Remplacer');
  });

  it('E9-02: la rangee d actions ne garde que des boutons qui agissent', () => {
    const labels = actionLabels(render());
    expect(labels).toEqual(['Détails', 'À conserver']);
  });

  it('E9-03: aucun moteur ne sait produire une alternative a UNE etape', () => {
    // Le contrat qui justifie le retrait. Ce test passe aujourd'hui et doit
    // ECHOUER le jour ou un vrai moteur d'alternatives existera : E9 redevient
    // alors faisable, et le bouton doit revenir.
    const surfaces = [
      ...Object.keys(places),
      ...Object.keys(proposedStops),
      ...Object.keys(itineraryEngine),
      ...Object.keys(reducer),
    ];
    expect(surfaces.filter((nom) => /alternativ|remplac|replace|variant/i.test(nom))).toEqual([]);
  });

  it('E9-04: retirer le bouton n a rien casse autour de lui', () => {
    const html = render();
    const text = visible(html);
    // Le programme du jour, la carte et le CTA de sortie sont intacts.
    expect(text).toContain('Jour 1');
    expect(text).toContain('Vers le départ');
    // La rangee d'actions existe toujours : on a retire UNE promesse, pas la
    // fiche de l'etape.
    expect(actionLabels(html)).not.toEqual([]);
  });
});
