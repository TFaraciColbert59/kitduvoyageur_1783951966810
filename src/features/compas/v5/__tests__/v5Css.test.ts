import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(__dirname, '../v5.css'), 'utf8');

/**
 * Garde de mise en page (constat de l'aperçu du 23 oct. 2026) : les cartes d'un tiroir qui vivent dans un
 * enveloppeur `display: contents` (`.v5-sp`) devenaient des éléments flex du corps et se comprimaient à 28 px,
 * texte coupé. Le corps du tiroir et ses enveloppeurs ne laissent jamais rétrécir leurs enfants.
 */
describe('v5.css · le corps d’un tiroir ne comprime pas ses cartes', () => {
  it('les enfants directs et ceux d’un enveloppeur sont `flex: none`', () => {
    const rule = css.match(/\.v5-scroll > \*,[^{]*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('.v5-sbody > *');
    expect(rule).toContain('.v5-sbody > .v5-sp > *');
    expect(rule).toMatch(/flex:\s*none/);
  });

  it('les encres sémantiques du matériau sombre ne sont pas lues (le Compas est clair)', () => {
    const tokens = css.match(/--v5-(?:label|label2|label3|warn|bad|info|accent):[^;]+;/g) ?? [];
    expect(tokens.length).toBeGreaterThanOrEqual(7);
    for (const t of tokens) expect(t).not.toMatch(/--lkv-(?:text|warning|danger|info|secondary)\b/);
  });
});
