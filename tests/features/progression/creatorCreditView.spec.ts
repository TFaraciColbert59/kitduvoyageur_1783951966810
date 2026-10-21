/** T41 — crédits de lignée : provisoire vs confirmé, remboursement once, aucune XP. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { getCreatorCredits } from '@/features/progression/server/creatorCredits';

const ORIGINAL_ENV = { ...process.env };
const mockedCreateClient = vi.mocked(createClient);

type Captured = { selects: string[]; eqs: Array<[string, string]> };

function createMock(shares: unknown[], ledger: unknown[], captured?: Captured) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      builder.select = (columns: string) => {
        captured?.selects.push(`${table}:${columns}`);
        return builder;
      };
      builder.eq = (column: string, value: string) => {
        captured?.eqs.push([`${table}:${column}`, value]);
        return builder;
      };
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
          {
            status: 'pending',
            share_cents: 300,
            kit_attributions: [{ kit_id: 'k1', order_item_id: 'oi-1' }],
          },
          {
            status: 'confirmed',
            share_cents: 100,
            kit_attributions: [{ kit_id: 'k1', order_item_id: 'oi-2' }],
          },
        ],
        [{ amount_cents: 100, entry_type: 'sale', kit_attributions: [{ order_item_id: 'oi-2' }] }]
      ) as never
    );

    const view = await getCreatorCredits('u1');

    expect(view.pendingCents).toBe(300);
    expect(view.confirmedCents).toBe(100);
    expect(view.lines).toHaveLength(3);
    expect(view.lines[0]).toMatchObject({ kitId: 'k1', orderItemId: 'oi-1', status: 'pending' });
  });

  it('retour partiel : provisoire réduit par la part remboursée une seule fois', async () => {
    mockedCreateClient.mockReturnValue(
      createMock(
        [
          {
            status: 'pending',
            share_cents: 75,
            kit_attributions: [{ kit_id: 'k1', order_item_id: 'oi-1' }],
          },
          {
            status: 'reversed',
            share_cents: 25,
            kit_attributions: [{ kit_id: 'k1', order_item_id: 'oi-1' }],
          },
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

  it('lit les vraies colonnes : share_cents/beneficiary_id et attribution imbriquée', async () => {
    const captured: Captured = { selects: [], eqs: [] };
    mockedCreateClient.mockReturnValue(createMock([], [], captured) as never);

    await getCreatorCredits('u1');

    const sharesSelect = captured.selects.find((entry) => entry.startsWith('kit_royalty_shares:'));
    expect(sharesSelect).toContain('share_cents');
    expect(sharesSelect).not.toContain('amount_cents');
    expect(sharesSelect).toContain('kit_attributions');
    expect(captured.eqs).toContainEqual(['kit_royalty_shares:beneficiary_id', 'u1']);
    expect(captured.eqs).not.toContainEqual(['kit_royalty_shares:user_id', 'u1']);
    expect(captured.eqs).toContainEqual(['store_credit_ledger:user_id', 'u1']);
  });
});
