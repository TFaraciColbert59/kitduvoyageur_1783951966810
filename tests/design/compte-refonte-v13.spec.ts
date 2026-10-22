import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 Liquid Glass v13 — Coin de card, avatar compact, grille Instagram & sélecteurs universels', () => {
  const v8Source = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const runtimeSource = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const v13Source = v8Source.slice(v8Source.indexOf('Compte iOS 27 v13'));
  const v14Source = v8Source.slice(v8Source.indexOf('Compte iOS 27 v14'));

  it('1. Le libellé Communauté est retiré du header à côté du pseudo', () => {
    expect(runtimeSource).not.toContain('class="vis-tag"');
    expect(runtimeSource).not.toContain('>Communauté<');
  });

  it('2. Le sélecteur Grille/Sorties est aligné à droite dans le flux, au-dessus des posts, en verre translucide', () => {
    expect(runtimeSource).toContain('class="ig-th lens"');
    expect(runtimeSource).toContain('aria-label="Grille des publications"');
    expect(runtimeSource).toContain('aria-label="Sorties et voyages faits"');
    expect(v14Source).toMatch(/\.ig-tabs-row\s*\{[^}]*justify-content:\s*flex-end/);
    expect(v14Source).toMatch(/\.ig-tabs\s*\{[^}]*position:\s*relative/);
    expect(v14Source).toMatch(/\.ig-tabs\s*\{[^}]*width:\s*88px/);
    expect(v14Source).toMatch(/\.ig-tabs\s*\{[^}]*height:\s*30px/);
    expect(v13Source).toMatch(/\.ig-tabs\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v13Source).toMatch(/\.ig-tabs\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v13Source).toMatch(/\.ig-tabs\s*\{[^}]*border-radius:\s*9999px/);
    expect(v13Source).toMatch(/\.ig-tabs button\[aria-selected="true"\]\s*\{[^}]*color:\s*#17402C/);
    expect(v13Source).toMatch(/\.ig-tabs button\s*\{[^}]*color:\s*#56665D/);
    expect(runtimeSource).not.toContain('ig-note empty');
    expect(runtimeSource).not.toContain('<span class="ig-note"');
  });

  it('3. La photo de profil est réduite à 66 px mobile et 74 px desktop', () => {
    expect(v13Source).toMatch(/\.ig-avi-wrap\s*\{[^}]*width:\s*66px/);
    expect(v13Source).toMatch(/\.ig-avi-wrap\s*\{[^}]*height:\s*66px/);
    expect(v13Source).toMatch(/\.ig-avi-in\s*\{[^}]*width:\s*58px/);
    expect(v13Source).toMatch(/\.ig-avi-in\s*\{[^}]*height:\s*58px/);
    expect(v13Source).toMatch(/@media\s*\(min-width:\s*601px\)[\s\S]*?\.ig-avi-wrap\s*\{\s*width:\s*74px/);
    expect(v13Source).toMatch(/\.ig-left\s*\{[^}]*width:\s*72px/);
  });

  it('4. La grille est en 3 colonnes carrées comme Instagram, bord à bord', () => {
    expect(v13Source).toMatch(/\.ig-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(v13Source).toMatch(/\.ig-grid\s*\{[^}]*gap:\s*2px/);
    expect(v13Source).toMatch(/\.ig-tile\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
    expect(v13Source).toMatch(/\.ig-tile\s*\{[^}]*width:\s*100%/);
    expect(v13Source).toMatch(/\.ig-grid-wrap\s*\{[^}]*margin:\s*3px\s+-14px\s+-13px/);
  });

  it('5. Les posts de la grille ne montrent que l’image et le type, en icône pure', () => {
    const tileMatch = runtimeSource.match(/const tileHTML = t => \{([\s\S]*?)\n\};/);
    expect(tileMatch).toBeTruthy();
    const tileBody = tileMatch ? tileMatch[1] : '';
    expect(tileBody).not.toContain('t-top');
    expect(tileBody).not.toContain('t-bot');
    expect(tileBody).not.toContain('t-pill');
    expect(tileBody).not.toContain('t-prog');
    expect(tileBody).toContain('t-type');
    expect(tileBody).toContain('tileArt(t.art)');
    expect(tileBody).not.toMatch(/\$\{t\.stat\}/);
    expect(tileBody).not.toContain('<b>');
    expect(tileBody).not.toContain('<small>');

    expect(runtimeSource).toContain('const tileTypeMeta');
    expect(runtimeSource).toContain('IC.carousel');
    expect(runtimeSource).toContain('IC.route');
    expect(runtimeSource).toContain('IC.leaf');
    expect(runtimeSource).toContain('IC.pencil');
    expect(v13Source).toMatch(/\.ig-tile \.t-type\s*\{[^}]*position:\s*absolute/);
    expect(v13Source).toMatch(/\.ig-tile \.t-type \.ic\s*\{[^}]*width:\s*12px/);
  });

  it('6. Tous les sélecteurs de drawers partagent le verre exact de la bottom bar', () => {
    for (const selector of ['.flow', '.segc', '.reseau-toggle', '.ig-sub']) {
      const block = new RegExp(`\\${selector}\\s*,?[\\s\\S]*?\\{[^}]*backdrop-filter:\\s*blur\\(28px\\)`);
      expect(v13Source).toMatch(block);
    }
    expect(v13Source).toMatch(/\.flow,\s*\n\.segc,\s*\n\.reseau-toggle,\s*\n\.ig-sub\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v13Source).toMatch(/\.flow,\s*\n\.segc,\s*\n\.reseau-toggle,\s*\n\.ig-sub\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v13Source).toMatch(/\.sel-lens\s*\{[^}]*background:\s*linear-gradient/);
    expect(v13Source).toMatch(/\.sel-lens\s*\{[^}]*transition:\s*transform\s+0\.28s\s+cubic-bezier\(0\.3,\s*1\.35,\s*0\.4,\s*1\)/);

    expect(runtimeSource).toContain('const navCls = sh.k === "step" && S.step === 1 ? "segc lg-tabs lens-on" : "flow";');
    expect(runtimeSource).toContain('class="sel-lens"');
    expect(runtimeSource).toContain('class="segc lg-tabs lens-on lkdv-account-nav" style="--n:5');
    expect(runtimeSource).toContain('class="segc lg-tabs lens-on lkdv-followers-nav"');
    expect(runtimeSource).toMatch(/class="ig-sub"[^>]*--n:3/);
  });

  it('7. La visibilité du profil reste accessible depuis le drawer Paramètres', () => {
    expect(runtimeSource).toContain('Visibilité du profil');
    expect(runtimeSource).toContain('data-a="cyclevis"');
    expect(runtimeSource).toContain("cyclevis: () => { doMut('vis', (S.vis + 1) % 3); }");
  });

  it('8. Invariant strict : 0 modification dans /compas', () => {
    try {
      const diffCompas = execSync('git diff --name-only origin/main -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
      expect(diffCompas).toBe('');
    } catch (_) {
      const statusCompas = execSync('git status --porcelain -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
      expect(statusCompas).toBe('');
    }
  });
});
