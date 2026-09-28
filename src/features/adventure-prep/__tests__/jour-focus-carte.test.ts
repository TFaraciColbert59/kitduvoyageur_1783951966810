/**
 * LOT 1 -- Cartes reelles et navigation par jour.
 *
 * Quatre defauts mesures a l instant sur 393x852, le 2026-09-28 :
 *
 *  - L1. Le tiroir de lieu n affichait aucune carte : `MiniMap` etait un div
 *       pose sur une grille CSS, avec une projection homemade (`PICKER_HALF_SPAN_DEG`)
 *       qui inventait des coordonnees. Aucune tuile, donc « aucune carte ne
 *       s affiche ». Le tiret doit desormais etre la VRAIE carte (celle du hub),
 *       et la pose d un point doit venir de `onMapClick`, pas d un pourcentage.
 *  - L2. La carte de l etape 3 superposait deux jeux de controles : le rail de
 *       `UnifiedExplorerMap` (globe + zoom) AU-DESSUS de « Agrandir / Recentrer ».
 *       Un seul jeu, celui du preparateur.
 *  - L3. Les onglets J1/J2/J3 n avaient aucun effet sur l etape 3 : les trois
 *       jours etaient rendus d un bloc, `selectedDay` n etait consomme nulle part
 *       dans `DepartureStep`.
 *  - L4. `focusedDayNumbers` doit forgiving : un `selectedDay` hors borne ne
 *       doit jamais laisser l ecran vide.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { focusedDayNumbers } from '../components/DepartureStep';
import { pickerRouteCoords, pickerSpanFor } from '../components/PrepSetupSheets';

const read = (relative: string): string =>
  readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

const DEPARTURE = read('components/DepartureStep.tsx');
const SETUP = read('components/PrepSetupSheets.tsx');
const PREP_MAP = read('components/PrepMap.tsx');
const HUB_GLOBE = read('../hub/components/mobile/HubGlobeMap.tsx');
const UNIFIED = read('../../components/map/UnifiedExplorerMap.tsx');
const CSS = read('adventure-prep.css');

describe('L1 -- le tiroir de lieu montre une vraie carte', () => {
  it('MiniMap rend la carte reelle, pas une grille', () => {
    expect(SETUP).toContain('HubGlobeMap');
  });

  it('la projection homemade de la grille disparaît', () => {
    expect(SETUP).not.toContain('PICKER_HALF_SPAN_DEG');
  });

  it('la pose d un point vient de onMapClick, en coordonnees reelles', () => {
    expect(SETUP).toContain('onMapClick');
  });

  it('pickerRouteCoords donne deux points distincts a la carte', () => {
    const coords = pickerRouteCoords({ lat: 45.98, lon: 6.92 }, null);
    expect(coords).toHaveLength(2);
    // Deux points identiques feraient scornir HubGlobeMap (il exige un trace).
    expect(coords[0]).not.toEqual(coords[1]);
    expect(coords[0][0]).toBeCloseTo(45.98, 5);
  });

  it('un point pose remplace la seconde extremite', () => {
    const picked = { lat: 45.99, lon: 6.93 };
    const coords = pickerRouteCoords({ lat: 45.98, lon: 6.92 }, picked);
    expect(coords[1]).toEqual([picked.lat, picked.lon]);
  });

  it('le perimetre de la carte est assez grand pour distinguer deux communes', () => {
    expect(pickerSpanFor(0)).toBeGreaterThan(0);
    expect(pickerSpanFor(1)).toBeLessThan(pickerSpanFor(0));
  });
});

describe('L2 -- un seul jeu de controles sur la carte', () => {
  it('HubGlobeMap sait masquer son propre rail', () => {
    expect(HUB_GLOBE).toContain('hideBuiltInControls');
  });

  it('le rail de controles respecte ce drapeau', () => {
    expect(UNIFIED).toContain('hideBuiltInControls');
  });

  it('la carte du preparateur le demande', () => {
    expect(PREP_MAP).toContain('hideBuiltInControls');
  });
});

describe('L3 -- les onglets de jour pilotent vraiment l etape 3', () => {
  it('DepartureStep consomme le store jour', () => {
    expect(DEPARTURE).toContain('useDayFocusStore');
    expect(DEPARTURE).toContain('selectedDay');
  });

  it('la liste des jours passe par le filtre', () => {
    expect(DEPARTURE).toContain('focusedDayNumbers');
  });

  it('sans selection, tous les jours restent affiches', () => {
    expect(focusedDayNumbers(3, null)).toEqual([1, 2, 3]);
  });

  it('une selection isole le jour', () => {
    expect(focusedDayNumbers(3, 2)).toEqual([2]);
  });

  it('une selection hors borne ne vide pas l ecran', () => {
    expect(focusedDayNumbers(3, 9)).toEqual([1, 2, 3]);
    expect(focusedDayNumbers(0, 1)).toEqual([1]);
  });
});

describe('L4 -- le rail de jours ne deborde pas en 393', () => {
  it('il defile horizontalement au lieu de deborder', () => {
    expect(CSS).toMatch(/prep-map__dayrail[^}]*overflow-x/);
  });
});


