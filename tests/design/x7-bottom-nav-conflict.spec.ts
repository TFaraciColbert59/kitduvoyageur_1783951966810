import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('CHANTIER X7 — CONFLIT DE BAS D\'ÉCRAN MOBILE ET HIÉRARCHIE Z-INDEX', () => {
  it('AppShell injecte la variable CSS canonique --bottom-nav-height', () => {
    const appShell = fs.readFileSync('src/components/shell/AppShell.tsx', 'utf-8');
    expect(appShell).toContain("['--bottom-nav-height' as any]: bottomNavHeight");
    // Le renvoi bottom reserve la navigation ET le bandeau cookies : c'est le
    // max(...) qui garantit qu'aucun des deux ne masque l'autre.
    expect(appShell).toContain(
      "paddingBottom: 'max(var(--bottom-nav-height), var(--cookie-banner-h, 0px))'",
    );
  });

  it('FloatingLiquidTabBar opère sur la couche nav du registre zIndex avec pointer-events délégués', () => {
    const css = fs.readFileSync('src/styles/floating-liquid-tabbar.css', 'utf-8');
    expect(css).toContain('z-index: var(--z-nav, 1250);');
    expect(css).toContain('pointer-events: none;');
    expect(css).toContain('pointer-events: auto;');
  });
});
