import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  followErrorMessage,
  loadFollowState,
  ReseauFollowError,
  resolveFollowState,
  setFollow,
} from '../followClient';

const TARGET = '00000000-0000-4000-8000-000000000002';
const VIEWER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000003';

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('followClient — contrat HTTP du suivi', () => {
  it('suit une cible avec un POST qui ne transmet que son identifiant', async () => {
    const fetchMock = mockFetch(json({ status: 'following' }));

    await expect(setFollow(TARGET, 'follow')).resolves.toBe('following');
    expect(fetchMock).toHaveBeenCalledWith('/api/compte/reseau/follow', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ userId: TARGET }),
    });
  });

  it('remonte l’état "requested" d’un profil privé sans le confondre avec un suivi', async () => {
    mockFetch(json({ status: 'requested' }));

    await expect(setFollow(TARGET, 'follow')).resolves.toBe('requested');
  });

  it('annule un suivi ou une demande avec un DELETE', async () => {
    const fetchMock = mockFetch(json({ status: 'unfollowed' }));

    await expect(setFollow(TARGET, 'unfollow')).resolves.toBe('unfollowed');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      body: JSON.stringify({ userId: TARGET }),
    });
  });

  it('relaie le message borné et le code de la route', async () => {
    mockFetch(json({ error: 'Ce profil n’est pas disponible.', code: 'blocked' }, 409));

    const error = await setFollow(TARGET, 'follow').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ReseauFollowError);
    expect(error).toMatchObject({
      message: 'Ce profil n’est pas disponible.',
      code: 'blocked',
      httpStatus: 409,
    });
    expect(followErrorMessage(error)).toBe('Ce profil n’est pas disponible.');
  });

  it('refuse une réponse de succès sans statut exploitable', async () => {
    mockFetch(json({ status: 'pending' }));

    await expect(setFollow(TARGET, 'follow')).rejects.toMatchObject({
      name: 'ReseauFollowError',
      code: 'invalid_response',
    });
  });

  it('donne un repli lisible quand le corps d’erreur n’est pas du JSON', async () => {
    mockFetch(new Response('gateway', { status: 502 }));

    const error = await setFollow(TARGET, 'follow').catch((reason: unknown) => reason);
    expect(followErrorMessage(error)).toBe('Impossible de mettre à jour cet abonnement.');
  });
});

type FakeTable = 'user_follows' | 'follow_requests';

/** Faux client de lecture : enregistre tables, colonnes et filtres, sans réseau. */
class FakeReadClient {
  readonly reads: Array<{
    table: FakeTable;
    columns: string;
    filters: Array<[string, string]>;
    limit: number | null;
  }> = [];

  constructor(
    private readonly rows: Partial<Record<FakeTable, unknown[]>>,
    private readonly failing: ReadonlySet<FakeTable> = new Set()
  ) {}

  from(table: FakeTable) {
    const read: (typeof this.reads)[number] = {
      table,
      columns: '',
      filters: [],
      limit: null,
    };
    this.reads.push(read);
    const builder = {
      select: (columns: string) => {
        read.columns = columns;
        return builder;
      },
      eq: (column: string, value: string) => {
        read.filters.push([column, value]);
        return builder;
      },
      limit: (value: number) => {
        read.limit = value;
        return Promise.resolve({
          data: this.failing.has(table) ? null : (this.rows[table] ?? []),
          error: this.failing.has(table) ? { message: 'read_failed' } : null,
        });
      },
    };
    return builder;
  }
}

function asReadClient(fake: FakeReadClient): Pick<SupabaseClient, 'from'> {
  return fake as unknown as Pick<SupabaseClient, 'from'>;
}

describe('followClient — état initial après rechargement', () => {
  const fixtures = {
    follows: [{ following_id: TARGET }],
    requests: [
      { target_id: OTHER, status: 'pending' },
      { target_id: TARGET, status: 'declined' },
    ],
  };

  it('lit following quand le compte courant suit déjà la cible', () => {
    expect(resolveFollowState(fixtures.follows, fixtures.requests, TARGET)).toBe('following');
  });

  it('lit requested pour une demande pending du compte courant', () => {
    expect(
      resolveFollowState([], [{ target_id: TARGET, status: 'pending' }], TARGET)
    ).toBe('requested');
  });

  it('lit none sans suivi ni demande pending', () => {
    expect(resolveFollowState([], fixtures.requests, TARGET)).toBe('none');
    expect(resolveFollowState([], [], TARGET)).toBe('none');
    expect(resolveFollowState(null, null, TARGET)).toBe('none');
  });

  it('ignore une demande close et une demande visant une autre cible', () => {
    expect(
      resolveFollowState(
        [],
        [
          { target_id: TARGET, status: 'declined' },
          { target_id: TARGET, status: 'cancelled' },
          { target_id: OTHER, status: 'pending' },
        ],
        TARGET
      )
    ).toBe('none');
  });

  it('fait primer un suivi réel sur une demande encore pending', () => {
    expect(
      resolveFollowState(
        fixtures.follows,
        [{ target_id: TARGET, status: 'pending' }],
        TARGET
      )
    ).toBe('following');
  });

  it('charge requested via deux lectures bornées au compte courant', async () => {
    const fake = new FakeReadClient({
      user_follows: [],
      follow_requests: [{ target_id: TARGET, status: 'pending' }],
    });

    await expect(loadFollowState(asReadClient(fake), VIEWER, TARGET)).resolves.toBe(
      'requested'
    );
    expect(fake.reads).toEqual([
      {
        table: 'user_follows',
        columns: 'following_id',
        filters: [
          ['follower_id', VIEWER],
          ['following_id', TARGET],
        ],
        limit: 1,
      },
      {
        table: 'follow_requests',
        columns: 'target_id, status',
        filters: [
          ['requester_id', VIEWER],
          ['target_id', TARGET],
          ['status', 'pending'],
        ],
        limit: 1,
      },
    ]);
    expect(fake.reads.map((read) => read.table)).not.toContain('user_profiles');
    expect(
      fake.reads.every(
        (read) => read.columns !== 'id' && !read.columns.startsWith('id,')
      )
    ).toBe(true);
  });

  it('charge following quand le suivi existe', async () => {
    const fake = new FakeReadClient({
      user_follows: [{ following_id: TARGET }],
      follow_requests: [],
    });

    await expect(loadFollowState(asReadClient(fake), VIEWER, TARGET)).resolves.toBe(
      'following'
    );
  });

  it('ne lit rien pour soi-même', async () => {
    const fake = new FakeReadClient({});

    await expect(loadFollowState(asReadClient(fake), VIEWER, VIEWER)).resolves.toBe('none');
    expect(fake.reads).toEqual([]);
  });

  it('borne une erreur de lecture au lieu de conclure à un état', async () => {
    const fake = new FakeReadClient({}, new Set<FakeTable>(['follow_requests']));

    await expect(loadFollowState(asReadClient(fake), VIEWER, TARGET)).rejects.toMatchObject({
      name: 'ReseauFollowError',
      code: 'state_failed',
    });
  });
});
