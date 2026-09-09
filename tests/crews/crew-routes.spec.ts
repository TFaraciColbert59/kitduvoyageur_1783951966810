import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config.mjs';
import { LEGACY_REDIRECTS, resolveLegacyRedirect } from '@/lib/hub/hubRedirects';

/**
 * Routing équipages & groupes.
 *
 * Phase 4.3 (chantier U) verrouillait un 301 /groupes → /equipages.
 * Revu au chantier H (H-AUTO-40/43) : deux sections canoniques distinctes.
 * Étape 2 — Hub unique : les pages séparées /groupes et /equipages sont
 * SUPPRIMÉES ; la matrice héritée les redirige vers les sections hub
 * /hub/groupe et /hub/equipage, qui gèrent membres, rôles et invitations.
 */
describe('Equipages Routing & Redirection Compatibility (Étape 2)', () => {
  it('TEST-ROUTE-01: aucun redirect next.config — la matrice middleware fait le travail', async () => {
    expect(nextConfig.redirects).toBeDefined();
    if (typeof nextConfig.redirects === 'function') {
      const redirects = await nextConfig.redirects();
      const groupesRedirect = redirects.find((r: { source: string }) => r.source === '/groupes');
      expect(groupesRedirect).toBeUndefined();
    }
  });

  it('TEST-ROUTE-02: /groupes et /equipages redirigent vers les sections hub', () => {
    expect(LEGACY_REDIRECTS['/groupes']).toBe('/hub/groupe');
    expect(LEGACY_REDIRECTS['/equipages']).toBe('/hub/equipage');
    expect(resolveLegacyRedirect('/groupes')?.destination).toBe('/hub/groupe');
    expect(resolveLegacyRedirect('/equipages')?.destination).toBe('/hub/equipage');
  });

  it('TEST-ROUTE-03: les sections hub ne redirigent plus vers les anciennes pages', () => {
    // La section groupe du hub est le rendu canonique — aucune chaîne :
    // /hub/groupe et /hub/equipage ne sont pas des sources de la matrice.
    expect(LEGACY_REDIRECTS['/hub/groupe']).toBeUndefined();
    expect(LEGACY_REDIRECTS['/hub/equipage']).toBeUndefined();
    expect(resolveLegacyRedirect('/hub/groupe')).toBeNull();
    expect(resolveLegacyRedirect('/hub/equipage')).toBeNull();
  });
});
