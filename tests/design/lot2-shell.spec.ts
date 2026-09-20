import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * PHASE 2 — LOT 2 : CONTRATS SHELL, SAFE AREAS ET NAVIGATION
 *
 * Verrouille la source unique des offsets, le prédicat de plateau partagé,
 * le contrat NavigationBar et la fin des variables de hauteur historiques.
 */

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const appShell = readFileSync('src/components/shell/AppShell.tsx', 'utf8');
const tabBar = readFileSync('src/components/mobile-nav/BottomTabBar.tsx', 'utf8');
const registry = readFileSync('src/components/mobile-nav/destinationRegistry.ts', 'utf8');
const navigationBar = readFileSync('src/components/mobile-nav/NavigationBar.tsx', 'utf8');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) acc = walk(full, acc);
    else if (/\.(tsx|ts)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

describe('LOT 2 — safe areas et offsets : source unique', () => {
  it('tokens.css déclare les offsets canoniques (barre, plateau, page, clavier)', () => {
    expect(tokens).toContain('--nav-height: 52px;');
    expect(tokens).toContain('--nav-plateau-height: 48px;');
    expect(tokens).toContain('--nav-offset: calc(var(--nav-height) + var(--safe-bottom));');
    expect(tokens).toContain('--nav-offset-extended:');
    expect(tokens).toContain('--page-top-inset: calc(var(--safe-top) + var(--space-2));');
    expect(tokens).toContain('--page-bottom-inset:');
    expect(tokens).toContain('--keyboard-inset: 0px;');
    expect(tokens).toContain('--header-height: 44px;');
  });

  it('AppShell consomme les offsets par tokens (plus de 80/112/68px locaux)', () => {
    expect(appShell).toContain("'var(--nav-offset)'");
    expect(appShell).toContain("'var(--nav-offset-extended)'");
    expect(appShell).toContain("'var(--page-bottom-inset-bare)'");
    expect(appShell).toContain("'var(--page-top-inset)'");
    expect(appShell).not.toContain('80px + env(safe-area-inset-bottom');
    expect(appShell).not.toContain('112px + env(safe-area-inset-bottom');
  });

  it('le shell applique la classe canonique .lkv-shell (viewport svh/dvh)', () => {
    expect(appShell).toContain('lkv-shell');
    const tailwind = readFileSync('src/styles/tailwind.css', 'utf8');
    expect(tailwind).toContain('.lkv-shell');
    expect(tailwind).toContain('min-height: 100svh;');
    expect(tailwind).toContain('min-height: 100dvh;');
  });

  it('aucune ancienne variable --bottom-tab-* ne subsiste dans src/', () => {
    const offenders: string[] = [];
    for (const file of walk('src')) {
      const content = readFileSync(file, 'utf8');
      if (/--bottom-tab-(base|extended)-height/.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe('LOT 2 — navigation centralisée', () => {
  it('le registre expose hasExtendedNav (prédicat unique du plateau)', () => {
    expect(registry).toContain('export function hasExtendedNav');
    expect(registry).toContain('EXTENDED_NAV_PREFIXES');
  });

  it('AppShell et BottomTabBar utilisent le même prédicat', () => {
    expect(appShell).toContain('hasExtendedNav(pathname)');
    expect(tabBar).toContain('hasExtendedNav(pathname)');
    // Plus de liste de routes dupliquée dans le shell.
    expect(appShell).not.toContain("pathname?.startsWith('/communaute')");
  });

  it('BottomTabBar consomme la hauteur canonique et le matériau par tokens', () => {
    expect(tabBar).toContain("height: 'var(--nav-height)'");
    expect(tabBar).toContain('lkv-material-bar');
    expect(tabBar).not.toContain('height: 52,');
  });

  it('le contrat NavigationBar existe et le drapeau natif reste désactivé', () => {
    expect(navigationBar).toContain('export const NATIVE_TABBAR_ENABLED = false;');
    expect(navigationBar).toContain('<BottomTabBar />');
  });
});

describe('LOT 2 — PageHeader canonique', () => {
  const pageHeader = readFileSync('src/components/ui/PageHeader.tsx', 'utf8');
  const backButton = readFileSync('src/components/ui/HeaderBackButton.tsx', 'utf8');

  it('PageHeader expose les variantes inline/large, back et état scroll', () => {
    expect(pageHeader).toContain("export type PageHeaderVariant = 'inline' | 'large'");
    expect(pageHeader).toContain('back?: React.ReactNode | boolean');
    expect(pageHeader).toContain('scrollAware');
    expect(pageHeader).toContain('useScrolled');
  });

  it('le bouton retour est unique : 44×44, icône chevron, historique puis repli', () => {
    expect(backButton).toContain('--control-height-md');
    expect(backButton).toContain('ChevronLeftIcon');
    expect(backButton).toContain('router.back()');
    expect(backButton).toContain('router.push(fallbackHref)');
  });
});
