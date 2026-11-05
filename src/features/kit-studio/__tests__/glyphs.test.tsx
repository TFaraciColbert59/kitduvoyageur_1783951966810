// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../domain/catalog';
import { Glyph, resolveGlyph } from '../ui/Glyph';
import { CATEGORY_GLYPHS, GLYPHS } from '../ui/glyphs.generated';

const BUNDLE = resolve(process.cwd(), 'kit-studio-bundle/reference/Kit_Studio_v2.html');
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;

function sourceGlKeyCount(): number | null {
  try {
    const block = readFileSync(BUNDLE, 'utf8').match(/const GL=\{[\s\S]*?\n\};/);
    return block ? (block[0].match(/^ [a-zA-Z]+:'/gm) ?? []).length : null;
  } catch {
    return null;
  }
}

describe('glyphes Kit Studio', () => {
  it('a autant de glyphes que de clés de GL dans la maquette', () => {
    const expected = sourceGlKeyCount();
    expect(Object.keys(GLYPHS)).toHaveLength(expected ?? 26);
  });

  it('expose les cinq pictogrammes de catégorie', () => {
    expect(Object.keys(CATEGORY_GLYPHS).sort()).toEqual(['acc', 'col', 'fin', 'mat', 'shape']);
  });

  it('chaque item du catalogue a un glyphe', () => {
    const missing = ITEMS.filter((item) => !GLYPHS[item.gl]).map((item) => `${item.id}:${item.gl}`);
    expect(missing).toEqual([]);
  });

  it('un rendu produit un <svg> avec au moins un enfant', () => {
    const html = renderToStaticMarkup(createElement(Glyph, { name: 'roll' }));
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).toMatch(/<(rect|path)\b/);
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('avec un titre, le SVG est exposé comme image nommée', () => {
    const html = renderToStaticMarkup(createElement(Glyph, { name: 'tent', title: 'Tente' }));
    expect(html).toContain('role="img"');
    expect(html).toContain('<title>Tente</title>');
  });

  it("n'a aucun attribut de couleur littérale", () => {
    const all = [...Object.values(GLYPHS), ...Object.values(CATEGORY_GLYPHS)].flat();
    for (const el of all) {
      for (const [attr, value] of Object.entries(el.attrs)) {
        if (attr === 'fill' || attr === 'stroke') expect(['none', 'currentColor']).toContain(value);
        expect(COLOR_LITERAL.test(value)).toBe(false);
      }
    }
  });

  it('un nom inconnu se replie sur un glyphe valide', () => {
    expect(resolveGlyph('inexistant')).toBe(GLYPHS.box);
    const html = renderToStaticMarkup(createElement(Glyph, { name: 'inexistant' }));
    expect(html).toMatch(/<(rect|path)\b/);
  });
});
