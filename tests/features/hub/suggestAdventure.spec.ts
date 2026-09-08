import { describe, it, expect } from 'vitest';
import { suggestActiveAdventure } from '@/features/hub/engine/suggestAdventure';

/**
 * H5.4 — Suggestion d'aventure (surcouche IA déterministe), ÉCRITE AVANT.
 * Règles : upcoming ≤7j > invites > alertes > trip récent > possession.
 * La suggestion n'est JAMAIS restrictive (le switcher liste tout).
 */

const NOW = new Date('2026-09-08T12:00:00Z');

function lists(overrides = {}) {
  return {
    trips: [],
    groups: [],
    crews: [],
    possession: { itemsCount: 0, loansCount: 0, alertsCount: 0 },
    pendingInvites: 0,
    ...overrides,
  };
}

describe('H5 — suggestActiveAdventure : règles déterministes', () => {
  it('SUG-1: voyage imminent (≤7j, le plus proche) prime', () => {
    const s = suggestActiveAdventure(
      lists({
        trips: [
          { id: 't1', slug: 'loin', title: 'Loin', start_date: '2026-09-20' },
          { id: 't2', slug: 'proche', title: 'Proche', start_date: '2026-09-10' },
        ],
        pendingInvites: 2,
        possession: { itemsCount: 1, loansCount: 0, alertsCount: 5 },
      }),
      NOW,
    );
    expect(s?.key).toBe('sortie:proche');
    expect(s?.reason).toMatch(/J-2/);
  });

  it('SUG-2: sans imminent, les invitations priment (1er groupe)', () => {
    const s = suggestActiveAdventure(
      lists({
        groups: [{ id: 'g1', name: 'Alpes', member_count: 3 }],
        pendingInvites: 1,
        possession: { itemsCount: 1, loansCount: 0, alertsCount: 9 },
      }),
      NOW,
    );
    expect(s?.key).toBe('collectif:groupe:g1');
    expect(s?.reason).toMatch(/invitation/);
  });

  it('SUG-3: sans invites, les alertes matériel priment (possession)', () => {
    const s = suggestActiveAdventure(
      lists({
        trips: [{ id: 't1', slug: 'vieux', title: 'Vieux', start_date: '2026-01-01' }],
        possession: { itemsCount: 4, loansCount: 0, alertsCount: 2 },
      }),
      NOW,
    );
    expect(s?.key).toBe('possession');
    expect(s?.reason).toMatch(/2 alerte/);
  });

  it('SUG-4: sinon le voyage le plus récent (start_date max)', () => {
    const s = suggestActiveAdventure(
      lists({
        trips: [
          { id: 't1', slug: 'vieux', title: 'Vieux', start_date: '2026-01-01' },
          { id: 't2', slug: 'recent', title: 'Récent', start_date: '2026-08-01' },
        ],
      }),
      NOW,
    );
    expect(s?.key).toBe('sortie:recent');
  });

  it('SUG-5: vide total = possession par défaut', () => {
    const s = suggestActiveAdventure(lists(), NOW);
    expect(s?.key).toBe('possession');
    expect(s?.reason).toMatch(/défaut/);
  });

  it('SUG-6: voyage passé imminent exclu (déjà parti, pas de J négatif imminent)', () => {
    const s = suggestActiveAdventure(
      lists({ trips: [{ id: 't1', slug: 'passe', title: 'Passé', start_date: '2026-09-01' }] }),
      NOW,
    );
    expect(s?.key).toBe('sortie:passe');
    expect(s?.reason).toMatch(/récent/);
  });

  it('SUG-7: équipage suggéré si voyage lié imminent (via crews)', () => {
    const s = suggestActiveAdventure(
      lists({
        crews: [{ id: 'c1', name: 'Sud', next_trip: { slug: 'merc', title: 'Merc' } }],
        trips: [{ id: 't9', slug: 'merc', title: 'Merc', start_date: '2026-09-09' }],
      }),
      NOW,
    );
    // Le voyage imminent prime sur l'équipage (règle 1 > collectif).
    expect(s?.key).toBe('sortie:merc');
  });

  it('SUG-8: déterminisme — deux appels = même résultat', () => {
    const input = lists({
      trips: [{ id: 't1', slug: 'a', title: 'A', start_date: '2026-09-10' }],
      pendingInvites: 1,
    });
    expect(suggestActiveAdventure(input, NOW)).toEqual(suggestActiveAdventure(input, NOW));
  });
});
