import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('CHANTIER X5 — INTERACTIONS ET MICRO-INTERACTIONS CANONIQUES', () => {
  it('tokens.css déclare les 5 courbes bézier canoniques du design system', () => {
    const css = fs.readFileSync('src/styles/tokens.css', 'utf-8');
    expect(css).toContain('--ease-glass:');
    expect(css).toContain('--ease-spring:');
    expect(css).toContain('--ease-smooth:');
    expect(css).toContain('--ease-out:');
    expect(css).toContain('--ease-emphasis:');
  });

  it('GlassSheet réutilise la courbe canonique iOS sheet', () => {
    // P1-3 : l'easing vit dans la classe CSS .lkv-sheet-full (framer retiré
    // du graphe statique) — le composant doit l'utiliser, pas le redéclarer.
    const sheetCode = fs.readFileSync('src/components/ui/GlassSheet.tsx', 'utf-8');
    expect(sheetCode).toContain('lkv-sheet-full');
    expect(sheetCode).toContain('backdrop-blur');
    const css = fs.readFileSync('src/styles/tailwind.css', 'utf-8');
    expect(css).toContain('0.32, 0.72, 0, 1');
  });
});
