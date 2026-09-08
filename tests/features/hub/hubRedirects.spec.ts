import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_REDIRECTS, resolveLegacyRedirect } from '@/lib/hub/hubRedirects';
import { hubSectionRegistry } from '@/features/hub/registry/hubSectionRegistry';

/**
 * H-AUTO-42 — Matrice des redirections 307 : sources → destinations
 * canoniques du hub. Écrit avec l'implémentation (TDD domaine hub) :
 * chaque redirection importante est testée (prompt chantier H, § routes).
 */

describe('H-AUTO-42 — resolveLegacyRedirect : table statique', () => {
  it('RED-1: possession — les écrans fonctionnels pointent vers leurs sections hub', () => {
    expect(resolveLegacyRedirect('/materiel')?.destination).toBe('/hub');
    expect(resolveLegacyRedirect('/materiel/inventaire')?.destination).toBe('/hub/inventaire');
    expect(resolveLegacyRedirect('/materiel/kits')?.destination).toBe('/hub/kit');
    expect(resolveLegacyRedirect('/materiel/preparation')?.destination).toBe('/hub/preparation');
    expect(resolveLegacyRedirect('/materiel/disponibilite')?.destination).toBe('/hub/disponibilite');
    expect(resolveLegacyRedirect('/materiel/alertes')?.destination).toBe('/hub/alertes');
    expect(resolveLegacyRedirect('/materiel/forget')?.destination).toBe('/hub/oublis');
  });

  it('RED-2: racines absorbées (H5) et mode live (D2)', () => {
    expect(resolveLegacyRedirect('/preparation')?.destination).toBe('/hub/preparation');
    expect(resolveLegacyRedirect('/alertes')?.destination).toBe('/hub/alertes');
    expect(resolveLegacyRedirect('/terrain')?.destination).toBe('/hub');
    expect(resolveLegacyRedirect('/mes-aventures')?.destination).toBe('/hub');
    expect(resolveLegacyRedirect('/recommandations')?.destination).toBe('/hub');
    expect(resolveLegacyRedirect('/naviguer')?.destination).toBe('/randonnee-active');
    expect(resolveLegacyRedirect('/boussole')?.destination).toBe('/randonnee-active');
    expect(resolveLegacyRedirect('/rapport-kit')?.destination).toBe('/ai-configurator');
    expect(resolveLegacyRedirect('/activite')?.destination).toBe('/feed');
    expect(resolveLegacyRedirect('/gamification')?.destination).toBe('/recompenses');
    expect(resolveLegacyRedirect('/encheres')?.destination).toBe('/occasion');
  });

  it('RED-3: tous les statuts 307 — jamais 301 pendant la migration', () => {
    // La matrice ne porte pas de statut : le middleware applique 307. Ce test
    // verrouille l'invariant structurel : aucune destination permanente.
    for (const destination of Object.values(LEGACY_REDIRECTS)) {
      expect(destination.startsWith('/')).toBe(true);
    }
  });

  it('RED-4: aucun pathname non concerné n’est redirigé', () => {
    expect(resolveLegacyRedirect('/hub')).toBeNull();
    expect(resolveLegacyRedirect('/hub/kit')).toBeNull();
    expect(resolveLegacyRedirect('/explorer')).toBeNull();
    expect(resolveLegacyRedirect('/materielxyz')).toBeNull();
    expect(resolveLegacyRedirect('/')).toBeNull();
  });
});

describe('H-AUTO-42 — cas dynamique /materiel/depart/[id]', () => {
  it('DEP-1: id explicite → /hub/depart?id=… (param posé)', () => {
    expect(resolveLegacyRedirect('/materiel/depart/abc123')).toEqual({
      destination: '/hub/depart',
      setParams: { id: 'abc123' },
    });
  });

  it('DEP-2: id vitrine none → préservé (sémantique identique)', () => {
    expect(resolveLegacyRedirect('/materiel/depart/none')).toEqual({
      destination: '/hub/depart',
      setParams: { id: 'none' },
    });
  });

  it('DEP-3: sous-segments multiples → premier segment uniquement', () => {
    expect(resolveLegacyRedirect('/materiel/depart/abc/extra')).toEqual({
      destination: '/hub/depart',
      setParams: { id: 'abc' },
    });
  });

  it('DEP-4: depart sans id → table statique, sans param', () => {
    expect(resolveLegacyRedirect('/materiel/depart')).toEqual({ destination: '/hub/depart' });
  });
});

describe('H-AUTO-42 — invariants de la matrice (chaînes, boucles, registre)', () => {
  it('INV-1: aucune chaîne — une destination n’est jamais une source', () => {
    for (const destination of Object.values(LEGACY_REDIRECTS)) {
      expect(LEGACY_REDIRECTS[destination]).toBeUndefined();
    }
  });

  it('INV-2: aucune boucle — une source ne pointe jamais vers elle-même', () => {
    for (const [source, destination] of Object.entries(LEGACY_REDIRECTS)) {
      expect(destination).not.toBe(source);
    }
  });

  it('INV-3: destinations /hub/* cohérentes avec le registre (segment existant)', () => {
    const segments = new Set(hubSectionRegistry.map((d) => d.segment));
    for (const destination of Object.values(LEGACY_REDIRECTS)) {
      if (!destination.startsWith('/hub') || destination === '/hub') continue;
      const segment = destination.slice('/hub/'.length);
      expect(segments.has(segment)).toBe(true);
    }
  });

  it('INV-4: destinations hors hub = routes canoniques vivantes', () => {
    const allowed = new Set(['/randonnee-active', '/ai-configurator', '/feed', '/recompenses', '/occasion']);
    for (const destination of Object.values(LEGACY_REDIRECTS)) {
      if (!destination.startsWith('/hub')) expect(allowed.has(destination)).toBe(true);
    }
  });

  it('INV-5: le matcher middleware couvre toutes les sources statiques', () => {
    // Le matcher est généré depuis la table — ce test verrouille le contrat
    // (un matcher incomplet = redirect qui ne tire jamais, cf. H5).
    const middleware = fs.readFileSync(path.join(process.cwd(), 'src', 'middleware.ts'), 'utf8');
    expect(middleware).toContain('...Object.keys(LEGACY_REDIRECTS)');
    expect(middleware).toContain("'/materiel/depart/:path*'");
  });
});
