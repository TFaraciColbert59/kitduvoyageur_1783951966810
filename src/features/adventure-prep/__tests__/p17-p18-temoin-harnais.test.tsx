/**
 * P1.7 / P1.8 - TEST TEMOIN DU HARNAIS.
 *
 * Une suite verte ne prouve rien si elle ne peut pas rougir. Ce fichier existe
 * pour etablir une seule chose : le harnais (montage React, extraction des
 * boutons, selection par classe) SAIT voir une regression de rendu.
 *
 * Deux demonstrations, deux directions opposees :
 *  1. une preuve PAR POSITION : le composant reel, monte, expose bien les
 *     elements que les suites P17/P18 interrogent. Si une de ces assertions
 *     venait a passer 'par hasard', celle-ci resterait verte quand meme.
 *  2. une preuve PAR MUTATION : un composant bidon qui rend la MEME
 *     structure de classes mais aucun contenu reel est interroge par la meme
 *     fonction que les suites metier. Elle doit ECHOER. C est la preuve que
 *     `lignesDEtape` et `boutonsDEtape` discriminent un rendu reel d un rendu
 *     creux, et ne se contentent pas de compter des noeuds.
 *
 * Concretement : si quelqu un vidait demain le contenu de `StepsSheet` tout en
 * conservant sa structure de balises, le test de mutation passerait au vert sur
 * la structure mais les suites P17/P18 PASSERAIENT AU ROUGE sur le contenu.
 * C est exactement ce que la mutation ci-dessous simule.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';

import { StepsSheet } from '../components/PrepItinerarySheets';
import type { ItineraryModel } from '../types';
import { draftAvec, programmeLocalise, storeFactice } from './programmeFactice';

afterEach(() => cleanup());

/** Meme selecteur que les suites metier : ce qu elles_ASSERTENT_, on le rejoue. */
function lignesDEtape(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('button.prep-act')).map(
    (bouton) => (bouton.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

function monter(modele: ItineraryModel | null) {
  return render(
    React.createElement(StepsSheet, {
      draft: draftAvec(modele),
      actions: storeFactice(),
      onClose: () => undefined,
    }),
  );
}

/**
 * Composant BIDON : reproduit la STRUCTURE de `StepsSheet` (les memes classes,
 * les memes balises) mais ne rend AUCUN titre reel.
 *
 * Il sert UNIQUEMENT de mutant. Il ne doit jamais remplacer le composant
 * source : il simule ce que donnerait `StepsSheet` si son contenu etait vide
 * alors que son gabrait restait en place.
 */
function StepsSheetVide(): React.ReactElement {
  return React.createElement(
    'div',
    null,
    React.createElement(
      'section',
      { style: { marginBottom: 20 } },
      React.createElement('h3', { className: 'prep-section-title' }, 'Jour 1'),
      React.createElement(
        'ul',
        { className: 'prep-acts' },
        React.createElement(
          'li',
          null,
          React.createElement('button', { type: 'button', className: 'prep-act' }),
        ),
      ),
    ),
  );
}

describe('P1.7 / P1.8 - temoin : le harnais mord une regression de rendu', () => {
  it('T-01: le composant reel est bien interroge par le selecteur des suites', () => {
    const { container } = monter(programmeLocalise());
    const lignes = lignesDEtape(container);

    // Preuve par position : le composant reel expose bien des elements non
    // vides. Une suite qui compterait des noeuds sans lire le contenu
    // pourrait donner l impression de couvrir ce cas ; elle ne le couvre pas.
    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes.every((ligne) => ligne.length > 0)).toBe(true);
    expect(lignes.some((ligne) => ligne.includes('Refuge'))).toBe(true);
  });

  it('T-02: un rendu vide de contenu fait ECHOUER le selecteur des suites', () => {
    // Preuve par mutation : meme structure, aucun contenu. Si cette assertion
    // passait, alors `lignesDEtape` ne testerait QUE la structure et les
    // suites P17/P18 seraient vertes sur un composant qui n'affiche rien.
    const { container } = render(React.createElement(StepsSheetVide));
    const lignes = lignesDEtape(container);

    expect(lignes.every((ligne) => ligne.length > 0)).toBe(false);
    expect(lignes.some((ligne) => ligne.includes('Refuge'))).toBe(false);
  });

  it('T-03: le mutant echoue aussi l assertion de contenu des suites P17', () => {
    // On rejoue mot pour mot l assertion centrale de p17-steps-sheet-rendu :
    // si elle passe sur le mutant, elle ne prouve rien sur le composant reel.
    const { container } = render(React.createElement(StepsSheetVide));
    const rendues = lignesDEtape(container);
    const modele = programmeLocalise();
    const attendues = modele.steps.map((etape) => etape.title);

    for (const titre of attendues) {
      expect(rendues.some((ligne) => ligne.includes(titre))).toBe(false);
    }
  });
});


