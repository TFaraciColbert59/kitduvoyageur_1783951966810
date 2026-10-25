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

  it('NavigationSurface opère sur la couche nav du registre zIndex avec pointer-events délégués', () => {
    const surface = fs.readFileSync('src/components/mobile-nav/navigation/NavigationSurface.tsx', 'utf-8');
    // M04 — plus de 9999 ad hoc : la barre consomme l'échelle partagée
    // (src/lib/ui/zIndex.ts, couche `nav`).
    expect(surface).toContain("from '@/lib/ui/zIndex'");
    expect(surface).toContain('zIndex: zIndex.nav');
    expect(surface).toContain("pointerEvents: 'none'");
  });
});