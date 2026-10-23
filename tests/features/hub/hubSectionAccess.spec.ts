import { describe, it, expect } from 'vitest';
import { hubSectionRegistry, isHubSectionServable } from '@/features/hub/registry/hubSectionRegistry';
import { LEGACY_REDIRECTS } from '@/lib/hub/hubRedirects';

/**
 * Constat K-002 (banc Compas, phase 7) : avec une aventure active (nature « sortie »),
 * /hub/disponibilite, /hub/kit et /hub/inventaire répondaient 404 « Sentier introuvable »,
 * alors que /materiel et /materiel/disponibilite y mènent. Les sections « possession »
 * (inventaire, kits, prêts, alertes…) sont des surfaces PERSONNELLES : elles ne dépendent
 * d'aucune aventure et doivent s'ouvrir quelle que soit l'aventure active.
 */
describe('K-002 — sections « possession » servies sous toute nature', () => {
  const possession = hubSectionRegistry.filter((s) => s.natures.includes('possession'));

  it('chaque section possession s’ouvre avec une aventure active (sortie) ou collective', () => {
    expect(possession.length).toBeGreaterThan(0);
    for (const s of possession) {
      expect(isHubSectionServable(s, 'sortie'), s.id).toBe(true);
      expect(isHubSectionServable(s, 'collectif'), s.id).toBe(true);
      expect(isHubSectionServable(s, 'possession'), s.id).toBe(true);
    }
  });

  it('chaque redirection héritée vers /hub/<section> pointe une section servie sous « sortie »', () => {
    for (const dest of Object.values(LEGACY_REDIRECTS)) {
      const m = /^\/hub\/([^/?]+)$/.exec(dest);
      if (!m) continue;
      const def = hubSectionRegistry.find((s) => s.segment === m[1]);
      expect(def, dest).toBeTruthy();
      expect(isHubSectionServable(def!, 'sortie'), dest).toBe(true);
    }
  });

  it('les sections propres à une sortie restent refusées hors sortie (pas d’élargissement)', () => {
    const itin = hubSectionRegistry.find((s) => s.id === 'itinerary')!;
    expect(isHubSectionServable(itin, 'sortie')).toBe(true);
    expect(isHubSectionServable(itin, 'possession')).toBe(false);
    expect(isHubSectionServable(itin, 'collectif')).toBe(false);
  });
});
