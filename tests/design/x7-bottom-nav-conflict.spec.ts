import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('CHANTIER X7 — CONFLIT DE BAS D\'ÉCRAN MOBILE ET HIÉRARCHIE Z-INDEX', () => {
  it('AppShell injecte la variable CSS canonique --bottom-nav-height', () => {
    const appShell = fs.readFileSync('src/components/shell/AppShell.tsx', 'utf-8');
    expect(appShell).toContain("['--bottom-nav-height' as any]: bottomNavHeight");
    expect(appShell).toContain("paddingBottom: 'var(--bottom-nav-height)'");
  });

  it('PersistentMetricsBar se cale au-dessus de --bottom-nav-height au z-index 30 sans écraser la navigation', () => {
    const bar = fs.readFileSync('src/features/trips/components/autoGen/PersistentMetricsBar.tsx', 'utf-8');
    expect(bar).toContain('bottom-[var(--bottom-nav-height,0px)]');
    expect(bar).toContain('z-30');
  });

  it('BottomTabBar opère au z-index 9999 avec pointer-events délégués', () => {
    const tabbar = fs.readFileSync('src/components/mobile-nav/BottomTabBar.tsx', 'utf-8');
    expect(tabbar).toContain('zIndex: 9999');
    expect(tabbar).toContain("pointerEvents: 'none'");
  });
});
