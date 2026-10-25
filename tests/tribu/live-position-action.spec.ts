/**
 * Phase 7 TRIBU — actions du partage de position live.
 *
 *   (a) démarrage : bornes de durée, refus si session déjà ouverte, fermeture
 *       préalable des sessions expirées ;
 *   (b) partage : refus session fermée/expirée, upsert avec TTL 15 min ;
 *   (c) arrêt du partage : suppression self uniquement ;
 *   (d) clôture de session ;
 *   (e) état live : session + mon partage + positions nommées ;
 *   (f) session absente → refus partout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import {
  startLiveSession,
  stopLiveSession,
  sharePosition,
  stopSharingPosition,
  getLiveState,
} from '@/features/tribu/actions/livePosition';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const GROUP = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';

interface MockOptions {
  user?: { id: string } | null;
  activeSession?: { id: string } | null;
  createdSession?: Record<string, unknown>;
  sessionRow?: Record<string, unknown> | null;
  sessionError?: { message: string } | null;
  zeroRowUpdate?: boolean;
  positions?: Array<Record<string, unknown>>;
  profiles?: Array<Record<string, unknown>>;
  writeError?: { message: string } | null;
}

function createSession(options: MockOptions) {
  const calls: Array<{ table: string; op: string; payload?: unknown; args?: unknown }> = [];

  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {};
    let mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
    builder.select = () => builder;
    builder.eq = (column: string, value: unknown) => {
      calls.push({ table, op: 'eq', args: [column, value] });
      return builder;
    };
    builder.is = (column: string, value: unknown) => {
      calls.push({ table, op: 'is', args: [column, value] });
      return builder;
    };
    builder.gt = (column: string, value: unknown) => {
      calls.push({ table, op: 'gt', args: [column, value] });
      return builder;
    };
    builder.lt = (column: string, value: unknown) => {
      calls.push({ table, op: 'lt', args: [column, value] });
      return builder;
    };
    builder.order = () => builder;
    builder.limit = () => builder;
    builder.in = (column: string, values: unknown) => {
      calls.push({ table, op: 'in', args: [column, values] });
      return builder;
    };
    builder.maybeSingle = async () => {
      if (table === 'group_live_sessions' && options.sessionError && mode === 'select') {
        const hasGt = calls.some(
          (c) => c.table === 'group_live_sessions' && c.op === 'gt'
        );
        if (hasGt || options.sessionRow !== undefined) {
          return { data: null, error: options.sessionError };
        }
      }
      if (table === 'group_live_sessions' && options.sessionRow !== undefined && mode === 'select') {
        return { data: options.sessionRow, error: null };
      }
      if (table === 'group_live_sessions' && calls.some((c) => c.op === 'gt')) {
        return { data: options.activeSession ?? null, error: null };
      }
      return { data: options.sessionRow ?? null, error: null };
    };
    builder.single = async () => ({
      data: options.createdSession ?? { id: SESSION, started_by: ME, started_at: 'a', expires_at: 'b' },
      error: options.writeError ?? null,
    });
    builder.update = (payload: unknown) => {
      mode = 'update';
      calls.push({ table, op: 'update', payload });
      return builder;
    };
    builder.insert = (payload: unknown) => {
      mode = 'insert';
      calls.push({ table, op: 'insert', payload });
      return builder;
    };
    builder.upsert = (payload: unknown, opts: unknown) => {
      mode = 'upsert';
      calls.push({ table, op: 'upsert', payload, args: opts });
      return Promise.resolve({ error: options.writeError ?? null });
    };
    builder.delete = () => {
      mode = 'delete';
      calls.push({ table, op: 'delete' });
      return builder;
    };
    builder.then = (resolve: (value: unknown) => unknown) => {
      if (mode === 'delete') return resolve({ error: options.writeError ?? null });
      if (table === 'group_live_positions') {
        return resolve({ data: options.positions ?? [], error: null });
      }
      if (table === 'public_profiles') {
        return resolve({ data: options.profiles ?? [], error: null });
      }
      if (mode === 'update') {
        return resolve({
          data: options.zeroRowUpdate ? [] : [{ id: 'updated' }],
          error: options.writeError ?? null,
        });
      }
      return resolve({ data: null, error: null });
    };
    return builder;
  }

  return {
    calls,
    auth: { getUser: async () => ({ data: { user: options.user ?? null } }) },
    from: (table: string) => makeBuilder(table),
  };
}

const mockedCreateClient = vi.mocked(createClient);

describe('livePosition — actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('(a) démarrage : bornes de durée et sortie invalide sans requête', async () => {
    expect(await startLiveSession({ groupId: GROUP, durationHours: 0 })).toEqual({
      ok: false,
      error: 'Durée invalide (1 à 72 h).',
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('(b) démarrage : refuse sans session et si une session est déjà ouverte', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: null }) as never);
    expect(await startLiveSession({ groupId: GROUP, durationHours: 2 })).toEqual({
      ok: false,
      error: 'Connexion requise.',
    });

    const session = createSession({ user: { id: ME }, activeSession: { id: 'open' } });
    mockedCreateClient.mockResolvedValue(session as never);
    const result = await startLiveSession({ groupId: GROUP, durationHours: 2 });
    expect(result).toEqual({
      ok: false,
      error: 'Une sortie live est déjà ouverte pour ce groupe.',
    });
    expect(session.calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('(c) démarrage : ferme les expirées puis crée la session', async () => {
    const session = createSession({
      user: { id: ME },
      activeSession: null,
      createdSession: {
        id: SESSION,
        started_by: ME,
        started_at: '2026-09-13T10:00:00.000Z',
        expires_at: '2026-09-13T12:00:00.000Z',
      },
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const before = Date.now();
    const result = await startLiveSession({ groupId: GROUP, durationHours: 2 });
    const after = Date.now();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.id).toBe(SESSION);

    const closing = session.calls.find(
      (c) => c.table === 'group_live_sessions' && c.op === 'update'
    );
    expect(closing?.payload).toHaveProperty('stopped_at');
    expect(
      session.calls.some(
        (c) => c.table === 'group_live_sessions' && c.op === 'lt' && (c.args as unknown[])[0] === 'expires_at'
      )
    ).toBe(true);

    const insert = session.calls.find((c) => c.table === 'group_live_sessions' && c.op === 'insert');
    const payload = insert?.payload as Record<string, unknown>;
    expect(payload).toMatchObject({ group_id: GROUP, started_by: ME });
    const expires = new Date(payload.expires_at as string).getTime();
    expect(expires).toBeGreaterThanOrEqual(before + 2 * 60 * 60 * 1000 - 5000);
    expect(expires).toBeLessThanOrEqual(after + 2 * 60 * 60 * 1000 + 5000);
  });

  it('(d) partage : refus session fermée, sinon upsert TTL 15 min', async () => {
    mockedCreateClient.mockResolvedValue(
      createSession({
        user: { id: ME },
        sessionRow: { id: SESSION, stopped_at: '2026-09-13T10:00:00.000Z', expires_at: '2099-01-01T00:00:00.000Z' },
      }) as never
    );
    expect(
      await sharePosition({ sessionId: SESSION, lat: 45, lng: 6 })
    ).toEqual({ ok: false, error: 'Sortie live fermée ou expirée.' });

    const session = createSession({
      user: { id: ME },
      sessionRow: { id: SESSION, stopped_at: null, expires_at: '2099-01-01T00:00:00.000Z' },
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const before = Date.now();
    const result = await sharePosition({ sessionId: SESSION, lat: 45.1, lng: 6.1, accuracyM: 12 });
    const after = Date.now();

    expect(result).toEqual({ ok: true });
    const upsert = session.calls.find((c) => c.op === 'upsert');
    const payload = upsert?.payload as Record<string, unknown>;
    expect(payload).toMatchObject({ session_id: SESSION, user_id: ME, lat: 45.1, lng: 6.1 });
    const expires = new Date(payload.expires_at as string).getTime();
    expect(expires).toBeGreaterThanOrEqual(before + 14 * 60 * 1000);
    expect(expires).toBeLessThanOrEqual(after + 16 * 60 * 1000);
  });

  it('(e) arrêt du partage : delete self uniquement', async () => {
    const session = createSession({ user: { id: ME } });
    mockedCreateClient.mockResolvedValue(session as never);

    expect(await stopSharingPosition({ sessionId: SESSION })).toEqual({ ok: true });
    expect(
      session.calls.some(
        (c) =>
          c.table === 'group_live_positions' &&
          c.op === 'eq' &&
          (c.args as unknown[])[0] === 'user_id' &&
          (c.args as unknown[])[1] === ME
      )
    ).toBe(true);
    expect(session.calls.some((c) => c.op === 'delete')).toBe(true);
  });

  it('(f) clôture : update stopped_at', async () => {
    const session = createSession({ user: { id: ME } });
    mockedCreateClient.mockResolvedValue(session as never);

    expect(await stopLiveSession({ sessionId: SESSION })).toEqual({ ok: true });
    const update = session.calls.find(
      (c) => c.table === 'group_live_sessions' && c.op === 'update'
    );
    expect(update?.payload).toHaveProperty('stopped_at');
  });

  it('(g) état live : session + mon partage + positions nommées', async () => {
    const session = createSession({
      user: { id: ME },
      sessionRow: {
        id: SESSION,
        started_by: OTHER,
        started_at: '2026-09-13T10:00:00.000Z',
        expires_at: '2099-01-01T00:00:00.000Z',
      },
      positions: [
        { user_id: ME, lat: 45.1, lng: 6.1, updated_at: '2026-09-13T10:05:00.000Z' },
        { user_id: OTHER, lat: 45.2, lng: 6.2, updated_at: '2026-09-13T10:04:00.000Z' },
      ],
      profiles: [
        { id: ME, full_name: 'Moi', avatar_url: null },
        { id: OTHER, full_name: 'Bruno', avatar_url: null },
      ],
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const result = await getLiveState(GROUP);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session?.id).toBe(SESSION);
    expect(result.mySharing).toBe(true);
    expect(result.positions).toHaveLength(2);
    expect(result.positions.find((p) => p.userId === OTHER)?.name).toBe('Bruno');
  });

  it('(h) état live sans session : null propre', async () => {
    mockedCreateClient.mockResolvedValue(
      createSession({
        user: { id: ME },
        sessionRow: null,
        // le mock renvoie null via maybeSingle
      }) as never
    );

    const result = await getLiveState(GROUP);
    expect(result).toEqual({ ok: true, session: null, mySharing: false, positions: [] });
  });

  it('(i) état live : une erreur DB n’est jamais convertie en absence de données', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedCreateClient.mockResolvedValue(
      createSession({
        user: { id: ME },
        sessionError: { message: 'boom' },
      }) as never
    );

    const result = await getLiveState(GROUP);
    expect(result).toEqual({
      ok: false,
      error: 'Impossible de charger l’état live pour le moment.',
    });
    consoleSpy.mockRestore();
  });

  it('(j) clôture : 0 ligne modifiée = échec explicite, pas un faux succès', async () => {
    mockedCreateClient.mockResolvedValue(
      createSession({ user: { id: ME }, zeroRowUpdate: true }) as never
    );

    const result = await stopLiveSession({ sessionId: SESSION });
    expect(result).toEqual({
      ok: false,
      error: 'Session déjà fermée ou droits insuffisants pour la clôturer.',
    });
  });
});
