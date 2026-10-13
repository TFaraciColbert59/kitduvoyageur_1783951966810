import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Bureau et tablette (PLAN-100 5.6) : verrou de la feuille de style. Le rendu réel (deux colonnes,
 * tiroir latéral, carte entière) est mesuré dans Chromium par `scripts/e2e/compas-bureau.spec.ts` et
 * ses captures (`docs/compas/preuves/`) ; jsdom n'a pas de mise en page, ce test garde donc les règles.
 */
const css = readFileSync(join(__dirname, '..', 'compas.css'), 'utf8');
const start = css.indexOf('Bureau et tablette (lot AD 5.6)');
const end = css.indexOf('/* ---------- Squelette de chargement');
const desktop = css.slice(start, end);
const media = desktop.slice(desktop.indexOf('@media (min-width: 768px)'));
const block = media.slice(0, media.indexOf('@keyframes cp-sheet-in-side'));

describe('mise en page à partir de 768 px', () => {
  it('le bloc existe, s’arrête à 768 px et reste avant le squelette (dernier bloc du fichier)', () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(desktop).toContain('@media (min-width: 768px)');
    expect(css.lastIndexOf('/* ---------- Squelette de chargement')).toBe(end);
  });

  it('toutes les règles bureau sont dans la requête 768 px : sous 768 px, rien ne change', () => {
    // Rien de ce bloc, hors requête et keyframes, ne s'applique sans `min-width: 768px`.
    const outside = desktop
      .replace(block, '')
      // Seule exception hors requête : couper l'animation du tiroir avec prefers-reduced-motion.
      .replace(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/, '');
    expect(outside).not.toMatch(/^\s*\.compas[^{@]*\{/m);
    expect(outside).not.toMatch(/^\s*\.cp-(sheet|map|top)[^{@]*\{/m);
  });

  it('deux colonnes : l’étape à gauche, la carte large à droite, un seul rang', () => {
    expect(block).toMatch(/grid-template-columns:\s*var\(--cp-side-w\)\s+minmax\(0,\s*1fr\)/);
    expect(block).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)/);
    expect(block).toMatch(/\.cp-map \{[^}]*grid-column:\s*2/);
    expect(block).toMatch(/\.cp-top \{[^}]*grid-column:\s*1/);
  });

  it('tiroir latéral : à gauche, toute la hauteur, largeur de la colonne ; « grand » s’élargit', () => {
    expect(block).toMatch(/\.cp-sheet\[data-detent='medium'\] \{[^}]*left:\s*1rem[^}]*width:\s*var\(--cp-side-w\)/);
    expect(block).toMatch(/\.cp-sheet\[data-detent='medium'\] \{[^}]*top:\s*0\.25rem[^}]*bottom:\s*1rem/);
    expect(block).toMatch(/\.cp-sheet\[data-detent='large'\] \{[^}]*width:\s*min\(51rem/);
  });

  it('aucune couleur littérale, aucun #E4501C, aucun jeton « role »', () => {
    expect(desktop).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(desktop).not.toMatch(/\brgba?\(/);
    expect(desktop).not.toMatch(/E4501C/i);
    expect(desktop).not.toMatch(/--[a-z-]*role/);
  });

  it('l’animation du tiroir ne touche que transform et opacity, et s’arrête avec prefers-reduced-motion', () => {
    const keyframes = desktop.match(/@keyframes cp-sheet-in-side\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(keyframes).toMatch(/transform:\s*translateX/);
    expect(keyframes).toMatch(/opacity/);
    expect(keyframes).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding)\s*:/);
    expect(desktop).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.cp-sheet\s*\{\s*animation:\s*none/);
  });
});
