import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { POST } from '@/app/api/compte/repost/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const ORIGINAL_ID = '55555555-5555-4555-8555-555555555555';
const CLUB_ID = '66666666-6666-4666-8666-666666666666';
const ROUTE_URL = 'http://localhost/api/compte/repost';

const SOURCE = {
  id: SOURCE_ID,
  title: 'Lac Blanc',
  content: 'Bivouac au lac',
  image_url: 'https://cdn.example/lac.jpg',
  image_alt: 'Lac Blanc au lever du jour',
  media_urls: [],
  post_type: 'share',
  author_id: '44444444-4444-4444-8444-444444444444',
  audience: 'public',
  reposted_from_id: null as string | null,
};

type QueryResult = { data?: unknown; error?: unknown };

function makeClient(
  options: {
    user?: { id: string } | null;
    results?: QueryResult[];
    insertError?: { code?: string; message?: string } | null;
  } = {}
) {
  const queue = [...(options.results ?? [])];
  const inserts: Array<Record<string, unknown>> = [];
  const fromTables: string[] = [];
  const eqCalls: Array<[string, unknown]> = [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user === undefined ? { id: USER_ID } : options.user },
      })),
    },
    from: vi.fn((table: string) => {
      fromTables.push(table);
      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn((column: string, value: unknown) => {
        eqCalls.push([column, value]);
        return builder;
      });
      builder.insert = vi.fn((payload: Record<string, unknown>) => {
        inserts.push(payload);
        return builder;
      });
      builder.maybeSingle = vi.fn(async () => queue.shift() ?? { data: null, error: null });
      builder.single = vi.fn(async () => {
        if (options.insertError) return { data: null, error: options.insertError };
        return queue.shift() ?? { data: null, error: null };
      });
      return builder;
    }),
  };

  return { client, inserts, fromTables, eqCalls };
}

function post(body: unknown): Request {
  return new Request(ROUTE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/compte/repost', () => {
  it('refuse une requête sans utilisateur avec 401', async () => {
    const { client, fromTables } = makeClient({ user: null });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post({ sourceId: SOURCE_ID, audience: 'public' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthenticated' });
    expect(fromTables).toHaveLength(0);
  });

  it('refuse un corps JSON malformé avec 400', async () => {
    const { client } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post('{'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_request' });
  });

  it('refuse une audience inconnue avec 400 sans lire la source', async () => {
    const { client, fromTables } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post({ sourceId: SOURCE_ID, audience: 'monde' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'audience_invalid' });
    expect(fromTables).toHaveLength(0);
  });

  it('refuse une source invisible ou inexistante avec 400', async () => {
    const { client, inserts } = makeClient({ results: [{ data: null, error: null }] });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'source_invalid' });
    expect(inserts).toHaveLength(0);
  });

  it('crée la republication avec reposted_from_id, attribution et idempotence', async () => {
    const { client, inserts, eqCalls } = makeClient({
      results: [
        { data: null, error: null },
        { data: SOURCE, error: null },
        { data: { id: 'new-post' }, error: null },
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: 'new-post',
      repostedFromId: SOURCE_ID,
    });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      author_id: USER_ID,
      audience: 'public',
      club_id: null,
      reposted_from_id: SOURCE_ID,
      client_request_id: REQUEST_ID,
      title: 'Lac Blanc',
      content: 'Bivouac au lac',
      image_url: 'https://cdn.example/lac.jpg',
      post_type: 'share',
    });
    expect(eqCalls).toEqual(
      expect.arrayContaining([
        ['author_id', USER_ID],
        ['client_request_id', REQUEST_ID],
        ['id', SOURCE_ID],
      ])
    );
  });

  it('rejoue la même requête sans créer de doublon', async () => {
    const { client, inserts, fromTables } = makeClient({
      results: [{ data: { id: 'existing-post' }, error: null }],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: 'existing-post',
      duplicate: true,
    });
    expect(fromTables).toHaveLength(1);
    expect(inserts).toHaveLength(0);
  });

  it('absorbe une course sur l’index unique et renvoie la ligne existante', async () => {
    const { client, inserts } = makeClient({
      results: [
        { data: null, error: null },
        { data: SOURCE, error: null },
        { data: { id: 'existing-post' }, error: null },
      ],
      insertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: 'existing-post',
      duplicate: true,
    });
    expect(inserts).toHaveLength(1);
  });

  it('refuse un identifiant de requête non UUID avec 400', async () => {
    const { client, fromTables } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({ sourceId: SOURCE_ID, audience: 'public', client_request_id: 'not-a-uuid' })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'client_request_id_invalid' });
    expect(fromTables).toHaveLength(0);
  });

  it('exige un club pour une audience club', async () => {
    const { client, fromTables } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post({ sourceId: SOURCE_ID, audience: 'club' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'audience_invalid' });
    expect(fromTables).toHaveLength(0);
  });

  it('exige client_request_id pour une idempotence réelle', async () => {
    const { client, fromTables } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post({ sourceId: SOURCE_ID, audience: 'public' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'client_request_id_required' });
    expect(fromTables).toHaveLength(0);
  });

  it('refuse d’élargir l’audience d’une source abonnés vers public', async () => {
    const { client, inserts } = makeClient({
      results: [
        { data: null, error: null },
        { data: { ...SOURCE, audience: 'abonnies' }, error: null },
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'audience_escalation' });
    expect(inserts).toHaveLength(0);
  });

  it('refuse d’élargir l’audience d’une source club vers public', async () => {
    const { client, inserts } = makeClient({
      results: [
        { data: null, error: null },
        { data: { ...SOURCE, audience: 'club' }, error: null },
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'audience_escalation' });
    expect(inserts).toHaveLength(0);
  });

  it('traite une source sans audience connue comme privée', async () => {
    const { client, inserts } = makeClient({
      results: [
        { data: null, error: null },
        { data: { ...SOURCE, audience: null }, error: null },
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'audience_escalation' });
    expect(inserts).toHaveLength(0);
  });

  it('autorise une audience identique à celle de la source', async () => {
    const { client, inserts } = makeClient({
      results: [
        { data: null, error: null },
        { data: { ...SOURCE, audience: 'abonnies' }, error: null },
        { data: { id: 'new-post' }, error: null },
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'abonnies',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(200);
    expect(inserts[0]).toMatchObject({ audience: 'abonnies' });
  });

  it('aplatit une republication de republication vers la source d’origine visible', async () => {
    const { client, inserts, eqCalls } = makeClient({
      results: [
        { data: null, error: null },
        { data: { ...SOURCE, reposted_from_id: ORIGINAL_ID }, error: null },
        { data: { id: ORIGINAL_ID }, error: null },
        { data: { id: 'new-post' }, error: null },
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: 'new-post',
      repostedFromId: ORIGINAL_ID,
    });
    expect(inserts[0]).toMatchObject({
      reposted_from_id: ORIGINAL_ID,
      title: 'Lac Blanc',
    });
    expect(eqCalls).toEqual(expect.arrayContaining([['id', ORIGINAL_ID]]));
  });

  it('conserve la source immédiate visible quand la racine est invisible sous RLS', async () => {
    const { client, inserts, eqCalls } = makeClient({
      results: [
        { data: null, error: null },
        { data: { ...SOURCE, reposted_from_id: ORIGINAL_ID }, error: null },
        { data: null, error: null },
        { data: { id: 'new-post' }, error: null },
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: 'new-post',
      repostedFromId: SOURCE_ID,
    });
    expect(inserts[0]).toMatchObject({
      reposted_from_id: SOURCE_ID,
      title: 'Lac Blanc',
      content: 'Bivouac au lac',
    });
    // La racine a bien été testée sous RLS, mais n'a pas été retenue.
    expect(eqCalls).toEqual(expect.arrayContaining([['id', ORIGINAL_ID]]));
  });

  it('conserve la source immédiate quand la vérification de la racine échoue', async () => {
    const { client, inserts } = makeClient({
      results: [
        { data: null, error: null },
        { data: { ...SOURCE, reposted_from_id: ORIGINAL_ID }, error: null },
        { data: null, error: { code: '08006', message: 'connection failure' } },
        { data: { id: 'new-post' }, error: null },
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    // La vérification de la racine est une amélioration d'attribution : son
    // échec ne doit pas bloquer un relais de source visible.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: 'new-post',
      repostedFromId: SOURCE_ID,
    });
    expect(inserts[0]).toMatchObject({ reposted_from_id: SOURCE_ID });
  });

  it('refuse une source sans contenu plutôt que de créer un relais vide', async () => {
    const { client, inserts } = makeClient({
      results: [
        { data: null, error: null },
        { data: { ...SOURCE, content: '   ' }, error: null },
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'source_empty' });
    expect(inserts).toHaveLength(0);
  });

  it('renvoie 500 quand la lecture de la source échoue pour une raison d’infrastructure', async () => {
    const { client } = makeClient({
      results: [
        { data: null, error: null },
        { data: null, error: { code: '57P01', message: 'admin shutdown' } },
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'repost_failed' });
  });

  it('renvoie 500 quand l’insertion échoue pour une raison d’infrastructure', async () => {
    const { client } = makeClient({
      results: [{ data: null, error: null }, { data: SOURCE, error: null }],
      insertError: { code: '08006', message: 'connection failure' },
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'public',
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'repost_failed' });
  });

  it('renvoie 400 quand l’insertion est refusée par une validation métier', async () => {
    const { client } = makeClient({
      results: [{ data: null, error: null }, { data: { ...SOURCE, audience: 'club' }, error: null }],
      insertError: { code: 'P0001', message: 'Cannot publish to a club without active membership' },
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(
      post({
        sourceId: SOURCE_ID,
        audience: 'club',
        clubId: CLUB_ID,
        client_request_id: REQUEST_ID,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'repost_failed' });
  });
});
