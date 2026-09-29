/**
 * Tiroir Lieu — L4.1 « un seul verre » et L4.5 « la hauteur suit le contenu ».
 *
 * Ces deux items ne se verifient pas sur une intention mais sur une surface :
 * le tiroir est un verre unique, et sa hauteur est celle de ce qu'il contient.
 *
 * L4.1 — le verre etait bon, mais un `backgroundColor: var(--surface)` pose
 * sur le pied du tiroir peignait un SECOND materiau, plat, par-dessus le
 * verre de la feuille. Mesure (2026-09-29, 393x852) : le pied rendait
 * `rgba(16,16,16,0.3)` SANS `backdrop-filter`, donc sans flou — visible comme
 * une bande plus sombre a bords durs, a la place exacte du bouton
 * « Choisir ce lieu » (`qa-local/tiroir/geo-ok.png`). Regle desormais : le
 * composant de tiroir ne peint AUCUN fond ; le verre vient de la feuille
 * seule (`body:has(.app-shell--preparer) .lkv-sheet-up`).
 *
 * L4.5 — le `marginTop: 'auto'` du meme pied etait l'ecarteur flex : quand le
 * contenu etait court, il poussait le bouton vers le bas et laissait le
 * tiroir a moitie vide. Le tiroir prend la hauteur de son contenu ; le
 * detent `auto` (`.lkv-sheet-up`, `PrepSheets.tsx`) fait le reste.
 *
 * Harnais : meme convention que `prep-drawers-liquid.test.tsx` — vitest en
 * `node`, donc `renderToStaticMarkup` pour le balisage, et le texte source
 * pour ce que seul le code peut garantir.
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
const SHELLS = path.resolve(__dirname, '../components/PrepSheets.tsx');
const CSS = path.resolve(__dirname, '../adventure-prep.css');
/** Le source SANS ses commentaires : un test de comportement ne doit pas
 *  pouvoir etre casse — ni passe — par une phrase dans un commentaire. */
const code = (): string =>
  readFileSync(COMPONENT, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
const source = (): string => readFileSync(COMPONENT, 'utf8');
const shell = (): string => readFileSync(SHELLS, 'utf8');
const css = (): string => readFileSync(CSS, 'utf8');

/** Le store n est jamais appele sous `renderToStaticMarkup` : un stub suffit. */
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

describe('L4.1 — le tiroir Lieu est un verre, et un seul', () => {
  it('le composant de tiroir ne peint aucun fond : le verre vient de la feuille', () => {
    // Le defaut : un fond en dur par-dessus le verre de la feuille. Une seule
    // declaration de `background` suffit a rouvrir la porte ; on la cherche
    // dans le CODE, pas seulement dans le rendu, parce qu'un fond pose par une
    // feuille de style future compterait aussi.
    const backgrounds = code()
      .split('\n')
      .map((line, index) => ({ index: index + 1, line }))
      .filter(({ line }) => /background(?:Color|-color)?\s*[:=]/.test(line));
    expect(
      backgrounds.map((b) => `${b.index}: ${b.line.trim()}`).join(' | '),
      'le tiroir Lieu ne doit poser aucun fond : un second materiau casse le verre',
    ).toBe('');
  });

  it('le pied du tiroir ne declare ni fond ni espacement pousse par le bas', () => {
    const html = render();
    const pied = html.slice(html.indexOf('class="prep-place-cta"'));
    expect(pied, 'le pied du tiroir a disparu').not.toBe('');
    expect(pied).not.toMatch(/background/i);
    expect(pied).not.toMatch(/margin-top:\s*auto/);
  });

  it('le verre de la feuille est toujours la, avec son flou et sa saturation', () => {
    // Non-regression : on ne casse pas ce qui est bon. Le verre du tiroir est
    // porte par la feuille partagee, pas par le composant.
    const feuille = css();
    expect(feuille).toContain('body:has(.app-shell--preparer) .lkv-sheet-up');
    const bloc = /body:has\(\.app-shell--preparer\) \.lkv-sheet-up\s*\{([^}]*)\}/.exec(feuille);
    expect(bloc, 'le verre du tiroir n est plus declare').not.toBeNull();
    const corps = bloc?.[1] ?? '';
    expect(corps).toMatch(/background-color:\s*var\(--prep-sheet-bg\)/);
    expect(corps, 'le verre du tiroir a perdu son flou').toMatch(
      /backdrop-filter:[^;]*blur\(var\(--prep-glass-blur\)\)/,
    );
    expect(corps, 'le verre du tiroir a perdu sa saturation').toMatch(/saturate\(/);
  });
});

describe('L4.5 — la hauteur du tiroir suit son contenu, jamais a moitie vide', () => {
  it('aucun espacement pousse par le bas ne survit dans le tiroir', () => {
    // Le defaut : `marginTop: 'auto'` sur le pied. Dans une colonne flex, il
    // occupe tout le vide restant — donc tiroir a moitie vide quand le
    // contenu est court.
    expect(code(), "le tiroir ne doit plus poser de `marginTop: 'auto'`").not.toMatch(
      /marginTop:\s*'auto'/,
    );
    expect(render(), 'le tiroir ne doit plus pousser son pied vers le bas').not.toMatch(
      /margin-top:\s*auto/,
    );
  });

  it('aucun espaceur flex ne repousse le bouton dans le tiroir', () => {
    // Le meme defaut, par un autre chemin : un element `flex: 1` ou
    // `flex-grow: 1` ferait la meme chose sans laisser de trace dans le
    // source sous forme de `marginTop`.
    const html = render();
    expect(html, 'le tiroir ne doit contenir aucun espacement elastique').not.toMatch(
      /flex:\s*1\b|flex-grow:\s*1/,
    );
  });

  it('le tiroir ne s impose aucune hauteur fixe : il l ignore', () => {
    const html = render();
    const racine = /<div style="([^"]*)"/.exec(html);
    expect(racine?.[1] ?? '', 'le tiroir ne doit pas fixer sa propre hauteur').not.toMatch(
      /height:\s*\d/,
    );
    // Le detent du tiroir Lieu reste `auto` : le panneau epouse son contenu.
    expect(shell(), "le tiroir Lieu doit rester en detent `auto`").toMatch(/place:\s*'auto'/);
  });

  it('le bouton de validation suit le dernier bloc, il ne flotte pas', () => {
    const html = render();
    const bouton = html.indexOf('Choisir ce lieu');
    const carte = html.indexOf('class="prep-picker"');
    const pied = html.indexOf('class="prep-place-cta"');
    expect(carte).toBeGreaterThan(-1);
    expect(pied).toBeGreaterThan(carte);
    expect(bouton).toBeGreaterThan(pied);
  });
});
