/**
 * Tiroir Lieu — L4.6 « aucune suggestion en coordonnees brutes ».
 *
 * Defaut mesure et rejoue (2026-09-29, 393x852, `qa-local/tiroir/pose-sans-nom.png`
 * puis `liste-sans-nom.png`) : on pose un point sur la carte sans lui donner de
 * nom, on valide, on rouvre le tiroir. Le point est memorise — et la liste
 * affiche alors
 *   Point sans nom verifie
 *   Coordonnees : 46.79907° N 2.56303° E
 * C'est a dire des nombres bruts la ou la personne attendait un lieu, et un
 * nom de lieu (« Point sans nom verifie ») qui n'en est pas un.
 *
 * Regle du proprietaire, appliquee telle quelle : « si une suggestion n'a pas
 * de nom lisible, elle ne s'affiche pas — pas de coordonnees. »
 *
 * Ce qui ne change pas : le contrat des lignes (`placeRowTitle` /
 * `placeRowDetail`, items DPL-09) reste intact. C'est le tiroir qui refuse
 * d'afficher la ligne, pas la ligne qui ment sur elle-meme. Un contre-exemple
 * le verifie explicitement, pour qu'on ne puisse pas « reparer » L4.6 en
 * vidant la liste entiere.
 */

import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PlaceSheet, isDisplayableSuggestion, placeRowDetail, placeRowTitle } from '../components/PrepSetupSheets';
import { fullDraft } from './fixtures';
import type { PlaceCandidate } from '../placeCandidates';
import type { PlaceRef } from '../types';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';

const CLE = 'lkdv_prep_recent_places_v1';

const actions = {
  setRoute: () => undefined,
  setCalendar: () => undefined,
  setGroup: () => undefined,
} as unknown as AdventurePrepStore;

const noop = () => undefined;

/** Le point nu pose sur la carte, puis memorise par une session anterieure. */
const POINT_NU: PlaceRef = {
  id: 'point-46.79907-2.56303',
  name: '',
  country: '',
  lat: 46.79907,
  lon: 2.56303,
};

/** Un lieu nomme : la liste a toujours le droit de l'afficher. */
const CHAMONIX: PlaceRef = {
  id: 'geo-chamonix-france-45.923-6.869',
  name: 'Chamonix-Mont-Blanc',
  country: 'France',
  lat: 45.9237,
  lon: 6.8694,
};

const sansFenetre = (globalThis as { window?: unknown }).window;

/** Le tiroir lit `window.localStorage` au rendu : on lui en donne un. */
function avecMemoires(places: PlaceRef[]): string {
  const contenu = new Map<string, string>([[CLE, JSON.stringify(places)]]);
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (cle: string) => contenu.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => void contenu.set(cle, valeur),
      removeItem: (cle: string) => void contenu.delete(cle),
    },
  };
  return renderToStaticMarkup(
    React.createElement(PlaceSheet, { draft: fullDraft(), actions, onClose: noop, field: 'origin' }),
  );
}

const texte = (html: string | undefined): string =>
  (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Les lignes de resultats, texte lu.
 *
 * On lit le titre (`.t1`) et le detail (`.t2`) de chaque ligne, pas le
 * tiroir entier : la legende de la carte (`.prep-picker__caption-*`) affiche
 * elle aussi des coordonnees, celles du lieu courant, et c'est voulu — contrat
 * AN5, verifie par `picker-caption-an5.test.ts`. Ce test parle de la LISTE.
 */
function lignes(html: string): string[] {
  return [
    ...html.matchAll(/class="t1">([\s\S]*?)<\/div><div class="t2">([\s\S]*?)<\/div>/g),
  ].map((m) => `${texte(m[1])} ${texte(m[2])}`.trim());
}

afterEach(() => {
  if (sansFenetre === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window?: unknown }).window = sansFenetre;
});

describe('L4.6 — une suggestion sans nom lisible ne s affiche pas', () => {
  it('le point nu est ecarte de la liste, et avec lui ses coordonnees', () => {
    const html = avecMemoires([POINT_NU]);
    const liste = lignes(html);
    expect(liste.join(' | '), 'le point sans nom est encore propose').not.toContain('Point sans nom');
    // Le symptome mesure : la ligne affichait « Coordonnees : 46.79907° N ... ».
    // Cette formule n'existe que dans le detail d'une ligne sans nom : le
    // controle porte sur tout le tiroir.
    expect(html, 'des coordonnees brutes sont affichees dans la liste').not.toMatch(
      /Coordonn(?:e|é)es\s*:\s*\d+\.\d+/,
    );
    // Les degrades « 45.92370° N » de la legende, eux, sont voulus (AN5) :
    // on ne juge donc que les lignes.
    expect(liste.join(' | '), 'des coordonnees brutes sont affichees dans la liste').not.toMatch(
      /\d+\.\d{3,}\s*°\s*[NEOS]/,
    );
  });

  it('contre-exemple : un lieu nomme reste propose, avec son nom', () => {
    // Sans ce contre-exemple, le test passerait aussi si la liste etait vide
    // pour une mauvaise raison — on ne prouverait plus rien sur le filtre.
    const liste = lignes(avecMemoires([POINT_NU, CHAMONIX]));
    expect(liste.join(' | ')).toContain('Chamonix-Mont-Blanc');
    expect(liste.join(' | ')).not.toContain('Point sans nom');
  });

  it('un nom qui n est que des espaces ne compte pas comme un nom lisible', () => {
    const liste = lignes(avecMemoires([{ ...CHAMONIX, id: 'blanc', name: '   ' }]));
    expect(liste, 'un nom de seuls espaces a passe pour un nom lisible').toEqual([]);
  });

  it('le filtre porte sur le nom, et rien d autre', () => {
    const candidate = (place: PlaceRef): PlaceCandidate => ({
      place,
      source: 'remembered',
      precision: 'commune',
      context: null,
      hint: null,
    });
    expect(isDisplayableSuggestion(candidate(CHAMONIX))).toBe(true);
    expect(isDisplayableSuggestion(candidate(POINT_NU))).toBe(false);
    expect(isDisplayableSuggestion(candidate({ ...CHAMONIX, name: '  ' }))).toBe(false);
    // Un point sans nom mais avec des coordonnees ne redevient pas affichable
    // parce qu'il « a des coordonnees » : c'est justement l'inverse.
    expect(isDisplayableSuggestion(candidate({ ...POINT_NU, name: '' }))).toBe(false);
  });

  it('le contrat des lignes sans nom reste intact pour qui l appelle (DPL-09)', () => {
    // On ne « repare » pas L4.6 en cassant le contrat des lignes : le tiroir
    // filtre, la ligne sait toujours se decrire.
    expect(placeRowTitle(POINT_NU)).toBe('Point sans nom vérifié');
    expect(placeRowDetail(POINT_NU, {
      place: POINT_NU,
      source: 'remembered',
      precision: 'commune',
      context: null,
      hint: null,
    })).toContain('Coordonnées');
  });
});
