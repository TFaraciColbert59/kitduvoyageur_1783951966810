import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config.mjs';
import { LEGACY_REDIRECTS, resolveLegacyRedirect } from '@/lib/hub/hubRedirects';

/**
 * Routing équipages & groupes.
 *
 * Phase 4.3 (chantier U) verrouillait un 301 /groupes → /equipages.
 * Revu au chantier H (H-AUTO-40/43) : sections hub canoniques.
 * Refonte « Groupe unique » : l'équipage est fusionné dans le groupe ;
 * /groupes ET /equipages redirigent vers /hub/groupe.
 */
describe('Groupes Routing & Redirection Compatibility (Étape 2)', () => {
  it('TEST-ROUTE-01: aucun redirect next.config — la matrice middleware fait le travail', async () => {
    expect(nextConfig.redirects).toBeDefined();
    if (typeof nextConfig.redirects === 'function') {
      const redirects = await nextConfig.redirects();
      const groupesRedirect = redirects.find((r: { source: string }) => r.source === '/groupes');
      expect(groupesRedirect).toBeUndefined();
    }
  });

  it('TEST-ROUTE-02: /groupes et /equipages redirigent vers la section groupe', () => {
    expect(LEGACY_REDIRECTS['/groupes']).toBe('/hub/groupe');
    expect(LEGACY_REDIRECTS['/equipages']).toBe('/hub/groupe');
    expect(resolveLegacyRedirect('/groupes')?.destination).toBe('/hub/groupe');
    expect(resolveLegacyRedirect('/equipages')?.destination).toBe('/hub/groupe');
  });

  it('TEST-ROUTE-03: la section hub groupe est canonique — aucune route équipage', () => {
    expect(LEGACY_REDIRECTS['/hub/groupe']).toBeUndefined();
    expect(resolveLegacyRedirect('/hub/groupe')).toBeNull();
    expect(resolveLegacyRedirect('/hub/equipage')).toBeNull();
  });
});
