// @vitest-environment jsdom

/**
 * F8 - L eau se compte par SEGMENT, pas par journee. Les repas restent par jour.
 *
 * L eau etait comptee comme `waterNeeds` : UNE entree par jour, ancree sur la
 * premiere etape. C est faux pour ce que la personne doit faire — on ne
 * porte pas son eau du lever au coucher, on la porte d un ravitaillement au
 * suivant. Sur le programme reel du depot, le jour 1 contient DEUX
 * ravitaillements : il donne donc TROIS portions a porter, pas une.
 *
 * Ce fichier prouve les deux moities :
 *
 *   1. LE DECOUPAGE. `segmentsForDay` couvre reellement le programme du
 *      jour, dans l ordre, sans trou : les segments sont jointifs et le seul
 *      chevauchement est le ravitaillement, ou l on arrive et d ou l on
 *      repart. Une version « une ligne par jour » passerait un test qui se
 *      contente de compter — celui-ci recolle les bouts et recompte.
 *
 *   2. L HONNETETE. `litersPerPerson` reste `null` : aucune source publiee ne
 *      donne la portee du segment. Le tiroir affiche donc « a verifier » et
 *      n invente AUCUN litre. Le test 04 echoue si un litre apparait.
 *
 * Regle de preuve : le sabotage ramene `segmentsForDay` a un seul segment par
 * jour. Les tests 01, 02 et 03 tombent alors en Rouge.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import { ConsumablesSheet } from '../components/PrepGearSheets';
import { segmentsForDay, waterSegments } from '../engine/consumablesBySegment';
import { mealNeeds, uncoveredMeals } from '../engine/consumables';
import { buildItinerary, daySteps } from '../engine/itinerary';
import { A_VERIFIER } from '../engine/trust';
import { fullDraft } from './fixtures';
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
});

afterEach(() => cleanup());

const BROUILLON: AdventurePrepDraft = (() => {
  const draft = fullDraft();
  return { ...draft, itinerary: buildItinerary(draft) };
})();
const MODELE = BROUILLON.itinerary!;

function sansActions() {
  return {} as never;
}

describe('F8 - l eau par segment, les repas par journee', () => {
  it('01 - une journee a plusieurs ravitaillements donne PLUSIEURS segments', () => {
    const jour1 = segmentsForDay(MODELE, 1);
    // Le programme reel du jour 1 porte deux ravitaillements : trois portions.
    expect(jour1.length).toBeGreaterThan(1);
    // Le total, lui, couvre bien les trois journees.
    expect(waterSegments(MODELE).length).toBeGreaterThan(jour1.length);
    for (const segment of jour1) {
      expect(segment.day).toBe(1);
    }
  });

  it('02 - les segments COUVRENT le jour dans l ordre, jointifs au ravitaillement', () => {
    for (let day = 1; day <= MODELE.days; day += 1) {
      const etapes = daySteps(MODELE, day);
      const segments = segmentsForDay(MODELE, day);
      expect(segments.length).toBeGreaterThan(0);

      // 1. Jointivite : chaque segment repart de l etape qui ferme le
      //    precedent. C est ce qui garantit qu aucune etape n est sautee.
      const recollés: string[] = [];
      for (const segment of segments) {
        expect(segment.stepIds.length).toBeGreaterThan(0);
        if (recollés.length > 0) {
          expect(segment.stepIds[0]).toBe(recollés[recollés.length - 1]);
          recollés.push(...segment.stepIds.slice(1));
        } else {
          recollés.push(...segment.stepIds);
        }
      }
      // 2. Couverture : le recollement redonne le programme du jour, a
      //    l identique. Aucune etape perdue, aucune etape en trop.
      expect(recollés).toEqual(etapes.map((step) => step.id));

      // 3. Le SEUL chevauchement est l'ancre : un segment se ferme sur le
      //    ravitaillement que le suivant ouvre. Donc une etape est comptee
      //    deux fois SI ET SEULEMENT SI elle ferme un segment et en ouvre un
      //    autre — ce que le moteur publie lui-meme.
      const comptes = new Map<string, number>();
      for (const segment of segments) {
        for (const id of segment.stepIds) comptes.set(id, (comptes.get(id) ?? 0) + 1);
      }
      const enChevauchement = new Set<string>();
      for (let i = 0; i < segments.length - 1; i += 1) {
        const ferme = segments[i].closedByStepId;
        const ouvre = segments[i + 1].opensAtStepId;
        // Une portion n'est une portion que si elle se ferme vraiment.
        expect(ferme).not.toBeNull();
        expect(ferme).toBe(ouvre);
        enChevauchement.add(ferme!);
      }
      // La queue de journee ne se ferme sur rien : c'est la fin de la journee.
      expect(segments[segments.length - 1].closedByStepId).toBeNull();
      for (const [index, step] of etapes.entries()) {
        const attendu = enChevauchement.has(step.id) ? 2 : 1;
        expect({ id: step.id, n: comptes.get(step.id) }).toEqual({ id: step.id, n: attendu });
        // Et l'ancre d'un chevauchement est bien un ravitaillement du programme.
        if (enChevauchement.has(step.id)) {
          expect(step.kind).toBe('ravitaillement');
          expect(index).toBeLessThan(etapes.length - 1);
        }
      }
      // 4. Un identifiant par segment. React s en sert de cle : une journee qui
      //    COMMENCE par un ravitaillement partageait son identifiant entre la
      //    portion de depart et la portion du soir, et React y perdait des
      //    lignes. Le cas est dans le programme reel (jours 2 et 3).
      const ids = segments.map((segment) => segment.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('03 - le tiroir range les segments sous un titre de journee, par jour', () => {
    render(<ConsumablesSheet draft={BROUILLON} actions={sansActions()} />);
    const titres = Array.from(document.querySelectorAll('.prep-consumables__day')).map(
      (noeud) => noeud.textContent ?? '',
    );
    // Un titre par journee qui porte des segments, dans l ordre.
    expect(titres).toEqual(['Jour 1', 'Jour 2', 'Jour 3']);
    // Le nombre de lignes « Segment N » par jour correspond au moteur.
    const lignes = document.querySelectorAll('li[data-prep-row="eau"]');
    expect(lignes.length).toBe(waterSegments(MODELE).length);
    // Et surtout : le jour 1 porte DEUX ravitaillements, donc le TIROIR —
    // pas seulement le moteur — doit montrer plusieurs portions. Une ligne
    // unique par journee passerait le decompte ci-dessus et echouerait ici.
    const premierJour = document.querySelector('h4.prep-consumables__day');
    expect(premierJour?.textContent).toBe('Jour 1');
    const lignesJour1 = premierJour?.nextElementSibling?.querySelectorAll(
      'li[data-prep-row="eau"]',
    ).length;
    expect(lignesJour1).toBe(segmentsForDay(MODELE, 1).length);
    expect(lignesJour1).toBeGreaterThan(1);
  });

  it('04 - aucun litre invente : la portee reste « a verifier »', () => {
    // Le moteur ne publie AUCUNE portee : le champ existe pour l accueillir.
    for (const segment of waterSegments(MODELE)) {
      expect(segment.litersPerPerson).toBeNull();
    }
    render(<ConsumablesSheet draft={BROUILLON} actions={sansActions()} />);
    const corps = document.body.textContent ?? '';
    // Le tiroir affiche l etat honnete...
    expect(corps).toContain(A_VERIFIER);
    // ...et aucun litre, aucun debit, aucune portee, meme « 0 L ».
    expect(corps).not.toMatch(/\d+([.,]\d+)?\s*L\b/);
    expect(corps).not.toMatch(/\d+([.,]\d+)?\s*litres?\b/i);
  });

  it('05 - un segment sans ravitaillement qui le ferme le DIT', () => {
    // Aucun ravitaillement du programme reel n est un lieu confirme : chaque
    // portion se termine donc sans point de remplissage nomme.
    const segments = waterSegments(MODELE);
    expect(segments.every((segment) => segment.closedByPlaceName === null)).toBe(true);
    render(<ConsumablesSheet draft={BROUILLON} actions={sansActions()} />);
    const corps = document.body.textContent ?? '';
    expect(corps).toContain('Aucun ravitaillement identifié');
  });

  it('06 - les repas restent par journee', () => {
    const besoins = mealNeeds(MODELE);
    const ouverts = uncoveredMeals(besoins);
    // Chaque repas ouvert porte un jour et un creneau reels du programme.
    for (const besoin of ouverts) {
      expect(besoin.day).toBeGreaterThanOrEqual(1);
      expect(besoin.day).toBeLessThanOrEqual(MODELE.days);
    }
    render(<ConsumablesSheet draft={BROUILLON} actions={sansActions()} />);
    const lignes = document.querySelectorAll('li[data-prep-row="repas"]');
    expect(lignes.length).toBe(ouverts.length);
    for (const ligne of lignes) {
      expect(ligne.textContent ?? '').toMatch(/^Jour \d+ ·/);
    }
  });

  it('07 - sans programme, le tiroir dit ce qui manque', () => {
    const vide: AdventurePrepDraft = { ...BROUILLON, itinerary: null };
    render(<ConsumablesSheet draft={vide} actions={sansActions()} />);
    const etats = screen.getAllByRole('status');
    expect(etats.length).toBeGreaterThan(0);
    for (const etat of etats) {
      expect((etat.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
    // Aucun segment, aucun repas : rien n'est invente pour occuper l ecran.
    expect(document.querySelectorAll('li[data-prep-row="eau"]')).toHaveLength(0);
    expect(document.querySelectorAll('li[data-prep-row="repas"]')).toHaveLength(0);
  });
});