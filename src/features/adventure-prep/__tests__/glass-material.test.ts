import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Contrat du materiau de verre du preparateur.
 *
 * Releve du 2026-09-28, viewport 393x852 : les cartes d activities rendant
 * `background-color: var(--card-tint-solid)` se mesuraient a
 * `rgba(16, 16, 16, 0.82)` avec `backdrop-filter: none` et `box-shadow: none`.
 * Un aplat noir a 82 % n est pas du verre : c est un rectangle. Une surface
 * translucide ne se lit comme une vitre que si elle floute ce qu elle couvre
 * et si une lumiere est posee sur ses aretes.
 *
 * Ces tests verrouillent le materiau, pas une valeur de couleur : une future
 * retouche de teinte ne doit pas les faire echouer.
 */

const css = readFileSync(join(__dirname, '..', 'adventure-prep.css'), 'utf8');

/** Regles d un selecteur, en tolerant toute la mise en forme du fichier. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'm').exec(css);
  if (!match) throw new Error(`selecteur introuvable: ${selector}`);
  return match[1];
}

const GLASS_SURFACES = ['.prep-act', '.prep-nav', '.prep-block', '.prep-footer'];

// Les surfaces de CONTENU posees sur la photo. Elles etaient de simples
// melanges opaques de `--card-tint-solid` (88 a 94 %) : mesurees a 393x852,
// les cartes de jour se lisaient comme des rectangles noirs poses sur le
// decor, alors que la photo venait d'etre analysee pour eclaircir le fond.
// Elles doivent porter le meme materiau que les panneaux du hub.
const CONTENT_SURFACES = [
  '.prep-metric',
  '.prep-step',
  '.prep-programme__day',
  '.prep-block',
];

describe('materiau de verre du preparateur', () => {
  it.each(GLASS_SURFACES)('%s floute ce qu il couvre', (selector) => {
    const body = rule(selector);
    expect(body).toMatch(/backdrop-filter:\s*blur\(/);
  });

  it.each(GLASS_SURFACES)('%s pose de la lumiere sur ses aretes', (selector) => {
    // Le reflet de bord est ce qui distingue une vitre d un aplat flou.
    expect(rule(selector)).toMatch(/box-shadow:[^;]*var\(--prep-glass-material\)/);
  });

  it('aucune surface de verre ne retombe sur un aplat opaque', () => {
    for (const selector of GLASS_SURFACES) {
      expect(rule(selector)).not.toMatch(/background(-color)?:\s*var\(--card-tint-solid\)/);
    }
  });

  it('le materiau compose le reflet, le rebond et la portee', () => {
    const sheen = /--prep-glass-sheen:\s*inset 0 1px 0/.test(css);
    const bounce = /--prep-glass-bounce:\s*inset 0 -1px 0/.test(css);
    const depth = /--prep-glass-depth:\s*0 8px 32px/.test(css);
    const composed = /--prep-glass-material:[^;]*var\(--prep-glass-sheen\)[^;]*var\(--prep-glass-bounce\)[^;]*var\(--prep-glass-depth\)/.test(css);
    expect(sheen && bounce && depth && composed).toBe(true);
  });

  it.each(CONTENT_SURFACES)('%s floute ce qu il couvre', (selector) => {
    expect(rule(selector)).toMatch(/backdrop-filter:\s*blur\(/);
  });

  it.each(CONTENT_SURFACES)('%s pose la lumiere sur ses aretes', (selector) => {
    expect(rule(selector)).toMatch(/box-shadow:[^;]*var\(--prep-glass-material\)/);
  });

  it.each(CONTENT_SURFACES)(
    '%s ne retombe sur aucun aplat de teinte, meme melange',
    (selector) => {
      // Le controle precedent ne visait que `background: var(--card-tint-solid)`.
      // Un `color-mix(in srgb, var(--card-tint-solid) 94%, ...)` passait donc
      // le test tout en restant opaque a l'ecran. On interdit desormais le
      // ton de la teinte, quelle que soit la maniere dont on l'ecrit.
      expect(rule(selector)).not.toMatch(/background(-color)?:[^;]*--card-tint-solid/);
    },
  );
});
