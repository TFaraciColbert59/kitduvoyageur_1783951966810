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

/** Faux client PostgREST : renvoie les lignes de la table, sans réseau. */
function fakeBootstrapClient(rows: Record<string, Row[]>) {
  const query = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'or', 'order', 'gt']) {
      builder[method] = () => builder;
    }
    const result = () => ({ data: rows[table] ?? [], error: null });
    builder.limit = () => Promise.resolve(result());
    builder.maybeSingle = () =>
      Promise.resolve({
        data: (rows[table] ?? [])[0] ?? null,
        error: null,
      });
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

async function bootstrapWith(rows: Record<string, Row[]>) {
  const payload = await loadAccountBootstrap(
    fakeBootstrapClient(rows) as unknown as Parameters<typeof loadAccountBootstrap>[0]
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
    expect(payload.following).toEqual([
      expect.objectContaining({ id: TARGET, ps: 'alice' }),
    ]);
  });
});
