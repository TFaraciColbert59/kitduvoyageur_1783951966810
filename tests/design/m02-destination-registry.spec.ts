import { describe, it, expect } from 'vitest';
import {
  DESTINATIONS,
  getActiveDestinationId,
  getDestinationByHref,
} from '@/components/mobile-nav/destinationRegistry';

/**
 * M02 — registre canonique de navigation mobile : une route n'appartient
 * qu'à une destination, l'état actif est unique et les libellés sont définis
 * en FR/EN (pas d'i18n runtime).
 */
describe('M02 — registre des destinations (navigation mobile)', () => {
  it('expose exactement 5 destinations avec des href uniques', () => {
    expect(DESTINATIONS).toHaveLength(5);
    const hrefs = DESTINATIONS.map((d) => d.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const destination of DESTINATIONS) {
      expect(destination.label.fr.length).toBeGreaterThan(0);
      expect(destination.label.en.length).toBeGreaterThan(0);
      expect(destination.ariaLabel.length).toBeGreaterThan(0);
      expect(destination.matchPaths.length).toBeGreaterThan(0);
    }
  });

  it('matchPaths sans chevauchement : aucune route partagée entre deux destinations', () => {
    const owners = new Map<string, string[]>();
    for (const destination of DESTINATIONS) {
      for (const path of destination.matchPaths) {
        owners.set(path, [...(owners.get(path) ?? []), destination.id]);
      }
    }
    const duplicates = [...owners.entries()].filter(([, ids]) => ids.length > 1);
    expect(duplicates).toEqual([]);

    // Aucun chemin ne doit être un préfixe /parent d'un chemin d'une AUTRE
    // destination (le préfixe le plus long doit rester non ambigu).
    for (const a of DESTINATIONS) {
      for (const pa of a.matchPaths) {
        for (const b of DESTINATIONS) {
          if (a.id === b.id) continue;
          for (const pb of b.matchPaths) {
            expect(
              pb.startsWith(pa + '/'),
              `${b.id} (${pb}) est sous le préfixe de ${a.id} (${pa})`
            ).toBe(false);
          }
        }
      }
    }
  });

  it('/groupes appartient à Aventures (middleware → hub/groupe)', () => {
    const adventures = DESTINATIONS.find((d) => d.id === 'adventures');
    expect(adventures?.matchPaths).toContain('/groupes');
    expect(getActiveDestinationId('/groupes')).toBe('adventures');
    for (const destination of DESTINATIONS) {
      if (destination.id === 'adventures') continue;
      expect(destination.matchPaths).not.toContain('/groupes');
    }
  });

  it('résout l’état actif : exact puis préfixe le plus long', () => {
    expect(getActiveDestinationId('/hub')).toBe('adventures');
    expect(getActiveDestinationId('/hub/kit')).toBe('adventures');
    expect(getActiveDestinationId('/explorer')).toBe('explorer');
    expect(getActiveDestinationId('/pays/france')).toBe('explorer');
    // Phase 3 — Matériel n'est plus une destination : il reste rattaché au Hub.
    expect(getActiveDestinationId('/materiel')).toBe('adventures');
    expect(getActiveDestinationId('/communaute')).toBe('community');
    expect(getActiveDestinationId('/communaute/publier')).toBe('community');
    expect(getActiveDestinationId('/messagerie')).toBe('messages');
    expect(getActiveDestinationId('/compte')).toBe('me');
    expect(getActiveDestinationId('/progression')).toBe('me');
    expect(getActiveDestinationId('/route-inconnue')).toBeNull();
    expect(getActiveDestinationId(null)).toBeNull();
  });

  it('expose exactement 5 destinations dans l’ordre définitif', () => {
    expect(DESTINATIONS.map((d) => d.id)).toEqual([
      'adventures',
      'community',
      'explorer',
      'messages',
      'me',
    ]);
    expect(DESTINATIONS.map((d) => d.href)).toEqual([
      '/hub',
      '/communaute',
      '/explorer',
      '/messagerie',
      '/compte',
    ]);
    expect(DESTINATIONS.some((d) => (d.id as string) === 'gear')).toBe(false);
  });

  it('retrouve une destination par href exact (état pressé)', () => {
    expect(getDestinationByHref('/hub')?.id).toBe('adventures');
    expect(getDestinationByHref('/messagerie')?.id).toBe('messages');
    expect(getDestinationByHref('/materiel')).toBeNull();
    expect(getDestinationByHref('/inconnu')).toBeNull();
  });
});
