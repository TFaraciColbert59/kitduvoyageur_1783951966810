import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { POST } from '@/app/api/carnets/share/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const CARNET_ID = '44444444-4444-4444-8444-444444444444';
const MESSAGE_ID = '55555555-5555-4555-8555-555555555555';
const ROUTE_URL = 'http://localhost/api/carnets/share';

const CARNET_ROW = {
  id: CARNET_ID,
  title: 'GR20 en 8 jours',
  description: 'Huit jours sur les arêtes corses, entre bergeries et torrents.',
  destination: 'Corse, France',
  cover_image: 'https://cdn.example/corse.jpg',
  author_id: OTHER_USER_ID,
  visibility: 'public',
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
      const builder: Record<string, unknown> = {};

      builder.select = vi.fn((columns: string) => {
        selects.push({ table, columns });
        return builder;
      });
      builder.eq = vi.fn((column: string, value: unknown) => {
        filters.push({ table, column, value });
        return builder;
      });
      builder.insert = vi.fn((row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return builder;
      });
      builder.maybeSingle = vi.fn(async () => reads.shift() ?? { data: null, error: null });
      builder.single = vi.fn(async () =>
        table === 'messages'
          ? (options.messageResult ?? { data: { id: MESSAGE_ID }, error: null })
          : { data: null, error: null }
      );

      return builder;
    }),
  };

  return { client, tables, filters, selects, inserts };
}

function share(body: unknown): Request {
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

describe('POST /api/carnets/share', () => {
  it('refuse une requête sans utilisateur avec 401, sans lire Supabase', async () => {
    const { client, tables } = makeClient({ user: null });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(share({ carnetId: CARNET_ID, conversationId: CONVERSATION_ID }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthenticated' });
    expect(tables).toEqual([]);
  });

  it('refuse un corps incomplet avec 400', async () => {
    const { client, tables } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    const missing = await POST(share({ carnetId: CARNET_ID }));

    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({ error: 'missing' });
    expect(tables).toEqual([]);
  });

  it('insère le message carnet avec la métadonnée complète', async () => {
    const { client, filters, selects, inserts } = makeClient({
      reads: [
        okRead({ conversation_id: CONVERSATION_ID }),
        okRead(CARNET_ROW),
        okRead({ full_name: 'Léa', avatar_url: 'https://cdn.example/lea.jpg' }),
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(share({ carnetId: CARNET_ID, conversationId: CONVERSATION_ID }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, url: `/carnets/${CARNET_ID}` });

    expect(selects.find((call) => call.table === 'carnets')?.columns).toBe(
      'id,title,description,destination,cover_image,author_id,visibility'
    );
    expect(filters).toEqual(
      expect.arrayContaining([
        { table: 'carnets', column: 'id', value: CARNET_ID },
        { table: 'carnets', column: 'visibility', value: 'public' },
      ])
    );

    const messageInsert = inserts.find((entry) => entry.table === 'messages');
    expect(messageInsert?.row).toMatchObject({
      conversation_id: CONVERSATION_ID,
      sender_id: USER_ID,
      content: 'GR20 en 8 jours',
      message_type: 'carnet',
      metadata: {
        carnet_id: CARNET_ID,
        carnet_url: `/carnets/${CARNET_ID}`,
        title: 'GR20 en 8 jours',
        image_url: 'https://cdn.example/corse.jpg',
        destination: 'Corse, France',
        author_name: 'Léa',
        author_avatar: 'https://cdn.example/lea.jpg',
      },
    });
  });

  it('renvoie 404 quand le carnet est introuvable, sans insérer', async () => {
    const { client, inserts } = makeClient({
      reads: [okRead({ conversation_id: CONVERSATION_ID }), okRead(null)],
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await POST(share({ carnetId: CARNET_ID, conversationId: CONVERSATION_ID }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'carnet_not_found' });
    expect(inserts).toEqual([]);
  });
});
