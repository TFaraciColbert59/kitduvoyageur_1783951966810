import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { colors, transition, radius } from '@/design/tokens';

describe('CHANTIER X — SYNCHRONISATION TOKENS', () => {
  it('tokens.ts ne contient aucune couleur hexadécimale en dur (hors noir/blanc)', () => {
    const src = readFileSync('src/design/tokens.ts', 'utf8');
    const hex = (src.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter(
      (h) => h.toLowerCase() !== '#ffffff' && h.toLowerCase() !== '#000000'
    );
    expect(hex, `Hexadécimaux bruts résiduels dans tokens.ts: ${hex.join(', ')}`).toEqual([]);
  });

  it('tokens.ts expose les clés essentielles pour LkvButton', () => {
    expect(colors.primary).toBe('var(--lkv-primary)');
    expect(colors.primaryHover).toBe('var(--lkv-primary-hover)');
    expect(colors.primarySoft).toBe('var(--lkv-primary-soft)');
    expect(colors.error).toBe('var(--lkv-danger)');
    expect(transition.default).toBeDefined();
    expect(radius.card).toBe('var(--lkv-radius-card)');
  });

  it('tokens.css contient les déclarations de base correspondantes', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8');
    expect(css).toContain('--lkv-primary: #17402C;');
    expect(css).toContain('--lkv-primary-hover: #205238;');
    expect(css).toContain('--lkv-primary-soft: #365233;');
    expect(css).toContain('--lkv-success: #5B7F55;');
    expect(css).toContain('--lkv-radius-card: 28px;');
  });
});
