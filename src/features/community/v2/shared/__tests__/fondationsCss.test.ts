import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrat des fondations CSS de la Communauté v2.
 *
 * Verrouille ce que les deux tiroirs (Explorer, Création) consomment :
 * - les jetons `--type-*` et `--cv2-*` existent dans `tokens.css` et restent
 *   des alias de palette (aucune nouvelle couleur locale) ;
 * - `communaute-v2.css` contient les blocs attendus et n'a **aucune** couleur
 *   littérale, aucune police littérale, aucune courbe de bézier écrite à la main ;
 * - toutes les variables `var(--…)` qu'elle consomme sont déclarées dans
 *   `tokens.css` (hors variables locales de bloc) ;
 * - les primitives (CSS auto-injecté) restent elles aussi uniquement en jetons.
 */

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const tokens = read('src/styles/tokens.css');
const base = read('src/styles/communaute-v2.css');
const sortSource = read('src/components/ui/drawer/SortMenuButton.tsx');
const islandSource = read('src/components/ui/drawer/DynamicIsland.tsx');

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractCssConstant(source: string, name: string): string {
  const marker = `export const ${name} = \``;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Constante ${name} introuvable`);
  const from = start + marker.length;
  return source.slice(from, source.indexOf('`;', from));
}

const baseCode = stripCssComments(base);
const sortCss = extractCssConstant(sortSource, 'SORT_MENU_CSS');
const islandCss = extractCssConstant(islandSource, 'DYNAMIC_ISLAND_CSS');

describe('jetons --type-* et --cv2-* (tokens.css)', () => {
  it('déclare les cinq types de contenu en alias de verts', () => {
    for (const type of ['post', 'carnet', 'club', 'sortie', 'membre']) {
      expect(tokens).toContain(`--type-${type}: var(--`);
    }
  });

  it('déclare les matériaux v2 utilisés par la feuille et les primitives', () => {
    for (const token of [
      '--cv2-tile-bg',
      '--cv2-tile-blur',
      '--cv2-tile-shadow',
      '--cv2-radius-tile-sm',
      '--cv2-radius-tile',
      '--cv2-radius-tile-lg',
      '--cv2-menu-bg',
      '--cv2-menu-shadow',
      '--cv2-field-bg',
      '--cv2-field-border',
      '--cv2-field-blur',
      '--cv2-skeleton-hi',
      '--cv2-skeleton-lo',
      '--cv2-island-bg',
      '--cv2-island-action-bg',
      '--cv2-z-island',
    ]) {
      expect(tokens, token).toContain(`${token}:`);
    }
  });

  it('ne fixe pas un z-index d’île inférieur à celui de la coque (60)', () => {
    const match = tokens.match(/--cv2-z-island:\s*(\d+);/);
    expect(match).toBeTruthy();
    expect(Number(match?.[1])).toBeGreaterThan(60);
  });
});

describe('communaute-v2.css — contrat de classes', () => {
  it('couvre les blocs exigés par les deux tiroirs', () => {
    for (const selector of [
      '.lkdv-cv2-card',
      '.lkdv-cv2-tile',
      '.lkdv-cv2-list',
      '.lkdv-cv2-row',
      '.lkdv-cv2-sep',
      '.lkdv-cv2-title',
      '.lkdv-cv2-meta',
      '.lkdv-cv2-eyebrow',
      '.lkdv-cv2-type',
      '.lkdv-cv2-visa',
      '.lkdv-cv2-trace',
      '.lkdv-cv2-ticket',
      '.lkdv-cv2-agenda',
      '.lkdv-crest',
      '.lkdv-cv2-field',
      '.lkdv-cv2-input',
      '.lkdv-cv2-chips',
      '.lkdv-cv2-chip',
      '.lkdv-cv2-seg',
      '.lkdv-cv2-stepper',
      '.lkdv-cv2-gauge',
      '.lkdv-cv2-media-grid',
      '.lkdv-cv2-media-handle',
      '.lkdv-cv2-media-remove',
      '.lkdv-cv2-media-progress',
      '.lkdv-cv2-crop',
      '.lkdv-cv2-counter',
      '.lkdv-cv2-field-error',
      '.lkdv-cv2-error-summary',
      '.lkdv-cv2-form-footer',
      '.lkdv-cv2-steps',
      '.lkdv-cv2-draft',
      '.lkdv-cv2-confirm',
      '.lkdv-cv2-send-fail',
      '.lkdv-cv2-skeleton',
      '.lkdv-cv2-empty',
      '.lkdv-cv2-error-state',
      '.lkdv-cv2-offline',
      '.lkdv-cv2-peek',
      '.lkdv-cv2-pill',
      '.lkdv-cv2-badge',
      '.lkdv-cv2-avatars',
      '.lkdv-cv2-capacity',
      '.lkdv-cv2-hit',
      '.lkdv-cv2-search',
      '.lkdv-cv2-grid',
      '.lkdv-cv2-rail',
    ]) {
      expect(base, selector).toContain(selector);
    }
  });

  it('reste uniquement en jetons : aucun hex, rgb(), police ou courbe littérale', () => {
    expect(baseCode).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(baseCode).not.toMatch(/\brgba?\(/);
    expect(baseCode).not.toMatch(/\bhsla?\(/);
    expect(baseCode).not.toMatch(/cubic-bezier\(/);
    const fontFamilies = [...baseCode.matchAll(/font-family:\s*([^;}]+)/g)].map((match) =>
      (match[1] ?? '').trim(),
    );
    expect(fontFamilies.filter((value) => !value.startsWith('var('))).toEqual([]);
  });

  it('ne consomme que des variables déclarées dans tokens.css (hors locales de bloc)', () => {
    const local = new Set(['--crest-bg', '--type-color']);
    const declared = new Set(
      (tokens.match(/(--[\w-]+)\s*:/g) ?? []).map((line) => line.replace(/\s*:$/, '')),
    );
    const used = new Set(
      (baseCode.match(/var\(\s*(--[\w-]+)/g) ?? []).map((entry) =>
        entry.replace(/var\(\s*/, ''),
      ),
    );
    const missing = [...used].filter((token) => !local.has(token) && !declared.has(token));
    expect(missing, `Variables non déclarées dans tokens.css : ${missing.join(', ')}`).toEqual([]);
  });

  it('déclare les préférences système (mouvement et transparence réduits)', () => {
    expect(baseCode).toContain('prefers-reduced-motion: reduce');
    expect(baseCode).toContain('prefers-reduced-transparency: reduce');
    expect(baseCode).toContain('prefers-contrast: more');
  });
});

describe('primitives — CSS auto-injecté uniquement en jetons', () => {
  for (const [name, css] of [
    ['SORT_MENU_CSS', sortCss],
    ['DYNAMIC_ISLAND_CSS', islandCss],
  ] as const) {
    it(`${name} : aucun hex, rgb(), courbe ou police littérale`, () => {
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css).not.toMatch(/\brgba?\(/);
      expect(css).not.toMatch(/cubic-bezier\(/);
      const fontFamilies = [...css.matchAll(/font-family:\s*([^;}]+)/g)].map((match) =>
        (match[1] ?? '').trim(),
      );
      expect(fontFamilies.filter((value) => !value.startsWith('var('))).toEqual([]);
    });

    it(`${name} : respecte prefers-reduced-motion`, () => {
      expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    });
  }

  it('le bouton de tri réserve la place de la mini-capsule (has-sort / 46 px)', () => {
    expect(sortCss).toContain('has-sort');
    expect(sortCss).toContain('right:46px');
  });
});
