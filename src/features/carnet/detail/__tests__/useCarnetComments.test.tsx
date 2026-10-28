// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const commentsRows = [
  { id: 'm1', carnet_id: 'c1', author_id: 'u1', content: 'Merci Camille.', created_at: '2026-10-01T10:00:00Z' },
  { id: 'm2', carnet_id: 'c1', author_id: 'u2', content: 'Superbe !', created_at: '2026-10-02T10:00:00Z' },
];
const deleted: string[] = [];

/* Le refus de lecture est pilotable : le même mock sert le cas nominal et le
   cas « la RLS refuse », sans deuxième module simulé. */
const state = vi.hoisted(() => ({ failRead: false }));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'carnet_comments') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve(
                state.failRead
                  ? { data: null, error: { message: 'permission denied for table carnet_comments' } }
                  : { data: commentsRows, error: null },
              ),
          }),
        }),
        insert: (payload: { content: string }) => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'new',
                  carnet_id: 'c1',
                  author_id: 'u1',
                  content: payload.content,
                  created_at: '2026-10-03T10:00:00Z',
                },
                error: null,
              }),
          }),
        }),
        delete: () => ({
          eq: (column: string, value: string) => {
            if (column === 'id') deleted.push(value);
            return {
              eq: () => Promise.resolve({ error: null }),
            };
          },
        }),
      };
    },
  }),
}));

vi.mock('@/lib/queries/publicProfilesCore', () => ({
  fetchPublicProfilesWith: () =>
    Promise.resolve({ u1: { id: 'u1', full_name: 'Camille', avatar_url: null } }),
}));

import { COMMENTS_READ_ERROR, useCarnetComments } from '../useCarnetComments';

beforeEach(() => {
  deleted.length = 0;
  state.failRead = false;
});

describe('useCarnetComments', () => {
  it('charge la liste réelle avec les auteurs', async () => {
    const { result } = renderHook(() => useCarnetComments({ carnetId: 'c1', user: { id: 'u1' } }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments).toHaveLength(2);
    expect(result.current.comments[0].authorName).toBe('Camille');
    expect(result.current.comments[1].authorName).toBe('Auteur');
  });

  it('envoie un commentaire et l’ajoute en fin de liste', async () => {
    const { result } = renderHook(() => useCarnetComments({ carnetId: 'c1', user: { id: 'u1' } }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.send('  Bravo !  ')).toBe(true);
    });

    expect(result.current.comments.at(-1)?.content).toBe('Bravo !');
    expect(result.current.comments).toHaveLength(3);
  });

  it('refuse un commentaire vide sans écrire', async () => {
    const { result } = renderHook(() => useCarnetComments({ carnetId: 'c1', user: { id: 'u1' } }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.send('   ')).toBe(false);
    });
    expect(result.current.comments).toHaveLength(2);
  });

  it('garde le message technique en console et n’expose qu’un message générique', async () => {
    state.failRead = true;
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useCarnetComments({ carnetId: 'c1', user: { id: 'u1' } }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(COMMENTS_READ_ERROR);
    expect(result.current.error).not.toMatch(/permission denied|policy|carnet_comments/);
    expect(logged).toHaveBeenCalled();
    expect(result.current.comments).toHaveLength(0);
    logged.mockRestore();
  });

  it('supprime son propre commentaire seulement', async () => {
    const { result } = renderHook(() => useCarnetComments({ carnetId: 'c1', user: { id: 'u1' } }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.remove('m1')).toBe(true);
      expect(await result.current.remove('m2')).toBe(false);
    });

    expect(deleted).toEqual(['m1']);
    expect(result.current.comments.map((c) => c.id)).toEqual(['m2']);
  });
});
