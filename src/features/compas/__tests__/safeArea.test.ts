import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 5.4 : « Zones sûres vérifiées sur iPhone à encoche (capture 393 × 852) ».
 *
 * Contrôle statique de la chaîne qui amène les zones sûres jusqu'au Compas :
 *   viewport-fit=cover → env(safe-area-inset-*) → jetons --safe-* → AppShell
 *   (haut, bas, côtés) → .compas.
 * La mesure réelle (chromium, 393 × 852 avec encoche imposée, capture) est dans
 * `scripts/e2e/compas-safe-area.spec.ts` ; elle ne remplace pas un iPhone.
 */

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('chaîne des zones sûres du Compas', () => {
  it('le viewport couvre l’écran entier (viewport-fit=cover) : sans lui iOS annonce 0', () => {
    expect(read('src/app/layout.tsx')).toMatch(/viewportFit:\s*'cover'/);
  });

  it('les jetons --safe-* viennent des quatre env(safe-area-inset-*)', () => {
    const tokens = read('src/styles/tokens.css');
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(tokens).toMatch(new RegExp(`--safe-${side}:\\s*env\\(safe-area-inset-${side},\\s*0px\\)`));
    }
  });

  it('haut : le décalage de page ajoute la zone sûre du haut ; bas : la barre d’onglets ajoute celle du bas', () => {
    const tokens = read('src/styles/tokens.css');
    expect(tokens).toMatch(/--page-top-inset:\s*calc\(var\(--safe-top\)/);
    expect(tokens).toMatch(/--nav-offset:\s*calc\(var\(--nav-height\)\s*\+\s*var\(--safe-bottom\)\)/);
    expect(tokens).toMatch(/--nav-offset-extended:\s*calc\([^;]*var\(--safe-bottom\)\)/);
  });

  it('côtés : le shell commun garde le contenu hors de l’encoche en paysage', () => {
    const css = read('src/styles/tailwind.css');
    const shell = css.match(/\.lkv-shell\s*\{[^}]*\}/)?.[0] ?? '';
    expect(shell).toMatch(/padding-left:\s*var\(--safe-left\)/);
    expect(shell).toMatch(/padding-right:\s*var\(--safe-right\)/);
  });

  it('AppShell pose le haut (page-top-inset) et réserve le bas (bottom-nav-height)', () => {
    const shell = read('src/components/shell/AppShell.tsx');
    expect(shell).toMatch(/paddingTop:\s*safeTop \? 'var\(--page-top-inset\)'/);
    expect(shell).toMatch(/paddingBottom:\s*'max\(var\(--bottom-nav-height\)/);
    expect(shell).toContain('lkv-shell');
  });

  it('chaque page du Compas passe par AppShell avec ses zones sûres (jamais safeTop={false})', () => {
    for (const f of [
      'src/app/compas/page.tsx',
      'src/app/compas/loading.tsx',
      'src/app/compas/error.tsx',
    ]) {
      const src = read(f);
      expect(src, f).toContain('<AppShell');
      expect(src, f).not.toMatch(/safeTop=\{false\}/);
    }
  });

  it('.compas se cale sur le décalage du shell et sur la réserve de la barre, sans valeur en dur', () => {
    const css = read('src/features/compas/compas.css');
    expect(css).toMatch(/height:\s*calc\(100dvh - var\(--shell-top-padding, 0px\)\)/);
    expect(css).toMatch(/--cp-nav-clear:\s*calc\(\s*max\(var\(--bottom-nav-height, 0px\)/);
    // Tiroir haut, annonce, préparation : tous posés par rapport à ces réserves.
    expect(css).toMatch(/\.cp-sheet\[data-detent='large'\]\s*\{\s*bottom:\s*var\(--cp-nav-clear\)/);
    expect(css).toMatch(/\.cp-prep\s*\{[^}]*bottom:\s*calc\(var\(--cp-nav-clear/);
  });

  it('l’annonce (îlot) se place sous la zone sûre du haut, à côté de l’encoche', () => {
    const css = read('src/features/compas/compas.css');
    expect(css).toMatch(/\.cp-island\s*\{[^}]*top:\s*max\(8px,\s*calc\(env\(safe-area-inset-top, 0px\) - 48px\)\)/);
  });

  it('iOS natif : le WKWebView ne réserve pas lui-même les zones sûres (contentInset never)', () => {
    // Sinon le contenu serait décalé deux fois (par iOS puis par env()).
    expect(read('capacitor.config.ts')).toMatch(/contentInset:\s*"never"/);
  });
});
