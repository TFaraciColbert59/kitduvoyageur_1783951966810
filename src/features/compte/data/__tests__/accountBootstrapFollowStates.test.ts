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
    let selected = '';
    builder.select = (...args: any[]) => {
      selected = String(args[0] ?? '');
      return builder;
    };
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
    // Permet de simuler l'échec d'une seule des deux lectures `user_follows`
    // (abonnés `follower_id` vs suivis `following_id`).
    const result = () => {
      const error = errors[`${table}:${selected}`] ?? errors[table];
      if (error) return { data: null, error };
      const filtered = (rows[table] ?? [])
        .filter((row) => filters.every((filter) => filter(row)))
        .slice(0, max);
      return { data: filtered, error: null };
    };
    builder.maybeSingle = () => {
      const error = errors[`${table}:${selected}`] ?? errors[table];
      if (error) {
        return Promise.resolve({ data: null, error });
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

  it('invalide les états quand les suivis sont illisibles', async () => {
    const payload = await bootstrapWith(
      {
        ...relationBaseRows,
        public_profiles: [{ id: TARGET, handle: 'alice', full_name: 'Alice' }],
      },
      { user_follows: { message: 'relations indisponibles' } }
    );

    // Sans les suivis réels, une demande pending résiduelle ne peut pas être
    // écartée : le serveur ne doit pas la transformer en « Demande envoyée ».
    // L'absence d'état est explicite, le client conservera le sien.
    expect(payload.followStates).toEqual({});
    expect(payload.followStatesUnavailable).toBe(true);
    expect(payload.followListsUnavailable).toBe(true);
    expect(payload.followersUnavailable).toBe(true);
    expect(payload.followingUnavailable).toBe(true);

    // Les compteurs dont la lecture a échoué sont omis, jamais remis à zéro.
    expect(payload.profile).not.toHaveProperty('followersCount');
    expect(payload.profile).not.toHaveProperty('followersLabel');
    expect(payload.profile).not.toHaveProperty('followingCount');
    expect(payload.tribu).toEqual([]);
    expect(payload.followers).toEqual([]);
    expect(payload.following).toEqual([]);
  });

  it('un échec des seuls abonnés laisse les états et les suivis valides', async () => {
    const payload = await bootstrapWith(
      {
        user_profiles: relationBaseRows.user_profiles,
        user_follows: [{ follower_id: OWNER, following_id: TARGET }],
        follow_requests: relationBaseRows.follow_requests,
        public_profiles: [{ id: TARGET, handle: 'alice', full_name: 'Alice' }],
      },
      { 'user_follows:follower_id': { message: 'abonnés indisponibles' } }
    );

    // La demande pending est bien écartée par le suivi réel : `user_follows`
    // des suivis a répondu, seul le compteur des abonnés manque.
    expect(payload.followStates).toEqual({});
    expect(payload.followStatesUnavailable).toBe(false);
    expect(payload.followersUnavailable).toBe(true);
    expect(payload.followingUnavailable).toBe(false);
    expect(payload.followListsUnavailable).toBe(true);
    expect(payload.following).toEqual([
      expect.objectContaining({ id: TARGET, ps: 'alice' }),
    ]);
    expect(payload.followers).toEqual([]);
    expect(payload.profile?.followersCount).toBeUndefined();
    expect(payload.profile?.followingCount).toBe(1);
  });

  it('un échec des seuls suivis préserve la liste des abonnés', async () => {
    const payload = await bootstrapWith(
      {
        user_profiles: relationBaseRows.user_profiles,
        user_follows: [{ follower_id: TARGET, following_id: OWNER }],
        follow_requests: relationBaseRows.follow_requests,
        public_profiles: [{ id: TARGET, handle: 'alice', full_name: 'Alice' }],
      },
      { 'user_follows:following_id': { message: 'suivis indisponibles' } }
    );

    expect(payload.followStates).toEqual({});
    expect(payload.followStatesUnavailable).toBe(true);
    expect(payload.followersUnavailable).toBe(false);
    expect(payload.followingUnavailable).toBe(true);
    expect(payload.followers).toEqual([
      expect.objectContaining({ id: TARGET, ps: 'alice' }),
    ]);
    expect(payload.following).toEqual([]);
    expect(payload.profile?.followersCount).toBe(1);
    expect(payload.profile?.followingCount).toBeUndefined();
  });

  it('signale un profil illisible sans fabriquer « Voyageur »', async () => {
    const payload = await bootstrapWith(
      {
        ...relationBaseRows,
        public_profiles: [{ id: TARGET, handle: 'alice', full_name: 'Alice' }],
      },
      { user_profiles: { message: 'profil indisponible' } }
    );

    expect(payload.profileUnavailable).toBe(true);
    expect(payload.profile).toBeNull();
    // Une visibilité lue sur un profil en échec serait un faux « public ».
    expect(payload.visibility).toBeNull();
    // Les lectures sociales valides restent servies.
    expect(payload.followStatesUnavailable).toBe(false);
    expect(payload.followStates).toEqual({ alice: 'requested' });
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
    expect(payload.profile?.followersCount).toBe(1);
    expect(payload.profile?.followingCount).toBe(0);
    expect(payload.followers).toEqual([]);
    expect(payload.followListsUnavailable).toBe(true);
    expect(payload.followStatesUnavailable).toBe(false);
  });
});
