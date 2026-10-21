/**
 * Task 14 — `POST /api/compte/invitations`.
 *
 * Contrat verrouillé :
 * - 401 sans session, avant toute lecture ou analyse du corps ;
 * - zod strict : action inconnue, champ en trop ou identifiant invalide → 400 ;
 * - `create` propriétaire seulement : `owner_id = auth.uid()`, jeton unique,
 *   expiration, statut `pending`, jamais de clé service ;
 * - `revoke` propriétaire seulement : la ligne visée porte `owner_id = auth.uid()`,
 *   une révocation déjà faite reste idempotente ;
 * - `accept` lie **`invitee_id = auth.uid()`** et passe `pending → accepted` ;
 *   une invitation expirée, révoquée ou déjà acceptée par un autre est un 409 ;
 * - 403 (RLS), 404 (introuvable) et 500 (infrastructure) explicites.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { GET, POST } from '@/app/api/compte/invitations/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const INVITATION_ID = '44444444-4444-4444-8444-444444444444';
const TOKEN = 'jeton-invitation-unique-0123456789';

const NOW = new Date('2026-10-21T12:00:00Z');
const FUTURE = new Date('2026-11-20T12:00:00Z').toISOString();

type Row = Record<string, unknown>;
type Result = { data: Row | Row[] | null; error: unknown };

interface HarnessCalls {
  tables: string[];
  inserts: Array<{ table: string; row: Row }>;
  updates: Array<{ table: string; patch: Row }>;
  eqs: Array<{ table: string; column: string; value: unknown }>;
  rpcs: Array<{ fn: string; args: Record<string, unknown> }>;
  orders: Array<{ table: string; column: string; ascending: unknown }>;
  limits: Array<{ table: string; count: unknown }>;
}

function chain(result: () => Result) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result());
  builder.single = vi.fn(async () => result());
  builder.then = (resolveThen: (value: Result) => unknown) =>
    Promise.resolve(result()).then(resolveThen);
  return builder;
}

function harness(
  options: {
    user?: { id: string } | null;
    select?: Result;
    insert?: Result;
    update?: Result;
    rpc?: Result;
    list?: Result;
  } = {}
) {
  const calls: HarnessCalls = {
    tables: [],
    inserts: [],
    updates: [],
    eqs: [],
    rpcs: [],
    orders: [],
    limits: [],
  };
  const user = options.user === undefined ? { id: USER_ID } : options.user;

  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.rpcs.push({ fn, args });
      return options.rpc ?? { data: null, error: null };
    }),
    from: vi.fn((table: string) => {
      calls.tables.push(table);
      let operationResult: Result | null = null;
      const builder = chain(() => operationResult ?? options.select ?? { data: null, error: null });
      builder.select = vi.fn(() => builder);
      builder.insert = vi.fn((row: Row) => {
        calls.inserts.push({ table, row });
        operationResult = options.insert ?? { data: null, error: null };
        return builder;
      });
      builder.update = vi.fn((patch: Row) => {
        calls.updates.push({ table, patch });
        operationResult = options.update ?? { data: null, error: null };
        return builder;
      });
      builder.eq = vi.fn((column: string, value: unknown) => {
        calls.eqs.push({ table, column, value });
        return builder;
      });
      builder.order = vi.fn((column: string, options?: { ascending?: unknown }) => {
        calls.orders.push({ table, column, ascending: options?.ascending });
        return builder;
      });
      builder.limit = vi.fn((count: unknown) => {
        calls.limits.push({ table, count });
        operationResult = options.list ?? { data: [], error: null };
        return builder;
      });
      return builder;
    }),
  };

  return { client, calls };
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/compte/invitations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function use(harnessed: ReturnType<typeof harness>) {
  vi.mocked(createClient).mockResolvedValue(harnessed.client as never);
  return harnessed;
}

function invitationRow(overrides: Row = {}): Row {
  return {
    id: INVITATION_ID,
    owner_id: OTHER_ID,
    invitee_id: null,
    token: TOKEN,
    status: 'pending',
    expires_at: FUTURE,
    created_at: NOW.toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  // Les pannes d'infrastructure sont volontairement testées : pas de bruit.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('POST /api/compte/invitations — session et validation', () => {
  it('refuse sans session (401) sans toucher la base ni lire le corps', async () => {
    const h = use(harness({ user: null }));

    const response = await POST(post('pas-du-json'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthenticated' });
    expect(h.calls.tables).toEqual([]);
  });

  it('refuse une action inconnue (400)', async () => {
    const h = use(harness());

    const response = await POST(post({ action: 'repondre' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_action' });
    expect(h.calls.tables).toEqual([]);
  });

  it('refuse un corps illisible, un champ en trop ou une valeur invalide (400)', async () => {
    const h = use(harness());

    expect((await POST(post('pas-du-json'))).status).toBe(400);
    expect((await POST(post({ action: 'create', ownerId: OTHER_ID }))).status).toBe(400);
    expect((await POST(post({ action: 'create', expiresInDays: 0 }))).status).toBe(400);
    expect((await POST(post({ action: 'accept' }))).status).toBe(400);
    expect((await POST(post({ action: 'revoke', invitationId: 'pas-un-uuid' }))).status).toBe(400);
    expect(h.calls.inserts).toEqual([]);
    expect(h.calls.updates).toEqual([]);
  });
});

describe('POST /api/compte/invitations — create propriétaire', () => {
  it('crée une invitation pending liée au propriétaire avec un jeton unique et une expiration', async () => {
    const h = use(
      harness({
        insert: {
          data: invitationRow({ owner_id: USER_ID, expires_at: FUTURE }),
          error: null,
        },
      })
    );

    const response = await POST(post({ action: 'create' }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.invitation.id).toBe(INVITATION_ID);
    expect(body.invitation.status).toBe('pending');

    const row = h.calls.inserts[0];
    expect(row.table).toBe('profile_invitations');
    expect(row.row.owner_id).toBe(USER_ID);
    expect(row.row.invitee_id).toBeNull();
    expect(row.row.status).toBe('pending');
    expect(typeof row.row.token).toBe('string');
    expect((row.row.token as string).length).toBeGreaterThanOrEqual(24);
    expect(row.row.token).not.toBe(TOKEN);
    expect(row.row.expires_at).toBe(
      new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it('respecte une durée d’expiration explicite', async () => {
    const h = use(harness({ insert: { data: invitationRow({ owner_id: USER_ID }), error: null } }));

    const response = await POST(post({ action: 'create', expiresInDays: 7 }));

    expect(response.status).toBe(201);
    expect(h.calls.inserts[0].row.expires_at).toBe(
      new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it('signale un conflit de jeton unique (409)', async () => {
    use(harness({ insert: { data: null, error: { code: '23505' } } }));

    const response = await POST(post({ action: 'create' }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'conflict' });
  });
});

describe('POST /api/compte/invitations — revoke propriétaire', () => {
  it('révoque une invitation possédée, sans jamais toucher celle d’un tiers', async () => {
    const h = use(
      harness({
        select: { data: invitationRow({ owner_id: USER_ID }), error: null },
        update: { data: invitationRow({ owner_id: USER_ID, status: 'revoked' }), error: null },
      })
    );

    const response = await POST(post({ action: 'revoke', invitationId: INVITATION_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revoked: true });
    expect(h.calls.updates).toEqual([
      { table: 'profile_invitations', patch: { status: 'revoked' } },
    ]);
    expect(h.calls.eqs).toEqual(
      expect.arrayContaining([
        { table: 'profile_invitations', column: 'id', value: INVITATION_ID },
        { table: 'profile_invitations', column: 'owner_id', value: USER_ID },
      ])
    );
  });

  it('renvoie 404 quand l’invitation n’appartient pas au propriétaire', async () => {
    const h = use(harness({ select: { data: null, error: null } }));

    const response = await POST(post({ action: 'revoke', invitationId: INVITATION_ID }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
    expect(h.calls.updates).toEqual([]);
  });

  it('reste idempotent sur une invitation déjà révoquée', async () => {
    const h = use(
      harness({
        select: { data: invitationRow({ owner_id: USER_ID, status: 'revoked' }), error: null },
      })
    );

    const response = await POST(post({ action: 'revoke', invitationId: INVITATION_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revoked: true });
    expect(h.calls.updates).toEqual([]);
  });

  it('permet de retirer un accès déjà accepté', async () => {
    const h = use(
      harness({
        select: {
          data: invitationRow({ owner_id: USER_ID, status: 'accepted', invitee_id: OTHER_ID }),
          error: null,
        },
        update: {
          data: invitationRow({ owner_id: USER_ID, status: 'revoked', invitee_id: OTHER_ID }),
          error: null,
        },
      })
    );

    const response = await POST(post({ action: 'revoke', invitationId: INVITATION_ID }));

    expect(response.status).toBe(200);
    expect(h.calls.updates[0].patch).toEqual({ status: 'revoked' });
  });

  it('traduit un refus RLS en 403', async () => {
    use(harness({ select: { data: null, error: { code: '42501' } } }));

    const response = await POST(post({ action: 'revoke', invitationId: INVITATION_ID }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });

  it('renvoie 404 quand la ligne a disparu avant l’update (PGRST116)', async () => {
    use(
      harness({
        select: { data: invitationRow({ owner_id: USER_ID }), error: null },
        update: { data: null, error: { code: 'PGRST116' } },
      })
    );

    const response = await POST(post({ action: 'revoke', invitationId: INVITATION_ID }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });
});

describe('GET /api/compte/invitations — liste propriétaire', () => {
  it('refuse sans session (401) sans toucher la base', async () => {
    const h = use(harness({ user: null }));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthenticated' });
    expect(h.calls.tables).toEqual([]);
  });

  it('liste les invitations du propriétaire, les plus récentes d’abord', async () => {
    const h = use(
      harness({
        list: {
          data: [
            invitationRow({ owner_id: USER_ID, token: 'jeton-recent-0123456789' }),
            invitationRow({
              owner_id: USER_ID,
              status: 'revoked',
              token: 'jeton-ancien-0123456789',
            }),
          ],
          error: null,
        },
      })
    );

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invitations).toHaveLength(2);
    expect(body.invitations[0].owner_id).toBe(USER_ID);
    expect(h.calls.tables).toEqual(['profile_invitations']);
    expect(h.calls.eqs).toContainEqual({
      table: 'profile_invitations',
      column: 'owner_id',
      value: USER_ID,
    });
    expect(h.calls.orders).toContainEqual({
      table: 'profile_invitations',
      column: 'created_at',
      ascending: false,
    });
    expect(h.calls.limits).toContainEqual({ table: 'profile_invitations', count: 100 });
  });

  it('renvoie une liste vide honnête', async () => {
    use(harness({ list: { data: [], error: null } }));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ invitations: [] });
  });

  it('traduit un refus RLS en 403 et une panne en 500', async () => {
    use(harness({ list: { data: null, error: { code: '42501' } } }));
    expect((await GET()).status).toBe(403);

    use(harness({ list: { data: null, error: { code: 'XX000' } } }));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'server_error' });
  });
});

describe('POST /api/compte/invitations — accept invité (RPC SECURITY DEFINER)', () => {
  it('accepte une invitation pending et renvoie already=false', async () => {
    const h = use(
      harness({
        rpc: { data: { ok: true, already: false, owner_id: OTHER_ID }, error: null },
      })
    );

    const response = await POST(post({ action: 'accept', token: TOKEN }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accepted: true,
      already: false,
      owner_id: OTHER_ID,
    });
    // L'acceptation passe uniquement par la fonction, jamais par un update
    // direct d'une ligne en attente (invisible pour l'invité sous RLS).
    expect(h.calls.rpcs).toEqual([{ fn: 'accept_profile_invitation', args: { p_token: TOKEN } }]);
    expect(h.calls.updates).toEqual([]);
    expect(h.calls.inserts).toEqual([]);
  });

  it('reste idempotent quand l’invité a déjà accepté (already=true, 200)', async () => {
    const h = use(
      harness({
        rpc: { data: { ok: true, already: true, owner_id: OTHER_ID }, error: null },
      })
    );

    const response = await POST(post({ action: 'accept', token: TOKEN }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accepted: true,
      already: true,
      owner_id: OTHER_ID,
    });
    expect(h.calls.rpcs).toHaveLength(1);
    expect(h.calls.updates).toEqual([]);
  });

  it('traduit unauthenticated du RPC en 401', async () => {
    use(
      harness({
        rpc: { data: null, error: { message: 'unauthenticated', code: '42501' } },
      })
    );

    const response = await POST(post({ action: 'accept', token: TOKEN }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthenticated' });
  });

  it('traduit invitation_not_found en 404', async () => {
    use(
      harness({
        rpc: { data: null, error: { message: 'invitation_not_found', code: 'P0002' } },
      })
    );

    const response = await POST(post({ action: 'accept', token: TOKEN }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('traduit invitation_reserved en 403', async () => {
    use(
      harness({
        rpc: { data: null, error: { message: 'invitation_reserved', code: '42501' } },
      })
    );

    const response = await POST(post({ action: 'accept', token: TOKEN }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });

  it.each(['invitation_not_pending', 'invitation_expired'])(
    'traduit %s en 409',
    async (message) => {
      use(harness({ rpc: { data: null, error: { message, code: '55000' } } }));

      const response = await POST(post({ action: 'accept', token: TOKEN }));

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'invalid_state' });
    }
  );

  it('traduit toute autre erreur RPC en 500, même avec un code RLS', async () => {
    use(
      harness({
        rpc: { data: null, error: { message: 'rls_denied', code: '42501' } },
      })
    );

    const response = await POST(post({ action: 'accept', token: TOKEN }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'server_error' });
  });

  it('refuse un payload RPC inexploitable (500)', async () => {
    use(harness({ rpc: { data: { ok: false }, error: null } }));

    const response = await POST(post({ action: 'accept', token: TOKEN }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'server_error' });
  });

  it('refuse un jeton absent sans appeler le RPC (400)', async () => {
    const h = use(harness());

    const response = await POST(post({ action: 'accept' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_body' });
    expect(h.calls.rpcs).toEqual([]);
  });
});

describe('POST /api/compte/invitations — sécurité du client', () => {
  it('accepte par RPC, sans update direct d’une ligne en attente', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/compte/invitations/route.ts'),
      'utf8'
    );
    expect(source).toContain(".rpc('accept_profile_invitation'");
    expect(source).not.toContain("update({ status: 'accepted'");
    expect(source).not.toContain("status: 'accepted', invitee_id");
  });

  it('reste sur le client RLS, sans clé service', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/compte/invitations/route.ts'),
      'utf8'
    );
    expect(source).toContain('@/lib/supabase/server');
    expect(source).toContain('createClient');
    expect(source).not.toContain('SERVICE_ROLE');
    expect(source).not.toContain('service_role');
    expect(source).not.toContain('createAdminClient');
  });
});
