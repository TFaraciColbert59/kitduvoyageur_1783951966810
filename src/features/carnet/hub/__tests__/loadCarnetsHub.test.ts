import { describe, expect, it } from 'vitest';
import { loadCarnetsHub, type HubClientLike, type HubQueryLike } from '../loadCarnetsHub';

/**
 * Chargeur du hub : client Supabase factice (aucune requête réseau) qui rejoue
 * la chaîne PostgREST — filtres, tri, limite, projection des colonnes et plan
 * d'erreurs par requête. On vérifie les phases, le repli photos, les erreurs
 * partielles et la tolérance à l'absence de `live_sharing`.
 */

type Row = Record<string, unknown>;
type ErrorLike = { code?: string | null; message?: string | null };

interface FakeConfig {
  userId?: string | null;
  rows?: Record<string, Row[]>;
  /** Plan d'erreurs par table : la n-ième requête sur la table reçoit ce résultat. */
  errorPlan?: Record<string, Array<ErrorLike | null | undefined>>;
}

interface Filter {
  kind: 'eq' | 'in' | 'not';
  column: string;
  value?: unknown;
  values?: ReadonlyArray<unknown>;
  operator?: string;
}

function createFakeClient(config: FakeConfig): HubClientLike & { queryCounts: Record<string, number> } {
  const queryCounts: Record<string, number> = {};
  const rowsByTable = config.rows ?? {};

  function resolve(table: string, queryIndex: number, filters: Filter[], order: { column: string; ascending: boolean } | null, limit: number | null, columns: string | null) {
    const error = config.errorPlan?.[table]?.[queryIndex] ?? null;
    if (error) return { data: null, error };

    let rows = (rowsByTable[table] ?? []).filter((row) =>
      filters.every((filter) => {
        if (filter.kind === 'eq') return row[filter.column] === filter.value;
        if (filter.kind === 'in') return (filter.values ?? []).includes(row[filter.column]);
        // `not(col, 'is', null)` : on ne garde que les valeurs renseignées.
        if (filter.operator === 'is' && filter.value === null) return row[filter.column] != null;
        return true;
      }),
    );

    if (order) {
      rows = [...rows].sort((a, b) => {
        const av = a[order.column];
        const bv = b[order.column];
        if (av === bv) return 0;
        const result = (av as never) < (bv as never) ? -1 : 1;
        return order.ascending ? result : -result;
      });
    }

    if (limit != null) rows = rows.slice(0, limit);

    const wanted = columns
      ? columns.split(',').map((column) => column.trim()).filter(Boolean)
      : null;
    const data = rows.map((row) =>
      wanted
        ? Object.fromEntries(wanted.map((column) => [column, row[column]]))
        : { ...row },
    );
    return { data, error: null };
  }

  function makeBuilder(
    table: string,
    queryIndex: number,
    filters: Filter[] = [],
    order: { column: string; ascending: boolean } | null = null,
    limit: number | null = null,
    columns: string | null = null,
  ): HubQueryLike<unknown> {
    const builder = {
      select: (nextColumns?: string) =>
        makeBuilder(table, queryIndex, filters, order, limit, nextColumns ?? null),
      eq: (column: string, value: unknown) =>
        makeBuilder(table, queryIndex, [...filters, { kind: 'eq', column, value }], order, limit, columns),
      in: (column: string, values: ReadonlyArray<unknown>) =>
        makeBuilder(table, queryIndex, [...filters, { kind: 'in', column, values }], order, limit, columns),
      not: (column: string, operator: string, value: unknown) =>
        makeBuilder(
          table,
          queryIndex,
          [...filters, { kind: 'not', column, operator, value }],
          order,
          limit,
          columns,
        ),
      order: (column: string, options?: { ascending?: boolean }) =>
        makeBuilder(
          table,
          queryIndex,
          filters,
          { column, ascending: options?.ascending !== false },
          limit,
          columns,
        ),
      limit: (count: number) => makeBuilder(table, queryIndex, filters, order, count, columns),
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(resolve(table, queryIndex, filters, order, limit, columns)).then(
          onFulfilled,
          onRejected,
        ),
    };
    return builder as unknown as HubQueryLike<unknown>;
  }

  const client = {
    from(table: string) {
      queryCounts[table] = (queryCounts[table] ?? 0) + 1;
      return makeBuilder(table, queryCounts[table] - 1);
    },
    auth: {
      getUser: async () => ({ data: { user: config.userId ? { id: config.userId } : null } }),
    },
    queryCounts,
  };
  return client as unknown as HubClientLike & { queryCounts: Record<string, number> };
}

const NOW = new Date('2026-07-14T09:00:00Z'); // 14/07 11:00 à Paris

function carnetRow(overrides: Row = {}): Row {
  return {
    id: 'c-live',
    author_id: 'u2',
    title: 'Tour des Écrins',
    destination: 'Écrins',
    cover_image: null,
    start_date: '2026-07-13',
    end_date: '2026-07-21',
    visibility: 'public',
    country_iso: 'fr',
    live_sharing: true,
    map_points: { trace: [[6.1, 44.9], [6.4, 44.8], [6.6, 44.7]] },
    distance_km: '61.2',
    denivele_m: 4120,
    nb_nuits: 8,
    nb_voyageurs: 3,
    likes_count: 12,
    comments_count: 3,
    verified: true,
    created_at: '2026-07-01T08:00:00Z',
    updated_at: '2026-07-14T08:00:00Z',
    ...overrides,
  };
}

function baseRows(): Record<string, Row[]> {
  return {
    carnets: [
      carnetRow(),
      carnetRow({
        id: 'c-next',
        author_id: 'u4',
        title: 'Traversée des Pyrénées',
        destination: 'Pyrénées',
        start_date: '2026-08-01',
        end_date: '2026-08-04',
        country_iso: null,
        live_sharing: false,
        map_points: null,
        distance_km: 0,
        denivele_m: 0,
        nb_nuits: 3,
        nb_voyageurs: 1,
        verified: false,
        updated_at: '2026-07-10T08:00:00Z',
      }),
      carnetRow({
        id: 'c-done',
        author_id: 'u3',
        title: 'Sentier des douaniers',
        destination: 'Bretagne',
        start_date: '2026-06-01',
        end_date: '2026-06-06',
        country_iso: null,
        live_sharing: false,
        map_points: [[-4.5, 48.3], [-4.4, 48.4]],
        distance_km: 112,
        denivele_m: 900,
        nb_nuits: 5,
        nb_voyageurs: 2,
        verified: false,
        updated_at: '2026-06-07T08:00:00Z',
      }),
    ],
    carnet_moments: [
      { carnet_id: 'c-live', image_url: 'https://cdn/live-1.jpg', created_at: '2026-07-13T08:00:00Z' },
      { carnet_id: 'c-live', image_url: 'https://cdn/live-2.jpg', created_at: '2026-07-13T12:00:00Z' },
      { carnet_id: 'c-live', image_url: 'https://cdn/live-4.jpg', created_at: '2026-07-14T08:00:00Z' },
      { carnet_id: 'c-live', image_url: 'https://cdn/live-3.jpg', created_at: '2026-07-13T18:00:00Z' },
      { carnet_id: 'c-live', image_url: null, created_at: '2026-07-14T09:00:00Z' },
      { carnet_id: 'c-next', image_url: 'https://cdn/next-1.jpg', created_at: '2026-06-01T08:00:00Z' },
    ],
    carnet_collaborators: [
      { carnet_id: 'c-live', user_id: 'u2', role: 'owner', created_at: '2026-07-01T08:00:00Z' },
      { carnet_id: 'c-live', user_id: 'u5', role: 'participant', created_at: '2026-07-02T08:00:00Z' },
    ],
    carnet_likes: [{ carnet_id: 'c-live', user_id: 'u1' }],
    user_follows: [{ follower_id: 'u1', following_id: 'u2' }],
    public_profiles: [
      { id: 'u2', handle: 'camille', full_name: 'Camille Roux', avatar_url: 'https://cdn/u2.jpg' },
      { id: 'u3', handle: 'marc', full_name: 'Marc Petit', avatar_url: null },
      { id: 'u4', handle: 'lea', full_name: 'Léa Roux', avatar_url: null },
      { id: 'u5', handle: 'sam', full_name: 'Sam Diallo', avatar_url: null },
    ],
  };
}

describe('loadCarnetsHub', () => {
  it('lit les carnets sous RLS, dérive phases, jours, métriques et voyageurs', async () => {
    const client = createFakeClient({ userId: 'u1', rows: baseRows() });
    const data = await loadCarnetsHub({ client, now: NOW });

    expect(data.error).toBe(false);
    expect(data.viewerId).toBe('u1');
    expect(data.items.map((item) => item.id)).toEqual(['c-live', 'c-next', 'c-done']);
    expect(data.followedCount).toBe(1);
    expect(data.mineCount).toBe(0);

    const live = data.items[0];
    expect(live.phase).toBe('en_route');
    expect(live.dayCurrent).toBe(2);
    expect(live.daysTotal).toBe(9);
    expect(live.destination).toBe('Écrins');
    expect(live.countryIso).toBe('FR');
    expect(live.distanceKm).toBe(61.2);
    expect(live.elevationGainM).toBe(4120);
    expect(live.nights).toBe(8);
    expect(live.liveSharing).toBe(true);
    expect(live.verifiedGps).toBe(true);
    expect(live.likedByMe).toBe(true);
    expect(live.isFollowed).toBe(true);
    expect(live.isMine).toBe(false);
    expect(live.coverImage).toBeNull();
    // 3 dernières images de moments, ordre décroissant, sans les vides.
    expect(live.coverPhotos).toEqual([
      'https://cdn/live-4.jpg',
      'https://cdn/live-3.jpg',
      'https://cdn/live-2.jpg',
    ]);
    expect(live.author).toEqual({
      id: 'u2',
      name: 'Camille Roux',
      initials: 'CR',
      avatarUrl: 'https://cdn/u2.jpg',
    });
    expect(live.travelers.map((traveler) => traveler.id)).toEqual(['u2', 'u5']);
    expect(live.travelersTotal).toBe(3);
    expect(live.routeTrace).toHaveLength(3);

    const preparation = data.items[1];
    expect(preparation.phase).toBe('preparation');
    expect(preparation.dayCurrent).toBeNull();
    expect(preparation.countryIso).toBeNull();

    const done = data.items[2];
    expect(done.phase).toBe('rentre');
    expect(done.routeTrace).toHaveLength(2);
  });

  it('ajoute mes carnets (privés compris) et les carnets des personnes suivies', async () => {
    const rows = baseRows();
    rows.carnets.push(
      carnetRow({
        id: 'c-mine',
        author_id: 'u1',
        title: 'Mon carnet privé',
        visibility: 'private',
        start_date: '2026-05-01',
        end_date: '2026-05-03',
        updated_at: '2026-05-04T08:00:00Z',
      }),
      carnetRow({
        id: 'c-followed',
        author_id: 'u2',
        title: 'Un carnet de Camille',
        visibility: 'public',
        start_date: '2026-04-01',
        end_date: '2026-04-02',
        updated_at: '2026-04-03T08:00:00Z',
      }),
      // Carnet privé d'un tiers non suivi : la RLS ne le rend pas au lecteur.
      carnetRow({
        id: 'c-other-private',
        author_id: 'u3',
        title: 'Carnet privé de Marc',
        visibility: 'private',
        start_date: '2026-03-01',
        end_date: '2026-03-02',
        updated_at: '2026-03-03T08:00:00Z',
      }),
    );
    const client = createFakeClient({ userId: 'u1', rows });
    const data = await loadCarnetsHub({ client, now: NOW });

    const ids = data.items.map((item) => item.id);
    expect(ids).toContain('c-mine');
    expect(ids).toContain('c-followed');
    expect(ids).not.toContain('c-other-private');
    expect(data.items.find((item) => item.id === 'c-mine')?.isMine).toBe(true);
    expect(data.items.find((item) => item.id === 'c-followed')?.isFollowed).toBe(true);
    expect(data.mineCount).toBe(1);
    expect(data.followedCount).toBe(2);
  });

  it('tolère les erreurs partielles : repli photos et voyageurs vides, cartes rendues', async () => {
    const client = createFakeClient({
      userId: 'u1',
      rows: baseRows(),
      errorPlan: {
        carnet_moments: [{ code: 'XX000', message: 'moments indisponibles' }],
        carnet_collaborators: [{ code: 'XX000', message: 'collaborateurs indisponibles' }],
        carnet_likes: [{ code: 'XX000', message: 'j’aime indisponibles' }],
      },
    });
    const data = await loadCarnetsHub({ client, now: NOW });

    expect(data.error).toBe(false);
    expect(data.items).toHaveLength(3);
    expect(data.items[0].coverPhotos).toEqual([]);
    // Sans collaborateurs lisibles, l'auteur reste le voyageur visible.
    expect(data.items[0].travelers.map((traveler) => traveler.id)).toEqual(['u2']);
    expect(data.items[0].travelersTotal).toBe(3);
    expect(data.items[0].likedByMe).toBe(false);
  });

  it('bascule en erreur totale quand la lecture des carnets échoue', async () => {
    const client = createFakeClient({
      userId: 'u1',
      rows: baseRows(),
      errorPlan: { carnets: [{ code: 'XX000', message: 'base indisponible' }] },
    });
    const data = await loadCarnetsHub({ client, now: NOW });

    expect(data.error).toBe(true);
    expect(data.items).toEqual([]);
    expect(data.viewerId).toBe('u1');
  });

  it('relit sans `live_sharing` quand la colonne manque (42703)', async () => {
    const client = createFakeClient({
      rows: baseRows(),
      errorPlan: { carnets: [{ code: '42703', message: 'column live_sharing does not exist' }] },
    });
    const data = await loadCarnetsHub({ client, now: NOW });

    expect(data.error).toBe(false);
    expect(data.items).toHaveLength(3);
    expect(data.items[0].liveSharing).toBe(false);
    expect(client.queryCounts.carnets).toBeGreaterThanOrEqual(2);
  });

  it('sans session : carnets publics seulement, aucun j’aime lu', async () => {
    const client = createFakeClient({ userId: null, rows: baseRows() });
    const data = await loadCarnetsHub({ client, now: NOW });

    expect(data.viewerId).toBeNull();
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((item) => item.likedByMe === false)).toBe(true);
    expect(data.items.every((item) => item.isMine === false)).toBe(true);
    expect(client.queryCounts.carnet_likes ?? 0).toBe(0);
    expect(client.queryCounts.user_follows ?? 0).toBe(0);
  });

  it('normalise `map_points` (objet ou tableau) et ne garde qu’un code pays valide', async () => {
    const rows = baseRows();
    rows.carnets = [
      carnetRow({ id: 'c-obj', map_points: { trace: [[1, 45], [2, 46]] } }),
      carnetRow({ id: 'c-array', map_points: [[3, 47], [4, 48]], country_iso: 'FRA' }),
      carnetRow({ id: 'c-empty', map_points: null, country_iso: null }),
    ];
    const client = createFakeClient({ rows });
    const data = await loadCarnetsHub({ client, now: NOW });

    expect(data.items.find((item) => item.id === 'c-obj')?.routeTrace).not.toBeNull();
    expect(data.items.find((item) => item.id === 'c-array')?.routeTrace).not.toBeNull();
    expect(data.items.find((item) => item.id === 'c-array')?.countryIso).toBeNull();
    expect(data.items.find((item) => item.id === 'c-empty')?.routeTrace).toBeNull();
    expect(data.items.find((item) => item.id === 'c-empty')?.countryIso).toBeNull();
  });
});
