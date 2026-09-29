/**
 * L3.5 / M4.3 - La fiche d un etape ne montre PAS de vignette.
 *
 * Le carre de 44 px en tete de fiche n etait pas une photo : `ItineraryStep` ne
 * porte aucun champ image. C etait un glyphe dans un cadre clair - l element
 * le plus lumineux de la fiche, plus fort que le titre, et repete par le type
 * d etape que le titre dit deja. Il promettait une image que la base n a pas.
 *
 * Ces tests verrouillent l ABSENCE, pas la presence d un remplacant : le jour
 * ou une vraie image existera en base, ils devront evoluer avec elle, et ce
 * sera visible dans la revue.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { StepSheet, StepsSheet } from '../components/PrepItinerarySheets';
import { draftAvec, programmeLocalise, storeFactice } from './programmeFactice';
import type { ItineraryStep } from '../types';

const SOURCE = readFileSync(join(__dirname, '..', 'components', 'PrepItinerarySheets.tsx'), 'utf8');
const FEUILLE = readFileSync(join(__dirname, '..', 'adventure-prep.css'), 'utf8');

function etapeRealisee(overrides: Partial<ItineraryStep> = {}): ItineraryStep {
  const premiere = programmeLocalise().steps[0];
  return { ...premiere, ...overrides };
}

function fiche(): string {
  return renderToStaticMarkup(
    React.createElement(StepSheet, {
      draft: draftAvec(programmeLocalise()),
      actions: storeFactice(),
      onClose: () => undefined,
      stepId: 's1',
    }),
  ) + renderToStaticMarkup(
    React.createElement(StepsSheet, {
      draft: draftAvec(programmeLocalise()),
      actions: storeFactice(),
      onClose: () => undefined,
    }),
  );
}

describe('L3.5 / M4.3 - la fiche ne pretend pas avoir une photo', () => {
  it('L3-05: ni vignette, ni balise image, dans la fiche comme dans le tiroir', () => {
    const html = fiche();
    expect(html).not.toContain('prep-step__thumb');
    // Une `<img>` sans source reelle afficherait un cadre casse ; une src
    // fabriquee serait une donnee. Aucune des deux n a sa place ici.
    expect(html).not.toMatch(/<img/);
  });

  it('L3-06: le titre et le lieu restent, eux, bien lisibles', () => {
    // La vignette disparue ne doit pas avoir emporter l information qu elle
    // doublait : le titre du lieu est la premiere chose de la fiche.
    const html = renderToStaticMarkup(
      React.createElement(StepSheet, {
        draft: draftAvec(programmeLocalise()),
        actions: storeFactice(),
        onClose: () => undefined,
        stepId: 's1',
      }),
    );
    expect(html).toContain('Départ Chamonix');
  });

  it('L3-07: la classe de vignette a disparu du composant, pas seulement du rendu', () => {
    // Un `.prep-step__thumb` resterait dans le code et reviendrait au prochain
    // refactor : le garde est sur la source.
    expect(SOURCE).not.toContain('prep-step__thumb');
  });

  it('L3-08: l icone de type reste dans le tiroir, ou elle porte une information', () => {
    // Le tiroir, lui, garde son glyphe : il est la SEULE chose qui distingue
    // une nuit d un ravitaillement dans une liste de trois mots.
    const html = renderToStaticMarkup(
      React.createElement(StepsSheet, {
        draft: draftAvec(programmeLocalise()),
        actions: storeFactice(),
        onClose: () => undefined,
      }),
    );
    expect(html).toContain('prep-act__icon');
  });

  it('L3-09: une etape sans position ne fabrique pas de vignette non plus', () => {
    const modele = programmeLocalise();
    const sansPosition = { ...modele, steps: modele.steps.map((s) => ({ ...s, lat: null, lon: null })) };
    const html = renderToStaticMarkup(
      React.createElement(StepsSheet, {
        draft: draftAvec(sansPosition),
        actions: storeFactice(),
        onClose: () => undefined,
      }),
    );
    expect(html).not.toContain('prep-step__thumb');
    expect(html).not.toMatch(/<img/);
  });

  /* ---------------------------------------------------------------- */
  /* M4.3 - la vignette verte ne doit meme plus attendre un composant    */
  /* ---------------------------------------------------------------- */

  it('M4-03: la feuille de style ne conserve pas la vignette verte', () => {
    // Le composant ne rendait plus la vignette, mais la REGLE est restee.
    // Une regle orpheline ne sert a rien sur l ecran et laisse croire que
    // la carte contient encore une image : au prochain refactor, la
    // vignette revient toute seule, seule, sans qu on la redemande.
    //
    // Le fond `color-mix` sur `--lkv-action` est precisement ce que M4.3
    // designait : le carre le plus lumineux de la fiche, pour une image
    // qui n existe pas et ne veut rien dire.
    expect(FEUILLE).not.toContain('prep-step__thumb');
  });

});
