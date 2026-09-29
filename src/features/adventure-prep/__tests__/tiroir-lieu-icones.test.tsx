/**
 * Tiroir Lieu — L4.2 « Ma position » et L4.3 « Choisir sur la carte ».
 *
 * Les deux gestes sont DEJA reduits a une icone. Ce test ne les re-decouvre
 * pas : il les verrouille, parce que ces deux items se re-cassent tres
 * facilement — on remet un libelle « pour la comprehension », et l'icone
 * redevient un bouton de texte.
 *
 * La regle de reference est celle de la ligne Depart (item L2.3, deja
 * eprouve dans `l2-etape1-lignes.test.tsx`) : le texte visible disparait,
 * le NOM ACCESSIBLE reste. La mecanique differe — la ligne Depart garde le
 * mot dans `.prep-visually-hidden`, la feuille porte un `aria-label` sur le
 * bouton — mais la regle est la meme : un bouton sans nom n existe pas pour
 * un lecteur d'ecran.
 *
 * Chaque assertion a son contre-exemple : sans lui, « pas de texte »
 * passerait aussi si le tiroir etait vide.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PlaceSheet } from '../components/PrepSetupSheets';
import { fullDraft } from './fixtures';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';

const COMPONENT = path.resolve(__dirname, '../components/PrepSetupSheets.tsx');
/** Le source sans ses commentaires : une phrase ne doit pas piloter un test. */
const code = (): string =>
  readFileSync(COMPONENT, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

const actions = {
  setRoute: () => undefined,
  setCalendar: () => undefined,
  setGroup: () => undefined,
} as unknown as AdventurePrepStore;

const noop = () => undefined;

function render(): string {
  return renderToStaticMarkup(
    React.createElement(PlaceSheet, { draft: fullDraft(), actions, onClose: noop, field: 'origin' }),
  );
}

/** Le texte reellement lu : le balisage est efface, le nom accessible reste. */
function pourLesYeux(html: string): string {
  return html
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Le bouton porte de cet `aria-label`, balisage compris. */
function bouton(html: string, ariaLabel: string): string {
  const debut = html.indexOf(`aria-label="${ariaLabel}"`);
  expect(debut, `bouton « ${ariaLabel} » absent du tiroir`).toBeGreaterThan(-1);
  const ouverture = html.lastIndexOf('<button', debut);
  const fermeture = html.indexOf('</button>', debut);
  expect(ouverture).toBeGreaterThan(-1);
  expect(fermeture).toBeGreaterThan(debut);
  return html.slice(ouverture, fermeture + '</button>'.length);
}

/** La barre de recherche, du premier `prep-search` a sa fermeture. */
function barre(html: string): string {
  const debut = html.indexOf('class="prep-search"');
  expect(debut, 'la barre de recherche a disparu').toBeGreaterThan(-1);
  const fin = html.indexOf('</div>', html.indexOf('Choisir un point sur la carte'));
  return html.slice(debut, fin + '</div>'.length);
}

describe('L4.2 — « Ma position » est une icone boussole seule', () => {
  it('le bouton garde un nom accessible, sans un mot de plus a l ecran', () => {
    const html = render();
    const b = bouton(html, 'Utiliser ma position');
    // La regle de L2.3 : le texte lisible disparait, le nom accessible reste.
    expect(pourLesYeux(b)).toBe('');
    // Le defaut : supprimer le `aria-label` en croyant liberer la place. Le
    // bouton devient alors muet pour un lecteur d'ecran, sans que rien ne
    // change a l'image.
    expect(b).toMatch(/aria-label="Utiliser ma position"/);
  });

  it('c est bien la boussole qui reste, pas une autre icone', () => {
    const src = code();
    const icone = /aria-label="Utiliser ma position"[\s\S]{0,400}?<Icon\s+name="([a-z-]+)"/.exec(src);
    expect(icone?.[1] ?? '', 'le bouton « Ma position » ne porte plus la boussole').toBe('compass');
  });

  it('contre-exemple : le tiroir n a pas perdu ses autres libelles', () => {
    // Sans ce contre-exemple, « aucun texte » passerait aussi sur un tiroir
    // entierement muet — on ne prouverait alors plus rien sur la boussole.
    const html = render();
    expect(pourLesYeux(html)).toContain('Choisir ce lieu');
    expect(pourLesYeux(html)).toContain('Chamonix');
    // Le champ de recherche parle par son placeholder : pas de texte visible,
    // lui non plus - mais un nom accessible, la.
    expect(html).toContain('placeholder="Rechercher un lieu');
  });
});

describe('L4.3 — « Choisir sur la carte » est une icone carte, a droite dans la barre', () => {
  it('le bouton carte vit dans la barre de recherche, apres le champ', () => {
    const html = render();
    const b = barre(html);
    expect(b, 'le bouton carte a quitte la barre de recherche').toContain(
      'aria-label="Choisir un point sur la carte"',
    );
    const champ = b.indexOf('placeholder="Rechercher un lieu');
    const carte = b.indexOf('aria-label="Choisir un point sur la carte"');
    expect(champ).toBeGreaterThan(-1);
    expect(carte, 'la carte doit venir apres le champ, pas avant').toBeGreaterThan(champ);
  });

  it('le bouton carte est le dernier de la barre : il est a droite', () => {
    const b = barre(render());
    // Le defaut : un bouton separe, pose sous la barre ou dans un coin. On
    // verifie donc la position, pas la seule presence.
    const derniers = [...b.matchAll(/<button[\s\S]*?<\/button>/g)];
    expect(derniers.length).toBeGreaterThan(0);
    const dernier = derniers[derniers.length - 1]?.[0] ?? '';
    expect(dernier).toContain('aria-label="Choisir un point sur la carte"');
  });

  it('le bouton carte est une icone, avec un nom accessible, sans texte', () => {
    const b = bouton(render(), 'Choisir un point sur la carte');
    expect(pourLesYeux(b)).toBe('');
    const src = code();
    const icone = /aria-label="Choisir un point sur la carte"[\s\S]{0,400}?<Icon\s+name="([a-z-]+)"/.exec(
      src,
    );
    expect(icone?.[1] ?? '', 'le bouton carte ne porte plus l icone carte').toBe('map');
  });

  it('aucun bouton texte plein largeur ne propose de choisir sur la carte', () => {
    const html = render();
    expect(pourLesYeux(html)).not.toContain('Choisir sur la carte');
    // Contre-exemple : la carte reste atteignable, et par un seul chemin.
    expect(html.match(/aria-label="Choisir un point sur la carte"/g) ?? []).toHaveLength(1);
  });
});
