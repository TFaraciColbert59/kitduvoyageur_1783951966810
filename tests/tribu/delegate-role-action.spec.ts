/**
 * Phase 3 TRIBU — actions de delegation temporaire de role.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import {
  createRoleDelegation,
  revokeRoleDelegation,
  listMyDelegations,
} from '@/features/tribu/actions/delegateRole';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const GROUP = '33333333-3333-4333-8333-333333333333';
const DELEGATION = '44444444-4444-4444-8444-444444444444';

interface MockOptions {
  user?: { id: string } | null;
  insertError?: { message: string } | null;
  deleteError?: { message: string } | null;
  listRows?: Array<Record<string, string>>;
  listError?: { message: string } | null;
}

function createSession(options: MockOptions) {
  const calls: Array<{ op: string; payload?: unknown; args?: unknown }> = [];
  function makeBuilder() {
    let mode: 'insert' | 'delete' | 'list' = 'list';
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.gt = (column: string, value: unknown) => {
      calls.push({ op: 'gt', args: [column, value] });
      return builder;
    };
    builder.or = (expression: string) => {
      calls.push({ op: 'or', args: [expression] });
      return builder;
    };
    builder.insert = (payload: unknown) => {
      mode = 'insert';
      calls.push({ op: 'insert', payload });
      return builder;
    };
    builder.delete = () => {
      mode = 'delete';
      calls.push({ op: 'delete' });
      return builder;
    };
    builder.then = (resolve: (value: unknown) => unknown) => {
      if (mode === 'insert') return resolve({ data: null, error: options.insertError ?? null });
      if (mode === 'delete') return resolve({ data: null, error: options.deleteError ?? null });
      return resolve({ data: options.listRows ?? [], error: options.listError ?? null });
    };
    return builder;
  }
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: options.user ?? null } }) },
    from: () => makeBuilder(),
  };
}

const mockedCreateClient = vi.mocked(createClient);

describe('delegateRole — actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('(a) refuse une entrée invalide sans requête', async () => {
    const badId = await createRoleDelegation({
      groupId: 'nope',
      toUserId: OTHER,
      delegatedRole: 'organizer',
      durationHours: 24,
    });
    expect(badId.ok).toBe(false);

    const badDuration = await createRoleDelegation({
      groupId: GROUP,
      toUserId: OTHER,
      delegatedRole: 'organizer',
      durationHours: 0,
    });
    expect(badDuration).toEqual({ ok: false, error: 'Données de délégation invalides.' });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('(b) refuse sans session ou en auto-délégation', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: null }) as never);
    expect(
      await createRoleDelegation({
        groupId: GROUP,
        toUserId: OTHER,
        delegatedRole: 'organizer',
        durationHours: 24,
      })
    ).toEqual({ ok: false, error: 'Connexion requise.' });

    mockedCreateClient.mockResolvedValue(createSession({ user: { id: ME } }) as never);
    expect(
      await createRoleDelegation({
        groupId: GROUP,
        toUserId: ME,
        delegatedRole: 'organizer',
        durationHours: 24,
      })
    ).toEqual({ ok: false, error: 'Choisissez un autre membre.' });
  });

  it('(c) crée une délégation à fenêtre bornée', async () => {
    const session = createSession({ user: { id: ME } });
    mockedCreateClient.mockResolvedValue(session as never);

    const before = Date.now();
    const result = await createRoleDelegation({
      groupId: GROUP,
      toUserId: OTHER,
      delegatedRole: 'organizer',
      durationHours: 24,
    });
    const after = Date.now();

    expect(result).toEqual({ ok: true });
    const insert = session.calls.find((c) => c.op === 'insert');
    const payload = insert?.payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      group_id: GROUP,
      from_user_id: ME,
      to_user_id: OTHER,
      delegated_role: 'organizer',
    });
    const endsAt = new Date(payload.ends_at as string).getTime();
    expect(endsAt).toBeGreaterThanOrEqual(before + 23 * 60 * 60 * 1000);
    expect(endsAt).toBeLessThanOrEqual(after + 25 * 60 * 60 * 1000);
  });

  it('(d) révoque une délégation existante', async () => {
    const session = createSession({ user: { id: ME } });
    mockedCreateClient.mockResolvedValue(session as never);

    expect(await revokeRoleDelegation(DELEGATION)).toEqual({ ok: true });
    expect(session.calls.some((c) => c.op === 'delete')).toBe(true);
  });

  it('(e) liste mes délégations actives (mappées)', async () => {
    const session = createSession({
      user: { id: ME },
      listRows: [
        {
          id: DELEGATION,
          from_user_id: ME,
          to_user_id: OTHER,
          delegated_role: 'organizer',
          ends_at: '2026-09-14T12:00:00.000Z',
        },
      ],
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const result = await listMyDelegations(GROUP);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.delegations).toEqual([
      {
        id: DELEGATION,
        fromUserId: ME,
        toUserId: OTHER,
        delegatedRole: 'organizer',
        endsAt: '2026-09-14T12:00:00.000Z',
      },
    ]);
    expect(session.calls.some((c) => c.op === 'gt' && (c.args as unknown[])[0] === 'ends_at')).toBe(true);
    expect(session.calls.some((c) => c.op === 'or')).toBe(true);
  });
});
