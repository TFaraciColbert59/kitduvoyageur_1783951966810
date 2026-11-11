import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { followUser, respondFollowRequest, unfollowUser } from '../reseau';

type Row = Record<string, unknown>;
type Result = { data: Row | null; error: Error | null };
type Table = 'user_blocks' | 'user_profiles' | 'follow_requests' | 'user_follows';
type Filter = { column: string; value: unknown; op: 'eq' | 'in' };

const ME = '00000000-0000-4000-8000-000000000001';
const TARGET = '00000000-0000-4000-8000-000000000002';
const OTHER = '00000000-0000-4000-8000-000000000003';
const REQUEST_ID = '00000000-0000-4000-8000-000000000004';

/**
 * Faux client minimal qui rejoue les policies lues dans les migrations :
 * - `user_blocks_select_own` : bloqué par moi OU m'ayant bloqué ;
 * - `follow_requests_select_own` : demandeur OU cible ;
 * - `user_profiles` / `user_follows` : lecture publique.
 *
 * Les fixtures sont synthétiques et aucune requête réseau n'est émise.
 */
class FakeSupabase {
  readonly tables: Record<Table, Row[]>;
  readonly writes: Array<{ table: Table; kind: 'upsert' | 'update'; values: Row }> = [];
  beforeFollowRequestUpsert?: (db: FakeSupabase) => void;

  private readonly viewer: string;
  private readonly failures: Partial<Record<Table, string>>;

  constructor(options: {
    viewer: string;
    profiles?: Row[];
    blocks?: Row[];
    requests?: Row[];
    follows?: Row[];
    failures?: Partial<Record<Table, string>>;
  }) {
    this.viewer = options.viewer;
    this.failures = options.failures ?? {};
    this.tables = {
      user_blocks: options.blocks ?? [],
      user_profiles: options.profiles ?? [],
      follow_requests: options.requests ?? [],
      user_follows: options.follows ?? [],
    };
  }

  from(table: Table): FakeQuery {
    return new FakeQuery(this, table);
  }

  visibleRows(table: Table): Row[] {
    const rows = this.tables[table];
    if (table === 'user_blocks') {
      return rows.filter(
        (row) => row.blocker_id === this.viewer || row.blocked_id === this.viewer
      );
    }
    if (table === 'follow_requests') {
      return rows.filter(
        (row) => row.requester_id === this.viewer || row.target_id === this.viewer
      );
    }
    return rows;
  }

  selectSingle(table: Table, filters: Filter[]): Result {
    const failure = this.failureFor(table);
    if (failure) return { data: null, error: failure };

    const matches = this.visibleRows(table).filter((row) =>
      filters.every((filter) => this.matchesFilter(row, filter))
    );
    if (matches.length > 1) {
      return { data: null, error: new Error(`multiple_rows:${table}`) };
    }
    return { data: matches[0] ?? null, error: null };
  }

  upsertRow(table: Table, values: Row, ignoreDuplicates: boolean): Result {
    const failure = this.failureFor(table);
    if (failure) return { data: null, error: failure };

    if (table === 'follow_requests') {
      // Simule un acteur concurrent qui écrit entre la lecture et l'upsert.
      const hook = this.beforeFollowRequestUpsert;
      if (hook) {
        this.beforeFollowRequestUpsert = undefined;
        hook(this);
      }
    }

    const rows = this.tables[table];
    const existing = rows.find((row) => this.sameKey(table, row, values));
    if (!existing) {
      rows.push({ ...values });
      return { data: null, error: null };
    }
    if (!ignoreDuplicates) Object.assign(existing, values);
    return { data: null, error: null };
  }

  updateRows(table: Table, values: Row, filters: Filter[]): Result {
    const failure = this.failureFor(table);
    if (failure) return { data: null, error: failure };

    const matches = this.tables[table].filter((row) =>
      filters.every((filter) => this.matchesFilter(row, filter))
    );
    for (const row of matches) Object.assign(row, values);
    return { data: null, error: null };
  }

  deleteRows(table: Table, filters: Filter[]): Result {
    const failure = this.failureFor(table);
    if (failure) return { data: null, error: failure };

    this.tables[table] = this.tables[table].filter(
      (row) => !filters.every((filter) => this.matchesFilter(row, filter))
    );
    return { data: null, error: null };
  }

  recordWrite(table: Table, kind: 'upsert' | 'update', values: Row) {
    this.writes.push({ table, kind, values });
  }

  private matchesFilter(row: Row, filter: Filter): boolean {
    if (filter.op === 'in') {
      return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
    }
    return row[filter.column] === filter.value;
  }

  private sameKey(table: Table, row: Row, values: Row): boolean {
    if (table === 'user_blocks') {
      return row.blocker_id === values.blocker_id && row.blocked_id === values.blocked_id;
    }
    if (table === 'follow_requests') {
      return row.requester_id === values.requester_id && row.target_id === values.target_id;
    }
    if (table === 'user_follows') {
      return row.follower_id === values.follower_id && row.following_id === values.following_id;
    }
    return row.id === values.id;
  }

  private failureFor(table: Table): Error | null {
    const message = this.failures[table];
    return message ? new Error(message) : null;
  }
}

class FakeQuery {
  private readonly filters: Filter[] = [];
  private payload: Row | null = null;
  private operation: 'update' | 'delete' | null = null;

  constructor(
    private readonly db: FakeSupabase,
    private readonly table: Table
  ) {}

  select(_columns: string): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value, op: 'eq' });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, value: values, op: 'in' });
    return this;
  }

  maybeSingle(): Promise<Result> {
    return Promise.resolve(this.db.selectSingle(this.table, this.filters));
  }

  upsert(values: Row, options?: { ignoreDuplicates?: boolean }): Promise<Result> {
    this.db.recordWrite(this.table, 'upsert', values);
    return Promise.resolve(
      this.db.upsertRow(this.table, values, options?.ignoreDuplicates === true)
    );
  }

  update(values: Row): this {
    this.operation = 'update';
    this.payload = values;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    if (this.operation === 'update' && this.payload) {
      this.db.recordWrite(this.table, 'update', this.payload);
      return Promise.resolve(
        this.db.updateRows(this.table, this.payload, this.filters)
      ).then(onfulfilled, onrejected);
    }
    if (this.operation === 'delete') {
      return Promise.resolve(
        this.db.deleteRows(this.table, this.filters)
      ).then(onfulfilled, onrejected);
    }
    return Promise.reject(new Error('write_without_operation')).then(onfulfilled, onrejected);
  }
}

function asClient(db: FakeSupabase): SupabaseClient {
  return db as unknown as SupabaseClient;
}

function privateTarget(extra: Row = {}): Row {
  return { id: TARGET, profile_visibility: 'prive', ...extra };
}

describe('reseau — suivi face à un blocage', () => {
  it('refuse quand la cible a bloqué la session, sans écrire', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      profiles: [privateTarget()],
      blocks: [{ blocker_id: TARGET, blocked_id: ME }],
    });

    await expect(followUser(asClient(db), ME, TARGET)).rejects.toThrow('blocked');
    expect(db.writes).toEqual([]);
  });

  it('refuse quand la session a bloqué la cible, sans écrire', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      profiles: [privateTarget()],
      blocks: [{ blocker_id: ME, blocked_id: TARGET }],
    });

    await expect(followUser(asClient(db), ME, TARGET)).rejects.toThrow('blocked');
    expect(db.writes).toEqual([]);
  });

  it('ignore un blocage qui ne concerne pas la session (RLS)', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      profiles: [privateTarget()],
      blocks: [{ blocker_id: TARGET, blocked_id: OTHER }],
    });

    await expect(followUser(asClient(db), ME, TARGET)).resolves.toEqual({
      status: 'requested',
    });
    expect(db.writes).toEqual([
      {
        table: 'follow_requests',
        kind: 'upsert',
        values: { requester_id: ME, target_id: TARGET, status: 'pending' },
      },
    ]);
  });

  it('refuse de se suivre soi-même', async () => {
    const db = new FakeSupabase({ viewer: ME });
    await expect(followUser(asClient(db), ME, ME)).rejects.toThrow('self');
    expect(db.writes).toEqual([]);
  });
});

describe('reseau — demandes de suivi existantes', () => {
  it('renvoie `requested` sans réécrire une demande déjà pendante', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      profiles: [privateTarget()],
      requests: [
        {
          id: REQUEST_ID,
          requester_id: ME,
          target_id: TARGET,
          status: 'pending',
          created_at: '2026-11-10T09:00:00.000Z',
        },
      ],
    });

    await expect(followUser(asClient(db), ME, TARGET)).resolves.toEqual({
      status: 'requested',
    });
    expect(db.writes).toEqual([]);
    expect(db.tables.follow_requests[0]?.status).toBe('pending');
  });

  it('ne rouvre pas une demande refusée', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      profiles: [privateTarget()],
      requests: [
        {
          id: REQUEST_ID,
          requester_id: ME,
          target_id: TARGET,
          status: 'declined',
          created_at: '2026-11-10T09:00:00.000Z',
        },
      ],
    });

    await expect(followUser(asClient(db), ME, TARGET)).rejects.toThrow(
      'follow_request_closed'
    );
    expect(db.writes).toEqual([]);
    expect(db.tables.follow_requests[0]?.status).toBe('declined');
  });

  it('conserve le suivi existant d’une demande acceptée sans réécrire le statut', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      profiles: [privateTarget()],
      requests: [
        {
          id: REQUEST_ID,
          requester_id: ME,
          target_id: TARGET,
          status: 'accepted',
          created_at: '2026-11-10T09:00:00.000Z',
        },
      ],
      follows: [{ follower_id: ME, following_id: TARGET }],
    });

    await expect(followUser(asClient(db), ME, TARGET)).resolves.toEqual({
      status: 'following',
    });
    expect(db.writes).toEqual([]);
    expect(db.tables.follow_requests[0]?.status).toBe('accepted');
    expect(db.tables.user_follows).toEqual([
      { follower_id: ME, following_id: TARGET },
    ]);
  });

  it('ne recrée jamais un suivi privé depuis un statut accepted historique', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      profiles: [privateTarget()],
      requests: [
        {
          id: REQUEST_ID,
          requester_id: ME,
          target_id: TARGET,
          status: 'accepted',
          created_at: '2026-11-10T09:00:00.000Z',
        },
      ],
    });

    await expect(followUser(asClient(db), ME, TARGET)).rejects.toThrow(
      'follow_request_closed'
    );
    expect(db.writes).toEqual([]);
    expect(db.tables.user_follows).toEqual([]);
    expect(db.tables.follow_requests[0]?.status).toBe('accepted');
  });

  it('ne réécrit pas une demande concurrente créée entre la lecture et l’écriture', async () => {
    const db = new FakeSupabase({ viewer: ME, profiles: [privateTarget()] });
    // Simule un autre acteur qui refuse la demande après notre lecture et
    // avant notre upsert : `DO NOTHING` ne doit pas la repasser en `pending`.
    db.beforeFollowRequestUpsert = (database) => {
      database.tables.follow_requests.push({
        id: REQUEST_ID,
        requester_id: ME,
        target_id: TARGET,
        status: 'declined',
        created_at: '2026-11-10T09:00:00.000Z',
      });
    };

    await expect(followUser(asClient(db), ME, TARGET)).resolves.toEqual({
      status: 'requested',
    });
    expect(db.tables.follow_requests).toHaveLength(1);
    expect(db.tables.follow_requests[0]?.status).toBe('declined');
  });

  it('crée une seule demande quand le même suivi est rejoué', async () => {
    const db = new FakeSupabase({ viewer: ME, profiles: [privateTarget()] });

    await expect(followUser(asClient(db), ME, TARGET)).resolves.toEqual({
      status: 'requested',
    });
    await expect(followUser(asClient(db), ME, TARGET)).resolves.toEqual({
      status: 'requested',
    });

    expect(db.tables.follow_requests).toHaveLength(1);
    expect(db.tables.follow_requests[0]?.status).toBe('pending');
    expect(db.writes.filter((write) => write.table === 'follow_requests')).toHaveLength(1);
  });

  it('conserve le suivi direct d’un profil public', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      profiles: [{ id: TARGET, profile_visibility: 'public' }],
    });

    await expect(followUser(asClient(db), ME, TARGET)).resolves.toEqual({
      status: 'following',
    });
    expect(db.writes).toEqual([
      {
        table: 'user_follows',
        kind: 'upsert',
        values: { follower_id: ME, following_id: TARGET },
      },
    ]);
  });
});

describe('reseau — révocation', () => {
  it('supprime le suivi et l’autorisation acceptée, puis exige une nouvelle demande', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      profiles: [privateTarget()],
      requests: [
        {
          id: REQUEST_ID,
          requester_id: ME,
          target_id: TARGET,
          status: 'accepted',
          created_at: '2026-11-10T09:00:00.000Z',
        },
      ],
      follows: [{ follower_id: ME, following_id: TARGET }],
    });

    await unfollowUser(asClient(db), ME, TARGET);
    expect(db.tables.user_follows).toEqual([]);
    expect(db.tables.follow_requests).toEqual([]);

    await expect(followUser(asClient(db), ME, TARGET)).resolves.toEqual({
      status: 'requested',
    });
    expect(db.tables.follow_requests).toHaveLength(1);
    expect(db.tables.follow_requests[0]?.status).toBe('pending');
  });

  it('conserve un refus lors de la révocation pour empêcher sa réouverture', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      profiles: [privateTarget()],
      requests: [
        {
          id: REQUEST_ID,
          requester_id: ME,
          target_id: TARGET,
          status: 'declined',
          created_at: '2026-11-10T09:00:00.000Z',
        },
      ],
    });

    await unfollowUser(asClient(db), ME, TARGET);
    expect(db.tables.follow_requests).toHaveLength(1);
    expect(db.tables.follow_requests[0]?.status).toBe('declined');
  });
});

describe('reseau — réponse à une demande', () => {
  const pendingRequest: Row = {
    id: REQUEST_ID,
    requester_id: TARGET,
    target_id: ME,
    status: 'pending',
    created_at: '2026-11-10T09:00:00.000Z',
  };

  it('ne recrée pas un suivi en rejouant une demande acceptée historique', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      requests: [{ ...pendingRequest, status: 'accepted' }],
    });

    await expect(
      respondFollowRequest(asClient(db), ME, REQUEST_ID, 'accept')
    ).rejects.toThrow('request_not_pending');
    expect(db.writes).toEqual([]);
    expect(db.tables.user_follows).toEqual([]);
    expect(db.tables.follow_requests[0]?.status).toBe('accepted');
  });

  it('refuse d’accepter si un blocage existe dans un sens', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      requests: [{ ...pendingRequest }],
      blocks: [{ blocker_id: TARGET, blocked_id: ME }],
    });

    await expect(
      respondFollowRequest(asClient(db), ME, REQUEST_ID, 'accept')
    ).rejects.toThrow('blocked');
    expect(db.writes).toEqual([]);
    expect(db.tables.follow_requests[0]?.status).toBe('pending');
  });

  it('laisse toujours refuser une demande, même avec un blocage', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      requests: [{ ...pendingRequest }],
      blocks: [{ blocker_id: ME, blocked_id: TARGET }],
    });

    await expect(
      respondFollowRequest(asClient(db), ME, REQUEST_ID, 'decline')
    ).resolves.toBeUndefined();
    expect(db.tables.follow_requests[0]?.status).toBe('declined');
    expect(db.writes).toEqual([
      {
        table: 'follow_requests',
        kind: 'update',
        values: {
          status: 'declined',
          responded_at: expect.any(String),
        },
      },
    ]);
  });

  it('accepte normalement une demande sans blocage', async () => {
    const db = new FakeSupabase({
      viewer: ME,
      requests: [{ ...pendingRequest }],
    });

    await expect(
      respondFollowRequest(asClient(db), ME, REQUEST_ID, 'accept')
    ).resolves.toBeUndefined();
    expect(db.tables.follow_requests[0]?.status).toBe('accepted');
    expect(db.tables.user_follows).toEqual([
      { follower_id: TARGET, following_id: ME },
    ]);
  });
});
