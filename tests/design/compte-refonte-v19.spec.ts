import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 v19 — feuille ancrée, profil compact, sorties fusionnées', () => {
  const source = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const start = source.indexOf('Compte iOS 27 v19');
  const v19 = source.slice(start, source.indexOf('`;', start));

  it('1. La feuille est translucide (voile Stone unique, sans fond opaque)', () => {
    expect(start).toBeGreaterThan(-1);
    expect(v19).toMatch(/\.phone \.sheet\s*\{[^}]*background-color:\s*transparent\s*!important/);
    expect(v19).toMatch(/\.phone \.sheet\s*\{[^}]*background-image:\s*linear-gradient\(180deg,\s*rgba\(245, 242, 236, \.34\),\s*rgba\(245, 242, 236, \.20\) 48%/);
    expect(v19).toMatch(/\.phone \.sheet\s*\{[^}]*blur\(30px\) saturate\(1\.7\) brightness\(1\.04\)/);
    expect(v19).toMatch(/\.sheet \.li\.nt,[\s\S]*?background:\s*linear-gradient\(180deg,\s*rgba\(255, 255, 255, \.58\),\s*rgba\(255, 255, 255, \.44\)\)/);
  });

  it('2. La feuille est ancrée aux bornes de la card et part du bas', () => {
    expect(v19).toMatch(/\.sw-wrap\[data-det="card"\]\s*\{[^}]*top:\s*var\(--card-top,\s*48px\)\s*!important/);
    expect(v19).toMatch(/\.sw-wrap\[data-det="card"\]\s*\{[^}]*overflow:\s*hidden\s*!important/);
    expect(v19).toMatch(/\.sw-wrap\[data-det="card"\] \.sheet\s*\{[^}]*transform:\s*translateY\(100%\)/);
    expect(v19).toMatch(/\.sw-wrap\[data-det="card"\]\.in \.sheet\s*\{[^}]*transform:\s*translateY\(0\)/);
    expect(v19).toMatch(/cubic-bezier\(\.32,\s*\.72,\s*0,\s*1\)/);
  });

  it('3. Le titre, la croix et le peekline ont disparu', () => {
    const render = runtime.slice(runtime.indexOf('let renderSheet'), runtime.indexOf('let sheetOpener'));
    expect(render).not.toContain('<h3>');
    expect(render).not.toContain('aria-label="Fermer"');
    expect(render).not.toContain('class="peekline"');
    expect(render).toContain('<div class="grab" data-drag');
    expect(render).toContain('<div class="sheet-nav">');
  });

  it('4. Le glissement pilote la fermeture inverse', () => {
    expect(runtime).toContain('DRAG_RATIO');
    expect(runtime).toContain('finishClose');
    expect(runtime).toMatch(/translateY\(\$\{st\.dy/);
    expect(v19).toContain('.dragging .sheet');
  });

  it('5. Le cadre blanc des Abonnés a disparu', () => {
    const followers = runtime.slice(runtime.indexOf('followers_sheet:'), runtime.indexOf('user_profile_preview:'));
    expect(followers).toContain('class="reseau-toggle"');
    expect(followers).not.toContain('apple-grouped-card');
    expect(v19).toMatch(/\.phone \.sheet \.reseau-toggle\s*\{[^}]*max-width:\s*none\s*!important/);
  });

  it('6. La lentille réagit à l’appui sur tous les sélecteurs', () => {
    expect(runtime).toContain('bindSelectorPress');
    expect(runtime).toContain('pressing');
    expect(runtime).toContain('scale(1.12)');
    expect(v19).toMatch(/scale\(\.92\)/);
  });

  it('7. Le profil tient en deux lignes', () => {
    const card = runtime.slice(runtime.indexOf('card = function ()'), runtime.indexOf('/* ---------- Menu de visibilité'));
    expect(card).toContain('ig-bio-top');
    expect(card).toContain('IT · FR');
    expect(card).not.toContain('ig-bio-link');
    expect(v19).toMatch(/-webkit-line-clamp:\s*1/);
    expect(v19).toMatch(/\.ig-hl-row\s*\{[^}]*margin:\s*0 2px 3px/);
  });

  it('8. Les sorties sont fusionnées et ouvrent un drawer', () => {
    expect(runtime).toContain('openOutingDrawer');
    expect(runtime).toContain('outing_drawer:');
    expect(runtime).toMatch(/class="voyage-card[^"]*"[^>]*data-a="openOutingDrawer"/);
    expect(v19).toMatch(/\.voyage-card\s*\{[^}]*height:\s*144px/);
    expect(v19).toMatch(/\.voyage-info\s*\{[^}]*position:\s*absolute/);
    expect(runtime).toContain('flyToOuting');
  });

  it('9. Le drawer Compte expose 5 onglets internes', () => {
    const acct = runtime.slice(runtime.indexOf('account_drawer:'), runtime.indexOf('post_comments:'));
    expect(acct).toContain('--n:5');
    expect((acct.match(/data-a="drawerTab"/g) || []).length).toBe(5);
    expect(acct).not.toContain('profileActions');
    expect(acct).toContain('editProfileBody');
    expect(acct).toContain('copyProfileLink');
    expect(acct).not.toContain('openSheet(');
  });

  it('10. Le menu pseudo s’ouvre sous la pilule sans la masquer', () => {
    const visStart = runtime.lastIndexOf('openVisMenu = function');
    const vis = runtime.slice(visStart, runtime.indexOf('/* ---------- Accessoire', visStart));
    expect(visStart).toBeGreaterThan(-1);
    expect(vis).toContain('const GAP = 8');
    expect(vis).toContain("pill.style.opacity = '1'");
    expect(vis).not.toContain("pill.style.opacity = '0'");
    expect(vis).toContain('R.y + R.h + GAP');
  });

  it('11. Invariant strict : 0 modification dans /compas', () => {
    let committed = '';
    try {
      committed = execSync('git diff --name-only origin/main -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
    } catch {
      committed = '';
    }
    expect(committed).toBe('');
    expect(execSync('git status --porcelain -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim()).toBe('');
  });
});
