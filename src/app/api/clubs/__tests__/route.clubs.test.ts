import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  clubs: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
    from: (table: string) => {
      const rows =
        table === 'clubs'
          ? state.clubs
          : table === 'club_members' || table === 'user_blocks'
            ? []
            : [];
      const result = Promise.resolve({ data: rows, error: null });
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        order: () => chain,
        limit: () => result,
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      };
      return chain;
    },
  })),
}));

import { GET } from '../route';

function row(overrides: Record<string, unknown>) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'open-club',
    name: 'Open Club',
    description: '',
    category: 'trail',
    privacy: 'open',
    created_by: 'u1',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('GET /api/clubs', () => {
  it('ne laisse jamais fuiter un club secret dans l’annuaire anonyme', async () => {
    state.clubs = [
      row({ id: '11111111-1111-4111-8111-111111111111', name: 'Open Club', privacy: 'open' }),
      row({
        id: '22222222-2222-4222-8222-222222222222',
        slug: 'secret-club',
        name: 'Secret Club',
        privacy: 'secret',
      }),
    ];

    const response = await GET(new NextRequest('http://localhost/api/clubs'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ name: string }>; count: number };
    expect(body.data.map((club) => club.name)).toEqual(['Open Club']);
    expect(body.count).toBe(1);
  });
});
