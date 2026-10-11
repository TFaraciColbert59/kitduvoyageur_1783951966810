/** T41 — crédits de lignée : provisoire vs confirmé, remboursement once, aucune XP. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { getCreatorCredits } from '@/features/progression/server/creatorCredits';

const ORIGINAL_ENV = { ...process.env };
const mockedCreateClient = vi.mocked(createClient);

function createMock(shares: unknown[], ledger: unknown[]) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: table === 'kit_royalty_shares' ? shares : ledger,
          error: null,
        }).then(resolve);
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

describe('vue des crédits créateur', () => {
  it('sépare provisoire (parts attribuées) et confirmé (crédit boutique)', async () => {
    mockedCreateClient.mockReturnValue(
      createMock(
        [
          { kit_id: 'k1', order_item_id: 'oi-1', status: 'pending', amount_cents: 300 },
          { kit_id: 'k1', order_item_id: 'oi-2', status: 'confirmed', amount_cents: 100 },
        ],
        [{ source_id: 'oi-2', amount_cents: 100, entry_type: 'sale' }]
      ) as never
    );

    const view = await getCreatorCredits('u1');

    expect(view.pendingCents).toBe(300);
    expect(view.confirmedCents).toBe(100);
    expect(view.lines).toHaveLength(3);
  });

  it('retour partiel : provisoire réduit par la part remboursée une seule fois', async () => {
    mockedCreateClient.mockReturnValue(
      createMock(
        [
          { kit_id: 'k1', order_item_id: 'oi-1', status: 'pending', amount_cents: 75 },
          { kit_id: 'k1', order_item_id: 'oi-1', status: 'reversed', amount_cents: 25 },
        ],
        []
      ) as never
    );

    const view = await getCreatorCredits('u1');
    expect(view.pendingCents).toBe(75);
    expect(view.lines.filter((line) => line.status === 'reversed')).toHaveLength(1);
  });

  it('aucune XP : la vue ne lit que parts et crédit boutique', async () => {
    const tables: string[] = [];
    const mock = createMock([], []);
    const originalFrom = mock.from;
    mock.from = (table: string) => {
      tables.push(table);
      return originalFrom(table);
    };
    mockedCreateClient.mockReturnValue(mock as never);

    await getCreatorCredits('u1');

    expect(tables.sort()).toEqual(['kit_royalty_shares', 'store_credit_ledger']);
  });
});
