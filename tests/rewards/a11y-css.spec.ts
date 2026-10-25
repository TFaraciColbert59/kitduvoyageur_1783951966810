import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contrat d'interaction des Récompenses (skill Aura, CLAUDE.md § 4) :
 * seules transform et opacity sont animées, prefers-reduced-motion coupe
 * tout, cibles tactiles ≥ 44 px, aucune couleur hors palette.
 */
const css = readFileSync(resolve(process.cwd(), 'src/components/rewards/rewards.css'), 'utf8');

describe('rewards.css — mouvement, cibles, palette', () => {
  it('transitions et animations limitées à transform / opacity', () => {
    const transitions = [...css.matchAll(/transition:\s*([^;]+);/g)].map((m) => m[1]);
    for (const value of transitions) {
      if (value.trim() === 'none') continue;
      // Virgules hors parenthèses seulement (cubic-bezier(…) en contient).
      const props = value.split(/,(?![^(]*\))/).map((part) => part.trim().split(/\s+/)[0]);
      for (const prop of props) expect(['transform', 'opacity']).toContain(prop);
    }
    const keyframes = css.match(/@keyframes[^{]+\{([\s\S]*?\})\s*\}/g) ?? [];
    for (const block of keyframes) {
      const declared = [...block.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const prop of declared) expect(['transform', 'opacity']).toContain(prop);
    }
  });

  it('prefers-reduced-motion supprime transitions et animation de gain', () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/);
    expect(block).not.toBeNull();
    expect(block![1]).toMatch(/\.lkdv-rw-bar > i[^{]*\{[^}]*transition: none/);
    expect(block![1]).toMatch(/\.lkdv-rw-gain \{ animation: none; \}/);
  });

  it('boutons et liens d’action ≥ 44 px', () => {
    expect(css).toMatch(/\.lkdv-rw-btn \{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.lkdv-rw-btn\.sm \{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.lkdv-rw-more \{[^}]*min-height: 44px/);
  });

  it('ombres à base d’encre, aucune couleur interdite', () => {
    expect(css).not.toMatch(/rgba\(0,\s*0,\s*0/);
    expect(css.toLowerCase()).not.toMatch(/#e4501c|#1c2620|#a3c4a3|#0b1f17|#2d6b4a/);
  });
});
