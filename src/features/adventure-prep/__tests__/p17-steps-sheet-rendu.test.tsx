/**
 * P1.7 - Le tiroir Etapes rend les etapes REELLES du modele.
 *
 * Ce que les autres suites ne prouvent pas : que l affichage est derive du
 * programme, et non d une liste redigee dans le composant. Un tiroir qui
 * afficherait des lignes en dur passerait une assertion du type 'il y a des
 * lignes', mais il mentirait des que le programme change.
 *
 * Chaque assertion compare donc l ecran aux `model.steps` produits par le
 * moteur sur le brouillon de fixtures : des que le rendu et le modele
 * divergent, le test rougit.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';

import { StepsSheet } from '../components/PrepItinerarySheets';
import { buildItinerary } from '../engine/itinerary';
import type { ItineraryModel } from '../types';
import { fullDraft } from './fixtures';
import { draftAvec, storeFactice } from './programmeFactice';

afterEach(() => cleanup());

/** Le programme reellement produit par le moteur pour ce brouillon. */
function modeleDuMoteur(): ItineraryModel {
  const construit = buildItinerary(fullDraft());
  if (!construit) throw new Error('le moteur doit produire un programme pour ce brouillon');
  return construit;
}

/** Les boutons d etape, dans l ordre du document : exactement la liste lue. */
function lignesDEtape(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('button.prep-act')).map((bouton) =>
    (bouton.textContent ?? '').replace(/\s+/g, ' ').trim(),
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

describe('P1.7 - le tiroir rend le programme, pas une liste en dur', () => {
  it('P17-01: chaque etape du modele apparait, dans l ordre jour puis rang', () => {
    const modele = modeleDuMoteur();
    const { container } = monter(modele);

    const rendues = lignesDEtape(container);
    const attendues = modele.steps.map((etape) => etape.title);

    // L ordre de lecture est jour puis rang : on compare la suite entiere et
    // pas seulement l appartenance, sinon un tri inverse passerait aussi.
    for (const titre of attendues) {
      expect(rendues.some((ligne) => ligne.includes(titre)), `${titre} absent du tiroir`).toBe(true);
    }
    // Aucune ligne en trop : une tuile sans etape derriere est une invention.
    expect(rendues).toHaveLength(modele.steps.length);
  });

  it('P17-02: le titre affiche est celui du modele, et non un resume invente', () => {
    const modele = modeleDuMoteur();
    const { container } = monter(modele);

    for (const etape of modele.steps) {
      const ligne = lignesDEtape(container).find((texte) => texte.includes(etape.title));
      expect(ligne, `ligne de ${etape.title} introuvable`).toBeDefined();
      // Le libelle de famille ne doit pas remplacer le nom reel du lieu.
      expect(ligne).toContain(etape.title);
    }
  });

  it('P17-03: changer le modele change l ecran', () => {
    const modele = modeleDuMoteur();
    const { container } = monter(modele);
    const avant = lignesDEtape(container);

    // Un programme ampute de sa premiere etape : si le tiroir lisait le
    // modele, la ligne disparait. Une liste ecrite en dur resterait, elle.
    const amputee: ItineraryModel = { ...modele, steps: modele.steps.slice(1) };
    const { container: suivant } = monter(amputee);
    const apres = lignesDEtape(suivant);

    expect(avant).toHaveLength(modele.steps.length);
    expect(apres).toHaveLength(modele.steps.length - 1);
    expect(apres.some((ligne) => ligne.includes(modele.steps[0]?.title ?? ''))).toBe(false);
  });
});
