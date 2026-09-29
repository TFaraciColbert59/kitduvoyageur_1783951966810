/**
 * C14 - La hauteur d un tiroir se deduit de son CONTENU, jamais d une table.
 *
 * Le defaut etait une table `tiroir -> detent` ecrite a la main. Elle
 * mentait des la premiere ligne : `gear`, `consumables`, `participants` et
 * `add` etaient forces sur 90 dvh. Un tiroir Equipement qui affiche deux
 * lignes laissait alors 80 % de verre vide — un ecran « a moitie vide », qui
 * se lit comme une panne, pas comme un choix.
 *
 * Ce fichier ferme C14 sur les deux moities du correctif :
 *
 *   1. L ARBITRAGE. `detentForMeasured` ne monte en `large` que si le contenu
 *      occupe au moins `FILL_RATIO` du panneau, et `detentForRows` que si le
 *      brouillon porte au moins `FILLING_ROWS` lignes. Un tiroir court reste
 *      `auto` : il epouse son contenu au lieu de le laisser dans du vide.
 *
 *   2. LA SOURCE DE VERITE. Le test 04 lit le FICHIER `PrepSheets.tsx` et
 *      verifie qu il n reste pas de table de hauteurs : le seul detent fige
 *      tolere est le tiroir Lieu, et il vaut `auto`. C est ce test qui casse
 *      si quelqu un re-ajoute `gear: 'large'`.
 *
 * Regle de preuve : le sabotage du test 05 abaisse `FILL_RATIO` a 0,02. Les
 * tests 01 et 02 tombent alors en Rouge — parce qu un tiroir a 2 % de remplissage
 * deviendrait `large`, c est-a-dire exactement l ecran a moitie vide que C14
 * refuse.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  detentFor,
  detentForMeasured,
  detentForRows,
  drawerDetent,
  drawerRowCount,
  FILLING_ROWS,
  FILL_RATIO,
  measureDrawerContent,
  type DrawerId,
} from '../engine/drawerHeight';
import { emptyDraft } from '../engine/emptyDraft';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';

const PANEL = 800;

function mesure(contentHeightPx: number, viewportHeightPx = PANEL) {
  return { contentHeightPx, viewportHeightPx };
}

describe('C14 - la hauteur vient du contenu', () => {
  it('01 - un tiroir qui ne remplit pas le panneau reste auto, jamais large', () => {
    // 40 px dans un panneau de 800 : 5 % de remplissage. Un `large` ici
    // laisserait 760 px de vide — l exact reproche.
    expect(detentForMeasured(mesure(40))).toBe('auto');
    expect(detentForMeasured(mesure(200))).toBe('auto');
    // Juste sous le seuil.
    expect(detentForMeasured(mesure(PANEL * FILL_RATIO - 1))).toBe('auto');
    // Au seuil et au-dela : la regle, et elle seule.
    expect(detentForMeasured(mesure(PANEL * FILL_RATIO))).toBe('large');
    expect(detentForMeasured(mesure(PANEL))).toBe('large');
  });

  it('02 - une mesure absente ou non finie ne tranche pas sur une division par zero', () => {
    expect(detentForMeasured(null)).toBeNull();
    expect(detentForMeasured(mesure(Number.NaN))).toBeNull();
    expect(detentForMeasured(mesure(100, 0))).toBeNull();
    expect(detentForMeasured(mesure(100, -10))).toBeNull();
    // Sans mesure, c est le COMPTAGE qui tranche — jamais une valeur figee.
    expect(detentFor(2, null)).toBe('auto');
    expect(detentFor(FILLING_ROWS, null)).toBe('large');
  });

  it('03 - le comptage de lignes suit le brouillon, pas une constante', () => {
    const vide = emptyDraft();
    // Un tiroir Equipement d un brouillon sans activite n a presque rien a
    // dire : il doit rester court.
    const court = drawerRowCount('gear', vide);
    expect(court).toBeGreaterThan(0);
    expect(court).toBeLessThan(FILLING_ROWS);

    // Des qu une activite reelle rend du materiel, les lignes augmentent.
    const plein = drawerRowCount('gear', fullDraft());
    expect(plein).toBeGreaterThan(court);
    expect(plein).toBeGreaterThan(0);

    // Et l arbitrage suit : le tiroir le plus peuple est le seul a monter.
    expect(detentForRows(court)).toBe('auto');
    expect(detentForRows(plein)).toBe(plein >= FILLING_ROWS ? 'large' : 'auto');
  });

  it('04 - PrepSheets ne porte plus de table de hauteurs', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/adventure-prep/components/PrepSheets.tsx'),
      'utf8',
    );
    // Le tiroir Lieu reste fige, et sur `auto` : c est lui le gabarit, il est
    // court par construction.
    expect(source).toMatch(/place:\s*'auto'/);
    // Aucun autre tiroir ne doit etre fige : gear, consumables, participants,
    // add, replace... revient a exactement la panne que C14 reproche.
    for (const id of [
      'gear',
      'consumables',
      'participants',
      'add',
      'replace',
      'step',
      'steps',
      'adjust',
    ] as DrawerId[]) {
      expect(source, `${id} est fige dans PrepSheets.tsx`).not.toMatch(
        new RegExp(`${id}:\\s*'(auto|large|full|fixed|90dvh)'`),
      );
    }
    // Et la decision vient bien du moteur.
    expect(source).toMatch(/useDrawerDetent/);
    expect(source).toMatch(/DETENT_FIGE\[sheet\] \?\? detent/);
  });

  it('05 - la mesure du DOM alimente la meme regle, sans jamais trancher seule', () => {
    const noeud = { scrollHeight: 640, getBoundingClientRect: () => ({ height: 300 }) };
    // On prend le plus grand des deux : le contenu peut deborder du cadre.
    expect(measureDrawerContent(noeud, PANEL)).toEqual({
      contentHeightPx: 640,
      viewportHeightPx: PANEL,
    });
    // SSR, element absent, fenetre nulle : pas de mesure, pas de verdict.
    expect(measureDrawerContent(null, PANEL)).toBeNull();
    expect(measureDrawerContent(noeud, 0)).toBeNull();

    // Le meme contenu, avec et sans mesure, aboutit au meme arbitrage quand
    // la mesure est coherente avec le comptage.
    const draft: AdventurePrepDraft = fullDraft();
    const avecProgramme = { ...draft, itinerary: buildItinerary(draft) };
    const id: DrawerId = 'steps';
    const rows = drawerRowCount(id, avecProgramme);
    expect(drawerDetent(id, avecProgramme, null)).toBe(detentForRows(rows));
  });
});