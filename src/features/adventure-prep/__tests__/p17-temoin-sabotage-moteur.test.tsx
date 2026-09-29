/**
 * P1.7 / P1.8 - TEMOIN 2 : le sabotage du MOTEUR fait rougir le composant REEL.
 *
 * Le temoin 1 (`p17-p18-temoin-harnais`) oppose le composant a un bidon. Le
 * present fichier attaque par l AUTRE bout : il laisse le VRAI `StepsSheet`
 * s executer, mais il casse une primitive du moteur (`daySteps`) qui fournit la
 * liste des journees. Le composant tourne alors pour de vrai, et ne rend
 * AUCUNE tuile.
 *
 * Ce qu il protege : les assertions des suites P17/P18 interrogent bien la
 * CHAINE REELLE (moteur -> composant -> DOM). Elles ne peuvent pas etre
 * satisfaites par une coincidence de structure. Si une suite cliente
 * redemandait demain les lignes du tiroir, elle recevrait ce meme zero et
 * rougirait - c est verifie ici, en permanence, sans toucher au composant.
 *
 * Le sabotage porte sur une PRIMITIVE et non sur un stub du composant : les
 * tiroirs voisins, qui consomment la meme primitive, tombent ensemble. C est
 * la definition d un temoin utile : il protege le contrat, pas une maquette.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';

/* `daySteps` alimente la liste des journees de TOUS les tiroirs du parcours.
 * On la neutralise pour prouver que le rendu observe vient bien d elle. */
vi.mock('../engine/itinerary', async (importOriginal) => {
  const original = await importOriginal<typeof import('../engine/itinerary')>();
  return { ...original, daySteps: () => [] };
});

import { StepsSheet } from '../components/PrepItinerarySheets';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import { draftAvec, storeFactice } from './programmeFactice';

afterEach(() => cleanup());

describe('P1.7 / P1.8 - temoin moteur : le rendu REEL devient vide quand la primitive tombe', () => {
  it('T-04: le modele est riche, le composant s execute, et pourtant zero tuile', () => {
    const modele = buildItinerary(fullDraft());
    if (!modele) throw new Error('le moteur doit produire un programme pour ce brouillon');

    const { container } = render(
      React.createElement(StepsSheet, {
        draft: draftAvec(modele),
        actions: storeFactice(),
        onClose: () => undefined,
      }),
    );

    // Le modele, lui, n a pas bouge : le composant a bien recu son programme.
    expect(modele.steps.length).toBeGreaterThan(0);

    // Pourtant aucune tuile. C est exactement ce que verrait une assertion de
    // contenu si le tiroir cessait de rendre ses etapes : elle rougirait.
    const tuiles = container.querySelectorAll('button.prep-act');
    expect(tuiles).toHaveLength(0);

    // Le tiroir ne se cache pas : il annonce l absence plutot que de laisser
    // croire a un parcours mesure. Le DOM est bien rendu, il est vide de lignes.
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('T-05: la meme requete qui vaut vert sur le modele complet vaut zero ici', () => {
    const modele = buildItinerary(fullDraft());
    if (!modele) throw new Error('le modele attendu');

    const { container } = render(
      React.createElement(StepsSheet, {
        draft: draftAvec(modele),
        actions: storeFactice(),
        onClose: () => undefined,
      }),
    );

    // La requete centrale de P17-01, rejouee telle quelle. Elle doit echouer :
    // c est la preuve que cette requete n'est pas verte par hasard.
    const rendues = Array.from(container.querySelectorAll('button.prep-act')).map(
      (bouton) => (bouton.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    for (const etape of modele.steps) {
      expect(rendues.some((ligne) => ligne.includes(etape.title))).toBe(false);
    }
  });
});


