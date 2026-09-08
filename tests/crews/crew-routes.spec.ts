import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config.mjs';
import { LEGACY_REDIRECTS, resolveLegacyRedirect } from '@/lib/hub/hubRedirects';

/**
 * Routing équipages & groupes.
 *
 * Phase 4.3 (chantier U) verrouillait un 301 /groupes → /equipages.
 * Revu au chantier H (H-AUTO-40/43) : /groupes et /equipages sont deux
 * écrans canoniques distincts de la nature collectif — la section groupe
 * du hub pointe vers /groupes (ou /equipages pour un équipage), et l'ancien
 * 301 créait une chaîne de redirections + cassait la nav communauté.
 */
describe('Equipages Routing & Redirection Compatibility (H-AUTO-43)', () => {
  it('TEST-ROUTE-01: /groupes reste canonique — aucun redirect next.config', async () => {
    expect(nextConfig.redirects).toBeDefined();
    if (typeof nextConfig.redirects === 'function') {
      const redirects = await nextConfig.redirects();
      const groupesRedirect = redirects.find((r: { source: string }) => r.source === '/groupes');
      expect(groupesRedirect).toBeUndefined();
    }
  });

  it('TEST-ROUTE-02: /hub/groupe délègue aux pages canoniques sans chaîne', () => {
    // La section groupe du hub est un redirect serveur (/hub/[section]) —
    // la matrice héritée ne doit PAS y toucher ni rediriger /groupes.
    expect(LEGACY_REDIRECTS['/groupes']).toBeUndefined();
    expect(LEGACY_REDIRECTS['/equipages']).toBeUndefined();
    expect(resolveLegacyRedirect('/groupes')).toBeNull();
    expect(resolveLegacyRedirect('/equipages')).toBeNull();
  });
});
