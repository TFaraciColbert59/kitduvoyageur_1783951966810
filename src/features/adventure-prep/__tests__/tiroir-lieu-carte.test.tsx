/**
 * Tiroir Lieu - L4.4 « une carte basse avec le point choisi ».
 *
 * MESURE (2026-09-29, 393x852, `qa-local/tiroir/cadre-a-avant.png` puis
 * `qa-local/tiroir/tiroir-css.mjs`) : le tiroir rend BIEN une carte, et BIEN
 * le point choisi. Ce qui manque, c'est le CADRE.
 *
 *   .prep-picker   : 353 x 150   <- le cadre du tiroir, bas, comme voulu
 *   .hub-globe-map : 351 x 320   <- la carte a l'interieur du cadre
 *
 * La carte deborde donc de 170px sous son cadre, et le point choisi cesse
 * d'etre centre : il est ecrase vers le haut, hors du regard. Pour qui regarde,
 * la carte du tiroir n'existe pas.
 *
 * LA CAUSE EST LE CSS, PAS LE CODE. Deux regles se disputent la meme
 * propriete, a la MEME specificite (0,1,0) :
 *
 *   hub-map-liquid.css:15  .hub-globe-map      { min-height: 20rem }   (320px)
 *   adventure-prep.css:3009 .prep-picker__map  { min-height: 0; height:100% }
 *
 * A specificite egale, le dernier qui parle gagne : c'est la regle du hub.
 * `adventure-prep.css:1399` resout deja ce conflit pour la carte de l'ecran
 * avec `.prep-map:not(.prep-map--full) .hub-globe-map` (0,3,0) - le tiroir n'a
 * pas droit au meme traitement, et c'est ce qui le laisse deborder.
 *
 * PREUVE : la regle a ete injectee dans le navigateur avant d'etre ecrite,
 * puis mesuree (320 -> 148px, point centre), puis posee dans le CSS.
 * `qa-local/tiroir/css-apres-crop.png` garde la mesure d avant.
 *
 * L4.4 EST DONC FERME. Ce fichier verrouille desormais la regle reellement
 * ecrite, en plus de ce qui l'accompagne (le cadre bas, la vraie carte, le
 * point reellement porte). Le test est passe de `it.fails` a `it` : sa
 * valeur est qu'il MORD. Saboter la cascade (retirer le bloc
 * `.prep-picker .hub-globe-map`) le fait retomber au rouge ; tant qu'il est
 * vert, la regle tient.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PlaceSheet, pickerRouteCoords } from '../components/PrepSetupSheets';
import { fullDraft } from './fixtures';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';

const read = (relative: string): string =>
  readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

const SETUP = read('components/PrepSetupSheets.tsx');
const CSS = read('adventure-prep.css');
const HUB = read('../hub/components/mobile/hub-map-liquid.css');

const actions = {
  setRoute: () => undefined,
  setCalendar: () => undefined,
  setGroup: () => undefined,
} as unknown as AdventurePrepStore;

const tiroir = (): string =>
  renderToStaticMarkup(
    React.createElement(PlaceSheet, {
      draft: fullDraft(),
      actions,
      onClose: () => undefined,
      field: 'origin',
    }),
  );

describe('L4.4 - le tiroir rend une carte basse, avec le point choisi', () => {
  it('le cadre du tiroir est bien present et bien bas', () => {
    // 150px : la carte basse du tiroir. Un cadre de 320px serait la carte de
    // l'ecran recopiee, pas une carte de tiroir.
    expect(tiroir()).toContain('class="prep-picker" style="height:150px');
  });

  it('c est la vraie carte du hub, pas une grille de projection', () => {
    // Une grille CSS avec des coordonnees inventees ne peut pas afficher « le
    // point choisi » : elle ne sait pas ou on a clique.
    expect(SETUP).toContain('HubGlobeMap');
    expect(SETUP).not.toContain('PICKER_HALF_SPAN_DEG');
  });

  it('le point choisi est passe a la carte comme un vrai repere', () => {
    expect(SETUP).toContain('points={markerPoints}');
    expect(SETUP).toContain('routeCoords={routeCoords}');
  });

  it('le repere porte le nom du lieu, pas un nombre', () => {
    const debut = SETUP.indexOf('const markerPoints');
    const bloc = SETUP.slice(debut, debut + 900);
    expect(bloc).toContain("id: 'picker-point'");
    expect(bloc).toContain('shown?.name');
    // Un point pose sans nom ne se nomme pas par ses coordonnees.
    expect(bloc).not.toMatch(/label:[^}]*formatCoord/);
  });

  it('sans point pose, la carte recoit deux extremites distinctes', () => {
    // Contrat de `HubGlobeMap` (et de `jour-focus-carte.test.ts`) : deux points
    // identiques le font scornir. Sans point pose, la seconde extremite cadre
    // la region ; ce n'est pas une destination inventee, c'est une echelle.
    const coords = pickerRouteCoords({ lat: 45.98, lon: 6.92 }, null);
    expect(coords).toHaveLength(2);
    expect(coords[0]).not.toEqual(coords[1]);
  });

  it('un point pose remplace la seconde extremite', () => {
    const pose = { lat: 45.99, lon: 6.93 };
    expect(pickerRouteCoords({ lat: 45.98, lon: 6.92 }, pose)[1]).toEqual([pose.lat, pose.lon]);
  });
});

describe('L4.4 - le cadre doit tenir la carte (regle CSS attendue)', () => {
  it('le hub impose bien 20rem : le conflit est reel', () => {
    expect(HUB).toMatch(/\.hub-globe-map\s*\{[^}]*min-height:\s*20rem/);
  });

  it('la regle de la carte de l ecran existe deja, en (0,3,0)', () => {
    // Le modele a recopier est deja la, dans le meme fichier, quelques lignes
    // plus haut. Sans lui, on ne prouve pas qu'il y a une lacune : on prouve
    // qu'on l'a lue.
    expect(CSS).toMatch(/\.prep-map:not\(\.prep-map--full\)\s+\.hub-globe-map\s*\{[^}]*min-height:\s*0/);
  });

  it('une regle (0,2,0) cadre la carte du tiroir dans son cadre de 150px', () => {
    // L4.4 : correction posee, en miroir de `adventure-prep.css:1399` :
    //   .prep-picker .hub-globe-map,
    //   .prep-picker .prep-picker__map { min-height: 0; height: 100%; }
    // Un selecteur qui porte `.prep-picker` ET une classe descendante vaut au
    // moins (0,2,0) : il bat le `min-height: 20rem` du hub, qui n'en vaut
    // qu'un (0,1,0).
    // On lit du CSS EFFECTIF, pas du texte : les commentaires sont
    // neutralises avant toute recherche. Une regle documentee cite des
    // declarations entourees d accolades -- exactement la forme qu'on cherche
    // -- et un lecteur naif les confond avec une regle reelle. C'est un piege
    // de lecture, pas une regle.
    const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

    // On exige le MOT exact `hub-globe-map` dans le selecteur. C'est la
    // classe que `hub-map-liquid.css` impose a (0,1,0) avec 20rem, donc la
    // seule que la regle doit couvrir. Un selecteur generique qui porterait
    // `.prep-picker` sans nommer la carte ne resoudrait rien -- et un test qui
    // l'accepterait ne prouverait rien, puisque un placeholder le satisferait.
    // Le morsant le confirme : sans la regle, ce fichier passe au rouge.
    const regles = [...css.matchAll(/([^{}]*\.hub-globe-map[^{}]*)\{([\s\S]*?)\}/g)]
      .map(([, selecteur, corps]) => [selecteur, corps] as const)
      .filter(([selecteur]) =>
        selecteur
          .split(',')
          .map((part) => part.trim())
          .some((part) => /^\.prep-picker\b/.test(part)),
      );

    expect(
      regles.some(([, corps]) => /min-height:\s*0\s*;/.test(corps) && /height:\s*100%\s*;/.test(corps)),
      'L4.4 regresse : aucune regle `.prep-picker ... .hub-globe-map` ne cadre la carte ; le tiroir deborde de 170px et le point choisi n\'est plus centre',
).toBe(true);
  });
});
