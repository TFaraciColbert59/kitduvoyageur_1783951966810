// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommunityFeed } from '../useCommunityFeed';

const calls = vi.hoisted(() => ({
  select: [] as string[],
  orders: [] as Array<[string, unknown]>,
  limits: [] as number[],
  ors: [] as string[],
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
  builder.limit = vi.fn((value: number) => {
    calls.limits.push(value);
    return builder;
  });
  builder.or = vi.fn((filter: string) => {
    calls.ors.push(filter);
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

const postRows = Array.from({ length: 20 }, (_, index) => ({
  id: `post-${index + 1}`,
  author_id: 'author-1',
  content: 'Bonjour',
  created_at: new Date(Date.UTC(2026, 10, 4, 10, 0, 20 - index)).toISOString(),
}));
let postPage = 0;

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
      const page = postPage;
      postPage += 1;
      return thenable({
        data: postRows.slice(page * 10, page * 10 + 10),
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
    calls.limits = [];
    calls.ors = [];
    calls.aborted = 0;
    postPage = 0;
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
    expect(calls.limits).toEqual([10]);
    expect(calls.ors).toEqual([]);
    expect(calls.profiles).toBe(1);
    expect(calls.likes).toBe(1);
    expect(calls.saves).toBe(1);
    expect(calls.aborted).toBe(3);
    expect(result.current.posts).toHaveLength(10);
    expect(result.current.posts[0].user_liked).toBe(true);
  });

  it('charge la page suivante avec le curseur de la dernière ligne, pas un offset', async () => {
    const { result } = renderHook(() => useCommunityFeed('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toHaveLength(10);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.posts).toHaveLength(20);
    expect(calls.limits).toEqual([10, 10]);
    expect(calls.ors).toHaveLength(1);
    expect(calls.ors[0]).toContain('created_at.lt.');
    expect(calls.ors[0]).toContain('id.lt.post-10');
  });
});
