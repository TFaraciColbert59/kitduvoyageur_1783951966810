/**
 * T15 — distinctions unifiées :
 *   (a) variantes dédupliquées par clé canonique, possession historique
 *       préférée à la variante canonique non possédée ;
 *   (b) possession absente → variante canonique affichée, non gagnée ;
 *   (c) erreur de lecture → throw (le service ne masque pas) ;
 *   (d) forme d'embed en tableau tolérée (Supabase non typé) ;
 *   (e) aucune écriture : le service ne fait que lire.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { getUnifiedDistinctions } from '@/features/progression/server/distinctions';

const ORIGINAL_ENV = { ...process.env };
const mockedCreateClient = vi.mocked(createClient);

function linkRow(overrides: Record<string, unknown>) {
  return {
    badge_id: 'b1',
    canonical_key: 'premier-pas',
    condition_version: 1,
    badges: { name: 'Premier Pas', icon: '🎒', rarity: 'Commun' },
    ...overrides,
  };
}

interface MockOptions {
  owned?: unknown[];
  links?: unknown[];
  linksError?: { message: string } | null;
  calls?: string[];
}

function createMock(options: MockOptions) {
  return {
    from(table: string) {
      options.calls?.push(table);
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            table === 'user_badges'
              ? { data: options.owned ?? [], error: null }
              : { data: options.links ?? [], error: options.linksError ?? null }
          ).then(resolve),
      };
      return builder;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('getUnifiedDistinctions', () => {
  it('(a) déduplique et préfère la possession historique', async () => {
    mockedCreateClient.mockReturnValue(
      createMock({
        owned: [{ badge_id: 'legacy-1', earned_at: '2026-10-01T10:00:00.000Z' }],
        links: [
          linkRow({ badge_id: 'legacy-1', provenance_placeholder: undefined }),
          linkRow({ badge_id: 'canonical-1' }),
          linkRow({
            badge_id: 'b2',
            canonical_key: 'solidaire',
            badges: { name: 'Solidaire', icon: '🤝', rarity: 'Rare' },
          }),
          linkRow({
            badge_id: 'b2-canonical',
            canonical_key: 'solidaire',
            badges: { name: 'Solidaire', icon: '🤝', rarity: 'Rare' },
          }),
        ],
      }) as never
    );

    const distinctions = await getUnifiedDistinctions('u1');

    expect(distinctions).toHaveLength(2);
    const premier = distinctions.find((d) => d.canonicalKey === 'premier-pas');
    expect(premier?.earned).toBe(true);
    expect(premier?.badgeId).toBe('legacy-1');
    expect(premier?.earnedAt).toBe('2026-10-01T10:00:00.000Z');
    const solidaire = distinctions.find((d) => d.canonicalKey === 'solidaire');
    expect(solidaire?.earned).toBe(false);
  });

  it('(b) sans possession → canonique affichée, non gagnée, tri par nom', async () => {
    mockedCreateClient.mockReturnValue(
      createMock({
        owned: [],
        links: [
          linkRow({
            badge_id: 'z1',
            canonical_key: 'zeta',
            badges: { name: 'Zêta', icon: null, rarity: null },
          }),
          linkRow({ badge_id: 'a1', canonical_key: 'alpha', badges: { name: 'Alpha', icon: '🌿', rarity: 'Commun' } }),
        ],
      }) as never
    );

    const distinctions = await getUnifiedDistinctions('u1');

    expect(distinctions.map((d) => d.canonicalKey)).toEqual(['alpha', 'zeta']);
    expect(distinctions.every((d) => d.earned === false && d.earnedAt === null)).toBe(true);
    expect(distinctions[1].icon).toBeNull();
  });

  it('(c) erreur de lecture des liens → throw', async () => {
    mockedCreateClient.mockReturnValue(
      createMock({ owned: [], linksError: { message: 'boom' } }) as never
    );

    await expect(getUnifiedDistinctions('u1')).rejects.toThrow('boom');
  });

  it('(d) embed en tableau toléré et badge sans nom ignoré', async () => {
    mockedCreateClient.mockReturnValue(
      createMock({
        owned: [],
        links: [
          linkRow({ badge_id: 'arr-1', badges: [{ name: 'Tableau', icon: '📖', rarity: 'Rare' }] }),
          linkRow({ badge_id: 'noname', badges: { name: '', icon: null, rarity: null } }),
        ],
      }) as never
    );

    const distinctions = await getUnifiedDistinctions('u1');

    expect(distinctions).toHaveLength(1);
    expect(distinctions[0].name).toBe('Tableau');
  });

  it('(e) lecture seule : seules les deux tables sont interrogées', async () => {
    const calls: string[] = [];
    mockedCreateClient.mockReturnValue(createMock({ owned: [], links: [], calls }) as never);

    await getUnifiedDistinctions('u1');

    expect(calls.sort()).toEqual(['progression_badge_links', 'user_badges']);
  });
});
