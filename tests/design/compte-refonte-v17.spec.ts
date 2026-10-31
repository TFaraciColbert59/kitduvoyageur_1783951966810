import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 v17 — matière bottom bar unifiée & profil aéré', () => {
  // Les règles de style ont été extraites dans des feuilles dédiées : on lit la
  // source TSX *et* les CSS, sans toucher aux assertions de contrat.
  const source = read('src/components/compte/CompteLiquidGlassV8.tsx') + '\n' + read('src/components/compte/compte-apple-hig.css') + '\n' + read('src/components/compte/compte-v8.css');
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const cssSource = read('src/components/compte/compte-apple-hig.css') + '\n' + read('src/components/compte/compte-v8.css');
  /** Bloc CSS de la version, borné par la version suivante (même intention que l'ancien découpage). */
  const sectionOf = (marker: string) => {
    const from = cssSource.indexOf(marker);
    if (from < 0) return '';
    const rest = cssSource.slice(from + marker.length);
    const next = rest.search(/Compte iOS 27 v\d+/);
    return cssSource.slice(from, next < 0 ? cssSource.length : from + marker.length + next);
  };

  const v17 = sectionOf('Compte iOS 27 v17');

  // Entrées de sélecteur exactes (commentaires retirés, espaces normalisés) :
  // un `toContain` sur la liste ne peut pas être satisfait par un fragment d'un autre sélecteur.
  const selectorList = (block: string) =>
    block
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((sel) => sel.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

  it('1. Tous les sélecteurs partagent le verre exact de la bottom bar', () => {
    expect(v17).toMatch(/--bar-glass-bg:\s*linear-gradient\(180deg,\s*rgba\(255, 255, 255, calc\(var\(--ga\) \+ \.3\)\)/);
    expect(v17).toMatch(/rgba\(255, 255, 255, calc\(var\(--ga\) \+ \.14\)\) 55%/);
    expect(v17).toMatch(/rgba\(255, 255, 255, calc\(var\(--ga\) \+ \.22\)\)/);
    expect(v17).toMatch(/--bar-glass-blur:\s*blur\(var\(--gb\)\) saturate\(1\.9\) brightness\(1\.07\)/);
    expect(v17).toMatch(/0 0 0 \.5px rgba\(23, 43, 36, \.14\)/);

    const glassShadow = v17.match(/--bar-glass-shadow:\s*([^;]*);/);
    expect(glassShadow).not.toBeNull();
    const glassShadowValue = glassShadow![1];
    expect(glassShadowValue).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, \.9\)/);
    expect(glassShadowValue).toMatch(/inset 0 -1px 1px rgba\(255, 255, 255, \.45\)/);
    expect(glassShadowValue).toMatch(/inset 1px 0 1px rgba\(255, 255, 255, \.28\)/);
    expect(glassShadowValue).toMatch(/inset -1px 0 1px rgba\(255, 255, 255, \.28\)/);
    expect(glassShadowValue).toMatch(/inset 0 0 12px rgba\(255, 255, 255, \.14\)/);
    expect(glassShadowValue).toMatch(/0 0 0 \.5px rgba\(23, 43, 36, \.14\)/);

    const glassBlock = v17.match(/\n([^{}]*\.phone \.ig-tabs-float \.ig-tabs[^{}]*)\{([^}]*)\}/);
    expect(glassBlock).not.toBeNull();
    const glassSelectors = selectorList(glassBlock![1]);
    const glassBody = glassBlock![2];
    for (const sel of [
      '.phone .ig-tabs-float .ig-tabs',
      '.phone .mctl',
      '.phone .map-scale-selector',
      '.phone .sheet .flow',
      '.phone .sheet .segc',
      '.phone .sheet .reseau-toggle',
      '.phone .sheet .ig-sub',
    ]) expect(glassSelectors).toContain(sel);
    expect(glassBody).toMatch(/background:\s*var\(--bar-glass-bg\)\s*!important/);
    expect(glassBody).toMatch(/-webkit-backdrop-filter:\s*var\(--bar-glass-blur\)\s*!important/);
    expect(glassBody).toMatch(/(?<!-webkit-)backdrop-filter:\s*var\(--bar-glass-blur\)\s*!important/);
    expect(glassBody).toMatch(/border:\s*0\s*!important/);
    expect(glassBody).toMatch(/box-shadow:\s*var\(--bar-glass-shadow\)\s*!important/);
  });

  it('2. La lentille sélectionnée reprend celle de la bottom bar', () => {
    expect(v17).toMatch(/--bar-thumb-bg:\s*linear-gradient\(180deg,\s*rgba\(255, 255, 255, \.62\),\s*rgba\(255, 255, 255, \.26\)\)/);

    const thumbBlock = v17.match(/\n([^{}]*\.ig-tabs-float \.ig-tabs \.ig-th[^{}]*)\{([^}]*)\}/);
    expect(thumbBlock).not.toBeNull();
    const thumbSelectors = selectorList(thumbBlock![1]);
    const thumbBody = thumbBlock![2];
    for (const sel of [
      '.phone .ig-tabs-float .ig-tabs .ig-th',
      '.phone .sheet .segc .th',
      '.phone .sheet .sel-lens',
      '.phone .sheet .ig-sub button[aria-selected="true"]',
    ]) expect(thumbSelectors).toContain(sel);
    expect(thumbSelectors).not.toContain('.phone .sheet .flow .lens');
    expect(thumbSelectors).not.toContain('.phone .sheet .reseau-toggle .active');
    expect(thumbBody).toMatch(/background:\s*var\(--bar-thumb-bg\)\s*!important/);
    expect(thumbBody).toMatch(/box-shadow:\s*var\(--bar-thumb-shadow\)\s*!important/);

    // Le pouce est peint par .sel-lens : les boutons sélectionnés restent transparents.
    const selectedBlock = v17.match(/\n([^{}]*\.phone \.sheet \.flow button\.cur[^{}]*)\{([^}]*)\}/);
    expect(selectedBlock).not.toBeNull();
    const selectedSelectors = selectorList(selectedBlock![1]);
    for (const sel of [
      '.phone .sheet .flow button.cur',
      '.phone .sheet .reseau-toggle .active',
      '.phone .sheet .ig-sub button[aria-selected="true"]',
    ]) expect(selectedSelectors).toContain(sel);
    expect(selectedBlock![2]).toMatch(/background:\s*transparent\s*!important/);
    expect(selectedBlock![2]).toMatch(/box-shadow:\s*none\s*!important/);
    expect(v17).toMatch(/\.sheet \.flow button\.cur,[\s\S]*?background:\s*transparent\s*!important/);
  });

  it('3. Chaque sélecteur garde sa géométrie propre', () => {
    expect(v17).toMatch(/\.sheet \.flow\s*\{[^}]*display:\s*grid\s*!important/);
    expect(v17).toMatch(/\.sheet \.flow\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--n, 4\), minmax\(0, 1fr\)\)/);
    expect(v17).toMatch(/\.sheet \.segc\s*\{[^}]*grid-auto-flow:\s*column/);
    expect(v17).toMatch(/\.sheet \.reseau-toggle\s*\{[^}]*grid-template-columns:\s*1fr 1fr/);
    expect(v17).toMatch(/\.sheet \.ig-sub\s*\{[^}]*display:\s*flex/);
    expect(v17).toMatch(/\.sheet \.ig-sub\s*\{[^}]*gap:\s*0\s*!important/);
    expect(v17).toMatch(/\.sheet \.sh-h \.flow\s*\{[^}]*height:\s*48px\s*!important/);
    expect(v17).toMatch(/\.sheet \.sh-h \.flow\s*\{[^}]*margin:\s*0\s*!important/);
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
    expect(runtime).toMatch(/setProperty\("backdrop-filter",\s*lensValue,\s*"important"\)/);
    expect(runtime).toMatch(/setProperty\("-webkit-backdrop-filter",\s*lensValue,\s*"important"\)/);
  });

  it('6 : isolation du Compas (aucun import de la refonte du compte)', () => {
    // Intention de l'invariant d'origine (« 0 modification dans /compas ») : la refonte du compte ne
    // touche pas au Compas. Une différence avec origin/main ne le prouve pas (elle échoue pour toute PR
    // qui fait évoluer le Compas, et dans un checkout sans origin/main) : on vérifie l'isolation.
    const leaks = execSync(
      'git grep -l -E "components/compte/|CompteLiquidGlassV8" -- src/app/compas src/features/compas || true',
      { encoding: 'utf8' },
    ).trim();
    expect(leaks).toBe('');
  });
});
