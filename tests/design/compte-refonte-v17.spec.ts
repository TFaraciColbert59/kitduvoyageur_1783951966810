import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 v17 — matière bottom bar unifiée & profil aéré', () => {
  const source = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const v17 = source.slice(source.indexOf('Compte iOS 27 v17'));

  it('1. Tous les sélecteurs partagent le verre exact de la bottom bar', () => {
    expect(v17).toMatch(/--bar-glass-bg:\s*linear-gradient\(180deg,\s*rgba\(255, 255, 255, calc\(var\(--ga\) \+ \.3\)\)/);
    expect(v17).toMatch(/--bar-glass-blur:\s*blur\(var\(--gb\)\) saturate\(1\.9\) brightness\(1\.07\)/);
    expect(v17).toMatch(/0 0 0 \.5px rgba\(23, 43, 36, \.12\)/);

    const glassBlock = v17.match(/\n([^{}]*\.phone \.ig-tabs-float \.ig-tabs[^{}]*)\{([^}]*)\}/s);
    expect(glassBlock).not.toBeNull();
    const glassSelectors = glassBlock![1];
    const glassBody = glassBlock![2];
    for (const sel of [
      '.ig-tabs-float .ig-tabs',
      '.mctl',
      '.map-scale-selector',
      '.sheet .flow',
      '.sheet .segc',
      '.sheet .reseau-toggle',
      '.sheet .ig-sub',
    ]) expect(glassSelectors).toContain(sel);
    expect(glassBody).toMatch(/background:\s*var\(--bar-glass-bg\)\s*!important/);
    expect(glassBody).toMatch(/-webkit-backdrop-filter:\s*var\(--bar-glass-blur\)\s*!important/);
    expect(glassBody).toMatch(/(?<!-webkit-)backdrop-filter:\s*var\(--bar-glass-blur\)\s*!important/);
    expect(glassBody).toMatch(/border:\s*0\s*!important/);
  });

  it('2. La lentille sélectionnée reprend celle de la bottom bar', () => {
    expect(v17).toMatch(/--bar-thumb-bg:\s*linear-gradient\(180deg,\s*rgba\(255, 255, 255, \.62\),\s*rgba\(255, 255, 255, \.26\)\)/);

    const thumbBlock = v17.match(/\n([^{}]*\.ig-tabs-float \.ig-tabs \.ig-th[^{}]*)\{([^}]*)\}/s);
    expect(thumbBlock).not.toBeNull();
    const thumbSelectors = thumbBlock![1];
    const thumbBody = thumbBlock![2];
    for (const sel of [
      '.ig-tabs-float .ig-tabs .ig-th',
      '.sheet .segc .th',
      '.sheet .flow .lens',
      '.sheet .sel-lens',
      '.sheet .ig-sub button[aria-pressed="true"]',
    ]) expect(thumbSelectors).toContain(sel);
    expect(thumbBody).toMatch(/background:\s*var\(--bar-thumb-bg\)\s*!important/);
    expect(thumbBody).toMatch(/box-shadow:\s*var\(--bar-thumb-shadow\)\s*!important/);
  });

  it('3. Chaque sélecteur garde sa géométrie propre', () => {
    expect(v17).toMatch(/\.sheet \.flow\s*\{[^}]*display:\s*grid\s*!important/);
    expect(v17).toMatch(/\.sheet \.flow\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--n, 4\), minmax\(0, 1fr\)\)/);
    expect(v17).toMatch(/\.sheet \.segc\s*\{[^}]*grid-auto-flow:\s*column/);
    expect(v17).toMatch(/\.sheet \.reseau-toggle\s*\{[^}]*grid-template-columns:\s*1fr 1fr/);
    expect(v17).toMatch(/\.sheet \.ig-sub\s*\{[^}]*display:\s*flex/);
    expect(v17).toMatch(/\.sheet \.sh-h \.flow\s*\{[^}]*height:\s*48px\s*!important/);
  });

  it('4. Le profil est légèrement aéré', () => {
    expect(v17).toMatch(/#card\.cs > \.card-scroll\s*\{[^}]*gap:\s*7px\s*!important/);
    expect(v17).toMatch(/#card \.ig-bio\s*\{[^}]*margin:\s*3px 2px 2px\s*!important/);
    expect(v17).toMatch(/#card \.ig-hl-row\s*\{[^}]*padding:\s*2px 2px 1px\s*!important/);
    expect(v17).toMatch(/#card \.ig-grid-wrap\s*\{[^}]*margin-top:\s*3px\s*!important/);
  });

  it('5. La lentille réfractive couvre les nouveaux sélecteurs', () => {
    expect(runtime).toMatch(/#phone \.ig-tabs/);
    expect(runtime).toMatch(/#phone \.map-scale-selector/);
    expect(runtime).toMatch(/#phone \.sheet \.segc/);
    expect(runtime).toMatch(/#phone \.sheet \.flow/);
    expect(runtime).toMatch(/#phone \.sheet \.reseau-toggle/);
    expect(runtime).toMatch(/#phone \.sheet \.ig-sub/);
    expect(runtime).toContain('setProperty("backdrop-filter"');
    expect(runtime).toContain('setProperty("-webkit-backdrop-filter"');
  });

  it('6. Invariant strict : 0 modification dans /compas', () => {
    const status = execSync('git status --porcelain -- src/app/compas src/features/compas', {
      encoding: 'utf8',
    }).trim();
    expect(status).toBe('');

    let committedCompas = '';
    try {
      execSync('git diff --quiet 1af9a41d -- src/app/compas src/features/compas');
    } catch {
      committedCompas = 'changed';
    }
    expect(committedCompas).toBe('');
  });
});
