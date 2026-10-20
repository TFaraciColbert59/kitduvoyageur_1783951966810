import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 v18 — drawers : surface card, navigation unique, sans Fermer', () => {
  const source = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const start = source.indexOf('Compte iOS 27 v18');
  const v18 = source.slice(start, source.indexOf('`;', start));

  it('1. La feuille reprend la surface exacte de la card', () => {
    expect(start).toBeGreaterThan(-1);
    expect(v18).toMatch(/\.phone \.sheet\s*\{[^}]*background-color:\s*var\(--lkv-surface-paper\)\s*!important/);
    expect(v18).toMatch(/\.phone \.sheet\s*\{[^}]*background-image:\s*linear-gradient\(180deg,\s*rgba\(255, 255, 255, \.486\),\s*rgba\(255, 255, 255, \.384\)\)/);
    expect(v18).toMatch(/\.phone \.sheet\s*\{[^}]*blur\(25\.2px\) saturate\(1\.8\) brightness\(1\.05\)/);
    expect(v18).toMatch(/\.phone \.sheet\s*\{[^}]*border:\s*0\s*!important/);
    expect(v18).toMatch(/0 10px 30px rgba\(23, 43, 36, \.14\)/);
  });

  it('2. Les trois navigateurs de drawer ont le gabarit de la bottom bar', () => {
    for (const sel of ['.sheet .flow', '.sheet .segc', '.sheet .reseau-toggle']) {
      expect(v18).toContain(sel);
    }
    expect(v18).toMatch(/\.phone \.sheet \.flow,[\s\S]*?height:\s*48px\s*!important/);
    expect(v18).toMatch(/\.phone \.sheet \.flow,[\s\S]*?padding:\s*2px\s*!important/);
    expect(v18).toMatch(/\.phone \.sheet \.flow,[\s\S]*?width:\s*100%\s*!important/);
    expect(v18).toMatch(/\.phone \.sheet \.flow,[\s\S]*?background:\s*var\(--bar-glass-bg\)\s*!important/);
    expect(v18).toMatch(/\.phone \.sheet \.flow button,[\s\S]*?height:\s*44px\s*!important/);
  });

  it('3. Le flow est sorti de l’en-tête vers une rangée dédiée', () => {
    expect(runtime).toContain('<div class="sheet-nav">');
    expect(runtime).not.toContain('class="grab${nF > 1 ? " tt" : ""}"');
    expect(runtime).toMatch(/<div class="sh-h" data-drag>\$\{x_\}<h3>/);
  });

  it('4. Aucun bouton Fermer en pied de drawer', () => {
    expect(runtime).not.toMatch(/data-a="close">Fermer</);
    expect(runtime).toMatch(/const footerHtml = isWorkflow\s*\?\s*`/);
    expect(runtime).toMatch(/\$\{footerHtml \? `<div class="sh-f">\$\{footerHtml\}<\/div>` : ""\}/);
  });

  it('5. Invariant strict : 0 modification dans /compas', () => {
    let committed = '';
    try {
      committed = execSync('git diff --name-only origin/main -- src/app/compas src/features/compas', {
        encoding: 'utf8',
      }).trim();
    } catch {
      committed = '';
    }
    expect(committed).toBe('');
    expect(
      execSync('git status --porcelain -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim(),
    ).toBe('');
  });
});
