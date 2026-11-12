import { describe, expect, it } from 'vitest';
import {
  loadAccountBootstrap,
  mapOutgoingFollowStates,
  type FollowProfileRow,
  type OutgoingFollowRequestRow,
} from '../accountBootstrap';

const TARGET = '00000000-0000-4000-8000-000000000002';
const OTHER = '00000000-0000-4000-8000-000000000003';
const OWNER = '00000000-0000-4000-8000-000000000001';

const alice: FollowProfileRow = { id: TARGET, handle: 'alice' };

describe('mapOutgoingFollowStates — demandes sortantes au chargement', () => {
  it('rend requested pour une demande pending dont la cible est visible', () => {
    const requests: OutgoingFollowRequestRow[] = [
      { target_id: TARGET, status: 'pending' },
    ];
    expect(mapOutgoingFollowStates(requests, [alice])).toEqual({
      alice: 'requested',
    });
  });

  it('ignore une demande close ou visant une autre cible', () => {
    const requests: OutgoingFollowRequestRow[] = [
      { target_id: TARGET, status: 'declined' },
      { target_id: TARGET, status: 'cancelled' },
      { target_id: OTHER, status: 'pending' },
    ];
    expect(mapOutgoingFollowStates(requests, [alice])).toEqual({});
  });

  it('n’expose jamais un handle absent de la vue publique', () => {
    const requests: OutgoingFollowRequestRow[] = [
      { target_id: TARGET, status: 'pending' },
      { target_id: OTHER, status: 'pending' },
    ];
    expect(mapOutgoingFollowStates(requests, [alice])).toEqual({
      alice: 'requested',
    });
  });

  it('normalise un handle préfixé par @ et ignore un profil sans handle', () => {
    const requests: OutgoingFollowRequestRow[] = [
      { target_id: TARGET, status: 'pending' },
      { target_id: OTHER, status: 'pending' },
    ];
    expect(
      mapOutgoingFollowStates(requests, [
        { id: TARGET, handle: '@alice' },
        { id: OTHER, handle: '   ' },
      ])
    ).toEqual({ alice: 'requested' });
  });
});

type Row = Record<string, unknown>;

/**
 * Faux client PostgREST : applique réellement `eq`, `in`, `neq`, `gt` et
 * `limit`, et permet de simuler l'échec d'une table. Sans ce filtrage, un
 * mauvais scoping `requester_id`/`status` passerait inaperçu.
 */
function fakeBootstrapClient(
  rows: Record<string, Row[]>,
  errors: Record<string, unknown> = {}
) {
  const query = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    let max = Number.POSITIVE_INFINITY;
    const builder = {} as {
      [method: string]: (...args: any[]) => unknown;
    };
    builder.select = () => builder;
    builder.eq = (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    };
    builder.in = (column: string, values: unknown[]) => {
      const allowed = new Set(values);
      filters.push((row) => allowed.has(row[column]));
      return builder;
    };
    builder.neq = (column: string, value: unknown) => {
      filters.push((row) => row[column] !== value);
      return builder;
    };
    builder.gt = (column: string, value: unknown) => {
      filters.push((row) => Number(row[column]) > Number(value));
      return builder;
    };
    builder.gte = (column: string, value: unknown) => {
      filters.push((row) => Number(row[column]) >= Number(value));
      return builder;
    };
    builder.or = () => builder;
    builder.order = () => builder;
    builder.limit = (value: number) => {
      max = value;
      return builder;
    };
    const result = () => {
      if (errors[table]) return { data: null, error: errors[table] };
      const filtered = (rows[table] ?? [])
        .filter((row) => filters.every((filter) => filter(row)))
        .slice(0, max);
      return { data: filtered, error: null };
    };
    builder.maybeSingle = () => {
      if (errors[table]) {
        return Promise.resolve({ data: null, error: errors[table] });
      }
      return Promise.resolve({ data: result().data?.[0] ?? null, error: null });
    };
    builder.then = (onFulfilled: unknown, onRejected: unknown) =>
      Promise.resolve(result()).then(onFulfilled as never, onRejected as never);
    return builder;
  };
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: OWNER } }, error: null }),
    },
    from: (table: string) => query(table),
  };
}

async function bootstrapWith(
  rows: Record<string, Row[]>,
  errors: Record<string, unknown> = {}
) {
  const payload = await loadAccountBootstrap(
    fakeBootstrapClient(rows, errors) as unknown as Parameters<typeof loadAccountBootstrap>[0]
  );
  if (!payload.authenticated) throw new Error('bootstrap_non_authentifie');
  return payload;
}

describe('loadAccountBootstrap — hydratation des demandes sortantes', () => {
  const baseRows = {
    user_profiles: [{ id: OWNER, handle: 'owner', profile_visibility: 'public' }],
    user_follows: [],
    follow_requests: [
      { requester_id: OWNER, target_id: TARGET, status: 'pending' },
    ],
  };

  it('renvoie followStates.alice pour une cible publique', async () => {
    const payload = await bootstrapWith({
      ...baseRows,
      public_profiles: [{ id: TARGET, handle: 'alice', full_name: 'Alice' }],
    });

    expect(payload.followStates).toEqual({ alice: 'requested' });
  });

  it('n’hydrate pas une cible privée absente de public_profiles', async () => {
    const payload = await bootstrapWith({
      ...baseRows,
      public_profiles: [],
    });

    expect(payload.followStates).toEqual({});
  });

  it('laisse un suivi réel primer sur une demande pending résiduelle', async () => {
    const payload = await bootstrapWith({
      user_profiles: baseRows.user_profiles,
      user_follows: [{ follower_id: OWNER, following_id: TARGET }],
      follow_requests: baseRows.follow_requests,
      public_profiles: [{ id: TARGET, handle: 'alice', full_name: 'Alice' }],
    });

    expect(payload.followStates).toEqual({});
    expect(payload.followStatesUnavailable).toBe(false);
    expect(payload.following).toEqual([
      expect.objectContaining({ id: TARGET, ps: 'alice' }),
    ]);
  });

  it('ne lit que les demandes pending du compte courant', async () => {
    const payload = await bootstrapWith({
      ...baseRows,
      follow_requests: [
        { requester_id: OWNER, target_id: TARGET, status: 'pending' },
        { requester_id: OTHER, target_id: OTHER, status: 'pending' },
        { requester_id: OWNER, target_id: TARGET, status: 'accepted' },
      ],
      public_profiles: [
        { id: TARGET, handle: 'alice', full_name: 'Alice' },
        { id: OTHER, handle: 'bob', full_name: 'Bob' },
      ],
    });

    expect(payload.followStates).toEqual({ alice: 'requested' });
    expect(payload.followStatesUnavailable).toBe(false);
  });

  it('signale un échec de lecture des demandes sans inventer « aucun état »', async () => {
    const payload = await bootstrapWith(
      {
        ...baseRows,
        public_profiles: [{ id: TARGET, handle: 'alice', full_name: 'Alice' }],
      },
      { follow_requests: { message: 'relation indisponible' } }
    );

    expect(payload.followStates).toEqual({});
    expect(payload.followStatesUnavailable).toBe(true);
  });

  it('signale un échec de lecture des profils cibles', async () => {
    const payload = await bootstrapWith(baseRows, {
      public_profiles: { message: 'vue temporairement indisponible' },
    });

    expect(payload.followStates).toEqual({});
    expect(payload.followStatesUnavailable).toBe(true);
  });
});

describe('loadAccountBootstrap — lectures partielles des relations', () => {
  const relationBaseRows = {
    user_profiles: [{ id: OWNER, handle: 'owner', profile_visibility: 'public' }],
    user_follows: [],
    follow_requests: [{ requester_id: OWNER, target_id: TARGET, status: 'pending' }],
  };

  it('conserve les demandes sortantes quand user_follows échoue', async () => {
    const payload = await bootstrapWith(
      {
        ...relationBaseRows,
        public_profiles: [{ id: TARGET, handle: 'alice', full_name: 'Alice' }],
      },
      { user_follows: { message: 'relations indisponibles' } }
    );

    // Les états ne dépendent que des demandes sortantes et des profils cibles :
    // un échec des listes ne doit pas les faire disparaître.
    expect(payload.followStates).toEqual({ alice: 'requested' });
    expect(payload.followStatesUnavailable).toBe(false);
    expect(payload.followListsUnavailable).toBe(true);

    // Les compteurs dont la lecture a échoué sont omis, jamais remis à zéro.
    expect(payload.profile).not.toHaveProperty('followersCount');
    expect(payload.profile).not.toHaveProperty('followersLabel');
    expect(payload.profile).not.toHaveProperty('followingCount');
    expect(payload.tribu).toEqual([]);
    expect(payload.followers).toEqual([]);
    expect(payload.following).toEqual([]);
  });

  it('signale un échec des profils de listes sans invalider les états', async () => {
    const payload = await bootstrapWith(
      {
        user_profiles: relationBaseRows.user_profiles,
        user_follows: [{ follower_id: TARGET, following_id: OWNER }],
        follow_requests: [],
      },
      { public_profiles: { message: 'vue temporairement indisponible' } }
    );

    // Les compteurs viennent de `user_follows`, qui a répondu : ils restent
    // exacts. Seules les fiches des listes sont indisponibles.
    expect(payload.profile.followersCount).toBe(1);
    expect(payload.profile.followingCount).toBe(0);
    expect(payload.followers).toEqual([]);
    expect(payload.followListsUnavailable).toBe(true);
    expect(payload.followStatesUnavailable).toBe(false);
  });
});
