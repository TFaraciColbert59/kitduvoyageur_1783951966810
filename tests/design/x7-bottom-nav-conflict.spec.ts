import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('CHANTIER X7 — CONFLIT DE BAS D\'ÉCRAN MOBILE ET HIÉRARCHIE Z-INDEX', () => {
  it('AppShell injecte la variable CSS canonique --bottom-nav-height', () => {
    const appShell = fs.readFileSync('src/components/shell/AppShell.tsx', 'utf-8');
    expect(appShell).toContain("['--bottom-nav-height' as any]: bottomNavHeight");
    expect(appShell).toContain("paddingBottom: 'var(--bottom-nav-height)'");
  });

  it('PersistentMetricsBar se cale au-dessus de --bottom-nav-height sur la couche z-fab sans écraser la navigation', () => {
    const bar = fs.readFileSync('src/features/trips/components/autoGen/PersistentMetricsBar.tsx', 'utf-8');
    expect(bar).toContain('bottom-[var(--bottom-nav-height,0px)]');
    // Lot 6 — l'échelle z est centralisée : plus de z-30 littéral.
    expect(bar).toContain('z-[var(--z-fab)]');
  });

  it('NavigationSurface opère sur la couche nav du registre zIndex avec pointer-events délégués', () => {
    const surface = fs.readFileSync('src/components/mobile-nav/navigation/NavigationSurface.tsx', 'utf-8');
    // M04 — plus de 9999 ad hoc : la barre consomme l'échelle partagée
    // (src/lib/ui/zIndex.ts, couche `nav`).
    expect(surface).toContain("from '@/lib/ui/zIndex'");
    expect(surface).toContain('zIndex: zIndex.nav');
    expect(surface).toContain("pointerEvents: 'none'");
  });
});
