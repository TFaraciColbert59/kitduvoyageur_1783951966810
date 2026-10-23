import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { POST } from '@/app/api/compte/share-post/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const POST_ID = '44444444-4444-4444-8444-444444444444';
const MESSAGE_ID = '55555555-5555-4555-8555-555555555555';
const ROUTE_URL = 'http://localhost/api/compte/share-post';

const POST_ROW = {
  id: POST_ID,
  title: 'Bivouac au lac Blanc',
  content: 'Une nuit sous les étoiles au-dessus du lac, avec un lever de soleil.',
  image_url: 'https://cdn.example/cover.jpg',
  media_urls: ['https://cdn.example/lac.jpg', 'https://cdn.example/refuge.jpg'],
  author_id: OTHER_USER_ID,
};

type QueryResult = { data?: unknown; error?: unknown };

interface HarnessOptions {
  user?: { id: string } | null;
  reads?: QueryResult[];
  messageResult?: QueryResult;
}

function makeClient(options: HarnessOptions = {}) {
  const reads = [...(options.reads ?? [])];
  const tables: string[] = [];
  const filters: Array<{ table: string; column: string; value: unknown }> = [];
  const selects: Array<{ table: string; columns: string }> = [];
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user === undefined ? { id: USER_ID } : options.user },
      })),
    },
    from: vi.fn((table: string) => {
      tables.push(table);
      let inserted = false;
      const builder: Record<string, unknown> = {};

      builder.select = vi.fn((columns: string) => {
        if (!inserted) selects.push({ table, columns });
        return builder;
      });
      builder.eq = vi.fn((column: string, value: unknown) => {
        filters.push({ table, column, value });
        return builder;
      });
      builder.insert = vi.fn((row: Record<string, unknown>) => {
        inserts.push({ table, row });
        inserted = true;
        return builder;
      });
      builder.maybeSingle = vi.fn(async () => reads.shift() ?? { data: null, error: null });
      builder.single = vi.fn(async () =>
        table === 'messages'
          ? (options.messageResult ?? { data: { id: MESSAGE_ID }, error: null })
          : { data: null, error: null }
      );
      // `post_shares` est inséré sans `.select()` : on rend le builder thenable.
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject);

      return builder;
    }),
  };

  return { client, tables, filters, selects, inserts };
}

function post(body: unknown): Request {
  return new Request(ROUTE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const okRead = (data: unknown): QueryResult => ({ data, error: null });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/compte/share-post', () => {
  it('refuse une requête sans utilisateur avec 401, sans lire Supabase', async () => {
    const { client, tables } = makeClient({ user: null });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post({ postId: POST_ID, conversationId: CONVERSATION_ID }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthenticated' });
    expect(tables).toEqual([]);
  });

  it('refuse un corps illisible ou incomplet avec 400', async () => {
    const { client, tables } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    const malformed = await POST(post('{'));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: 'missing' });

    const missing = await POST(post({ postId: POST_ID }));
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({ error: 'missing' });
    expect(tables).toEqual([]);
  });

  it('refuse un non-membre actif avec 403 avant de lire la publication', async () => {
    const { client, tables, filters, inserts } = makeClient({
      reads: [okRead(null)],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post({ postId: POST_ID, conversationId: CONVERSATION_ID }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
    expect(tables).toEqual(['conversation_members']);
    expect(inserts).toEqual([]);
    expect(filters).toEqual(
      expect.arrayContaining([
        { table: 'conversation_members', column: 'conversation_id', value: CONVERSATION_ID },
        { table: 'conversation_members', column: 'user_id', value: USER_ID },
      ])
    );
  });

  it('refuse un contrôle d’adhésion en erreur avec 500, sans insérer', async () => {
    const { client, inserts } = makeClient({
      reads: [{ data: null, error: { message: 'boom' } }],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post({ postId: POST_ID, conversationId: CONVERSATION_ID }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'membership_check_failed' });
    expect(inserts).toEqual([]);
  });

  it('insère le message post et le partage avec la métadonnée complète', async () => {
    const { client, filters, selects, inserts } = makeClient({
      reads: [
        okRead({ conversation_id: CONVERSATION_ID }),
        okRead(POST_ROW),
        okRead({ full_name: 'Alice', avatar_url: 'https://cdn.example/alice.jpg' }),
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post({ postId: POST_ID, conversationId: CONVERSATION_ID }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      url: `/communaute?post=${POST_ID}`,
    });

    const postSelect = selects.find((call) => call.table === 'community_posts');
    expect(postSelect?.columns).toBe('id,title,content,image_url,media_urls,author_id');
    expect(selects.find((call) => call.table === 'public_profiles')?.columns).toBe(
      'full_name,avatar_url'
    );
    expect(filters).toEqual(
      expect.arrayContaining([
        { table: 'community_posts', column: 'id', value: POST_ID },
        { table: 'public_profiles', column: 'id', value: OTHER_USER_ID },
      ])
    );

    const messageInsert = inserts.find((entry) => entry.table === 'messages');
    expect(messageInsert?.row).toMatchObject({
      conversation_id: CONVERSATION_ID,
      sender_id: USER_ID,
      content: 'Bivouac au lac Blanc',
      message_type: 'post',
      metadata: {
        post_id: POST_ID,
        post_url: `/communaute?post=${POST_ID}`,
        title: 'Bivouac au lac Blanc',
        image_url: 'https://cdn.example/lac.jpg',
        author_name: 'Alice',
        author_avatar: 'https://cdn.example/alice.jpg',
      },
    });

    expect(inserts.find((entry) => entry.table === 'post_shares')?.row).toEqual({
      post_id: POST_ID,
      user_id: USER_ID,
      conversation_id: CONVERSATION_ID,
      message_id: MESSAGE_ID,
    });
  });

  it('utilise l’extrait et image_url quand le titre et les médias manquent', async () => {
    const content = 'A'.repeat(120);
    const { client, inserts } = makeClient({
      reads: [
        okRead({ conversation_id: CONVERSATION_ID }),
        okRead({
          ...POST_ROW,
          title: null,
          content,
          media_urls: [],
          image_url: 'https://cdn.example/cover.jpg',
        }),
        okRead({ full_name: 'Alice', avatar_url: null }),
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post({ postId: POST_ID, conversationId: CONVERSATION_ID }));

    expect(response.status).toBe(200);
    const message = inserts.find((entry) => entry.table === 'messages')?.row as {
      content: string;
      metadata: { title: string; image_url: string; author_avatar: string | null };
    };
    expect(message.content).toBe('A'.repeat(80));
    expect(message.metadata).toMatchObject({
      title: 'A'.repeat(80),
      image_url: 'https://cdn.example/cover.jpg',
      author_avatar: null,
    });
  });

  it('renvoie 404 quand la publication est introuvable, sans insérer', async () => {
    const { client, inserts } = makeClient({
      reads: [okRead({ conversation_id: CONVERSATION_ID }), okRead(null)],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(post({ postId: POST_ID, conversationId: CONVERSATION_ID }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'post_not_found' });
    expect(inserts).toEqual([]);
  });
});
