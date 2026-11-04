// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommunityFeed } from '../useCommunityFeed';

const calls = vi.hoisted(() => ({
  select: [] as string[],
  orders: [] as Array<[string, unknown]>,
  ranges: [] as Array<[number, number]>,
  aborted: 0,
  likes: 0,
  saves: 0,
  profiles: 0,
}));

function thenable(result: unknown) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn((columns: string) => {
    calls.select.push(columns);
    return builder;
  });
  builder.order = vi.fn((column: string, options: unknown) => {
    calls.orders.push([column, options]);
    return builder;
  });
  builder.range = vi.fn((from: number, to: number) => {
    calls.ranges.push([from, to]);
    return builder;
  });
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.abortSignal = vi.fn(() => {
    calls.aborted += 1;
    return builder;
  });
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return builder;
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'post_likes') {
        calls.likes += 1;
        return thenable({ data: [{ post_id: 'post-1' }], error: null });
      }
      if (table === 'post_saves') {
        calls.saves += 1;
        return thenable({ data: [], error: null });
      }
      return thenable({
        data: [
          {
            id: 'post-1',
            author_id: 'author-1',
            content: 'Bonjour',
            created_at: '2026-11-04T10:00:00.000Z',
          },
        ],
        error: null,
      });
    },
  }),
}));

vi.mock('@/lib/queries/publicProfilesCore', () => ({
  fetchPublicProfilesWith: vi.fn(async () => {
    calls.profiles += 1;
    return {};
  }),
}));

describe('useCommunityFeed — lecture bornée', () => {
  beforeEach(() => {
    calls.select = [];
    calls.orders = [];
    calls.ranges = [];
    calls.aborted = 0;
    calls.likes = 0;
    calls.saves = 0;
    calls.profiles = 0;
  });

  it('projette des colonnes explicites, départage par id et borne la page', async () => {
    const { result } = renderHook(() => useCommunityFeed('user-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const postSelect = calls.select.find((columns) => columns !== 'post_id');
    expect(postSelect).toBeTruthy();
    expect(postSelect).not.toBe('*');
    expect(postSelect).toContain('media_urls');
    expect(postSelect).toContain('snapshot_payload');
    expect(calls.orders).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(calls.ranges).toEqual([[0, 9]]);
    expect(calls.profiles).toBe(1);
    expect(calls.likes).toBe(1);
    expect(calls.saves).toBe(1);
    expect(calls.aborted).toBe(3);
    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].user_liked).toBe(true);
  });
});
