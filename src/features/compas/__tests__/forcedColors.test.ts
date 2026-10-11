import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Lot Q, PLAN-100 5.2 — mode contraste forcé (Windows « thèmes à contraste
 * élevé », forced-colors: active).
 *
 * Dans ce mode, le navigateur remplace les couleurs de fond, de texte et de
 * bordure par celles du système et supprime ombres et dégradés. Le verre du
 * Compas (dégradés translucides, box-shadow, backdrop-filter), ses états
 * « choisi » (teinte de fond), ses barres et ses icônes en masque
 * (`background-color: currentColor` sous un `mask-image`) y disparaîtraient.
 * Ce verrou tient le bloc @media qui les redessine avec des couleurs système.
 */

const CSS = readFileSync(join(__dirname, '..', 'compas.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Corps du bloc `@media (forced-colors: active) { … }` (accolades équilibrées). */
function forcedBlocks(css: string): string[] {
  const out: string[] = [];
  const re = /@media\s*\(forced-colors:\s*active\)\s*\{/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    out.push(css.slice(re.lastIndex, i - 1));
  }
  return out;
}

const BLOCK = forcedBlocks(CSS).join('\n');

/** Corps de la règle dont le sélecteur contient `needle`. */
function rule(needle: string): string {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(BLOCK); m; m = re.exec(BLOCK)) if (m[1].includes(needle)) return m[2];
  return '';
}

describe('compas.css : forced-colors', () => {
  it('le bloc existe', () => {
    expect(BLOCK.length).toBeGreaterThan(200);
  });

  it('le verre devient une surface pleine bordée, sans flou ni ombre', () => {
    for (const sel of ['.cp-glass', '.cp-sheet-glass']) {
      const body = rule(sel);
      expect(body, sel).toMatch(/backdrop-filter:\s*none/);
      expect(body, sel).toMatch(/box-shadow:\s*none/);
      expect(body, sel).toMatch(/background:\s*Canvas/);
      expect(body, sel).toMatch(/border:\s*1px solid CanvasText/);
    }
  });

  it('les icônes en masque gardent leur peinture (sinon elles disparaissent)', () => {
    expect(rule("[style*='mask-image']")).toMatch(/forced-color-adjust:\s*none/);
  });

  it('les états choisis (aria-pressed, aria-current, aria-checked, jour du calendrier) se voient sans teinte', () => {
    const body = rule("[aria-pressed='true']");
    expect(body).toMatch(/background(-color)?:\s*Highlight/);
    expect(body).toMatch(/color:\s*HighlightText/);
    for (const sel of ["[aria-current='step']", "[aria-checked='true']", "[data-start='1']"])
      expect(BLOCK, sel).toContain(sel);
  });

  it('la lentille des étapes, les barres et la pastille d’alerte ont une forme système', () => {
    expect(rule('.cp-steps__lens')).toMatch(/border:\s*2px solid Highlight/);
    expect(rule('.cp-bar i')).toMatch(/background:\s*Highlight/);
    expect(rule('.cp-step__dot')).toMatch(/background:\s*Highlight/);
  });

  it('le focus clavier reste un contour système', () => {
    expect(rule(':focus-visible')).toMatch(/outline:\s*2px solid Highlight/);
  });

  it('les commandes ont une bordure, les désactivées sont grisées', () => {
    expect(rule('.cp-btn')).toMatch(/border:\s*1px solid ButtonText/);
    expect(rule(':disabled')).toMatch(/GrayText/);
  });

  it('aucune couleur littérale dans le bloc (couleurs système seulement)', () => {
    expect(BLOCK).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(BLOCK).not.toMatch(/\brgba?\(/i);
    expect(BLOCK).not.toMatch(/\bhsla?\(/i);
    expect(BLOCK.toLowerCase()).not.toContain('e4501c');
  });
});
