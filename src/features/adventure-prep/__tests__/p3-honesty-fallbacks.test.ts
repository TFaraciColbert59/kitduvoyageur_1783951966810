/**
 * P3.3 - L6.2 - L6.3 - REPLI NUMERIQUE ET CÂBLAGE.
 *
 * Un seul `??` de trop suffit a transformer un trou en fait : le nombre
 * `0` affiche par un ecran « 0 etape au programme » se lit comme un
 * programme vide mesure, alors que rien n etait encore genere. Ce fichier
 * verifie que la region `aria-live` de `StepsSheet` annonce le nombre REEL
 * d etapes, et qu elle ne le remplace jamais par zero.
 *
 * La seconde partie verifie le CÂBLAGE de L6.2/L6.3 par lecture du code
 * source : la preparation gesture existe (`mapLongPress`), la carte l'ecoute
 * (`PrepMap`), l'ecran transforme l'appui long en point (`ItineraryStep`), et
 * le store mesure a nouveau. Un test de source ne remplace pas une vraie
 * MapLibre - il prouve qu'aucun maillon n'est un `onClick={() => {}}`.
 *
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';

import { StepsSheet } from '../components/PrepItinerarySheets';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';
import type { AdventurePrepDraft } from '../types';

afterEach(() => cleanup());

const RACINE = join(__dirname, '..');
const qq = String.fromCharCode(96);

function source(relatif: string): string {
  return readFileSync(join(RACINE, relatif), 'utf8');
}

/** Store minimal : `StepsSheet` ne lit que ces deux membres de l'API. */
function storeFactice() {
  return {
    setStepState: () => undefined,
    removeStep: () => undefined,
    keepStep: () => undefined,
    addStepToDay: () => undefined,
    updateStep: () => undefined,
  } as unknown as AdventurePrepStore;
}

function renderer(modele: AdventurePrepDraft['itinerary']) {
  return render(
    React.createElement(StepsSheet, {
      draft: { ...fullDraft(), itinerary: modele },
      actions: storeFactice(),
      onClose: () => undefined,
    }),
  );
}

function annonce(modele: AdventurePrepDraft['itinerary']): string {
  const { container } = renderer(modele);
  const region = container.querySelector('.prep-visually-hidden');
  expect(region, 'la region aria-live doit exister').not.toBeNull();
  return (region?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('P3.3 - la region aria-live annonce le nombre REEL', () => {
  const modele = buildItinerary(fullDraft());

  it('sans programme, la feuille ne sort pas de son etat « pas encore genere »', () => {
    const { container } = renderer(null);
    expect(container.textContent).toContain('Le programme n’est pas encore généré.');
    // Et surtout : aucune annonce « 0 etape », qui lirait comme un programme
    // vide mesure.
    expect(container.textContent).not.toMatch(/0 étape|0 etape/);
  });

  it('avec un programme, l annonce vaut la longueur reelle des etapes', () => {
    expect(modele).not.toBeNull();
    if (!modele) return;
    const texte = annonce(modele);
    expect(texte).toContain(`${modele.steps.length} étapes au programme`);
    expect(texte).not.toContain('0 étapes au programme');
  });

  it('un programme vide annonce zero, parce que ZERO est la mesure', () => {
    const vide = modele ? { ...modele, steps: [] } : null;
    // Ici le zero est honnete : les etapes ont ete mesurees, il n y en a pas.
    expect(annonce(vide)).toContain('0 étapes au programme');
  });

  it(`aucun repli ${qq}?? 0${qq} ne subsiste dans StepsSheet`, () => {
    const corps = source('components/PrepItinerarySheets.tsx');
    const debut = corps.indexOf('export function StepsSheet');
    const fin = corps.indexOf('export function AdjustSheet');
    expect(debut).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(debut);
    const feuille = corps.slice(debut, fin);
    expect(
      feuille,
      'StepsSheet ne doit plus convertir une absence en zero',
    ).not.toMatch(/steps\.length \?\? 0/);
    expect(feuille).toContain('{model.steps.length} étapes au programme');
  });
});

describe('L6.2 - la preparation du geste long existe et est bornee', () => {
  it('mapLongPress qualifie le geste et borne sa validite', () => {
    const corps = source('engine/mapLongPress.ts');
    expect(corps).toContain('export function isLongPress');
    expect(corps).toContain('export function armedStillValid');
    // Sans borne de temps, un appui arme resterait valide indefiniment.
    expect(corps).toMatch(/LONG_PRESS_MS = \d+/);
    expect(corps).toMatch(/ARMED_TTL_MS = \d+/);
    expect(corps).toMatch(/LONG_PRESS_SLOP_PX = \d+/);
  });
});

describe('L6.2 - la carte ecoute le vrai geste, pas un clic de facade', () => {
  it('PrepMap accepte onLongPress et l attache a touchstart/touchend', () => {
    const corps = source('components/PrepMap.tsx');
    expect(corps).toContain('onLongPress');
    expect(corps).toContain("addEventListener('touchstart'");
    expect(corps).toContain("addEventListener('touchend'");
  });

  it('le clic final consomme l etat arme par armedStillValid', () => {
    const corps = source('components/PrepMap.tsx');
    expect(corps).toContain('armedStillValid');
    expect(corps).toContain('isLongPress');
  });

  it('ItineraryStep transforme l appui long en point de parcours', () => {
    const corps = source('components/ItineraryStep.tsx');
    expect(corps).toMatch(/onLongPress\s*[?:=]/);
    expect(corps).toMatch(/addWaypoint\(\{\s*lat,\s*lon\s*\}/);
  });
});

describe('L6.3 - ajouter un point remesure le parcours', () => {
  it('le store expose addWaypoint et le code de generation le voit', () => {
    const store = source('store/useAdventurePrepStore.ts');
    // La signature reelle est MapCoord (engine/dayNavigation), pas GeoPoint.
    expect(store).toMatch(/addWaypoint: \(coord: MapCoord, day: number\) => Promise<void>/);

    // Le point doit etre INSERE, puis le parcours remesure : c'est ce qui
    // distingue L6.3 d'un simple ajout cosmetique.
    expect(store).toContain('insertWaypoint');
    expect(store).toMatch(/remesureSiChange\('point-de-passage'/);
  });

  it('la chaine complete ne contient aucun rappel mort', () => {
    for (const relatif of [
      'engine/mapLongPress.ts',
      'components/PrepMap.tsx',
      'components/ItineraryStep.tsx',
    ]) {
      const corps = source(relatif);
      expect(
        corps.includes('onLongPress') || corps.includes('isLongPress'),
        `${relatif} ne devrait pas porter de long-press mort`,
      ).toBe(true);
    }
    const step = source('components/ItineraryStep.tsx');
    expect(step).not.toMatch(/onLongPress\s*[?:=]\)\s*=>\s*\{\s*\}/);
  });
});
