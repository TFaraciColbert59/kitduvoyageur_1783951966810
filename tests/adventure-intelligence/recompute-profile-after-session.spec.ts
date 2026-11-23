import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileBuildClient } from '@/features/adventure-intelligence/server/buildUserProfile';
import {
  profileIsUpToDate,
  recomputeProfileAfterSession,
  supabaseProfileBuildClient,
} from '@/features/adventure-intelligence/server/recomputeProfileAfterSession';

/** 10.8 — le profil suit les sorties terminées : consentement, idempotence, coût borné, non bloquant. */
const OBS = (i: number) => ({
  observed_at: `2026-11-${String(10 + i).padStart(2, '0')}T09:00:00Z`,
  distance_m: '4000', duration_s: 3000, moving_s: 2800, gain_m: '200', loss_m: '150', mean_grade_pct: '5',
  surface: 'dirt', pack_weight_kg: '8', quality: '0.9', declared_fatigue: null, perceived_difficulty: null,
});

function buildClient(n: number) {
  const calls = { upserts: 0, versions: 0, reads: 0 };
  const client: ProfileBuildClient = {
    getObservations: vi.fn(async () => {
      calls.reads += 1;
      return Array.from({ length: n }, (_, i) => ({ observedAt: OBS(i).observed_at, distanceM: 4000, durationS: 3000, movingS: 2800, gainM: 200, lossM: 150, meanGradePct: 5, surface: 'dirt', packWeightKg: 8, quality: 0.9 }));
    }),
    upsertProfile: vi.fn(async () => { calls.upserts += 1; return { id: 'p1' }; }),
    upsertProfileVersion: vi.fn(async () => { calls.versions += 1; }),
  };
  return { client, calls };
}
const consent = (granted: boolean | 'throws') => ({
  hasActiveConsent: vi.fn(async () => {
    if (granted === 'throws') throw new Error('rpc');
    return granted;
  }),
});

describe('recomputeProfileAfterSession (10.8)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));

  it('reconstruit le profil de la personne après une sortie traitée', async () => {
    const { client, calls } = buildClient(6);
    const status = await recomputeProfileAfterSession('u1', { consent: consent(true), build: client, upToDate: async () => false });
    expect(['rebuilt', 'cold']).toContain(status);
    expect(calls).toMatchObject({ upserts: 1, versions: 1, reads: 1 });
  });

  it('sans consentement (ou consentement illisible) : aucune lecture ni écriture', async () => {
    for (const granted of [false, 'throws'] as const) {
      const { client, calls } = buildClient(6);
      expect(await recomputeProfileAfterSession('u1', { consent: consent(granted), build: client, upToDate: async () => false })).toBe('skipped_no_consent');
      expect(calls).toEqual({ upserts: 0, versions: 0, reads: 0 });
    }
  });

  it('idempotent et borné : profil déjà à jour = rien ; une personne = une reconstruction par exécution', async () => {
    const a = buildClient(6);
    expect(await recomputeProfileAfterSession('u1', { consent: consent(true), build: a.client, upToDate: async () => true })).toBe('up_to_date');
    expect(a.calls.reads).toBe(0);
    const done = new Set<string>();
    const b = buildClient(6);
    const deps = { consent: consent(true), build: b.client, upToDate: async () => false, done };
    await recomputeProfileAfterSession('u1', deps);
    expect(await recomputeProfileAfterSession('u1', deps)).toBe('up_to_date');
    expect(b.calls.upserts).toBe(1);
  });

  it('une erreur de lecture ou d’écriture est rendue en statut, jamais levée', async () => {
    const { client } = buildClient(6);
    client.upsertProfile = vi.fn(async () => { throw new Error('db'); });
    expect(await recomputeProfileAfterSession('u1', { consent: consent(true), build: client, upToDate: async () => false })).toBe('error');
  });
});

/** Faux client Supabase minimal, par table. */
function fakeSupabase(tables: Record<string, { rows?: unknown[]; single?: unknown; error?: string }>, log: Array<{ table: string; op: string; arg?: unknown; opts?: unknown }> = []) {
  const from = (table: string) => {
    const cfg = tables[table] ?? {};
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order']) b[m] = () => b;
    b.limit = (n: number) => { log.push({ table, op: 'limit', arg: n }); return Object.assign(Promise.resolve({ data: cfg.rows ?? [], error: cfg.error ? { message: cfg.error } : null }), b); };
    b.maybeSingle = async () => ({ data: cfg.single ?? null, error: null });
    b.single = async () => ({ data: cfg.single ?? null, error: cfg.error ? { message: cfg.error } : null });
    b.upsert = (arg: unknown, opts: unknown) => { log.push({ table, op: 'upsert', arg, opts }); return Object.assign(Promise.resolve({ error: cfg.error ? { message: cfg.error } : null }), b); };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

describe('adaptateur Supabase du profil (10.8)', () => {
  it('lit au plus 500 observations privées de la personne et les convertit', async () => {
    const log: Array<{ table: string; op: string; arg?: unknown }> = [];
    const c = supabaseProfileBuildClient(fakeSupabase({ performance_observations: { rows: [OBS(1)] } }, log));
    const obs = await c.getObservations('u1', 10_000);
    expect(log.find((l) => l.op === 'limit')?.arg).toBe(500);
    expect(obs[0]).toMatchObject({ distanceM: 4000, durationS: 3000, gainM: 200, quality: 0.9, surface: 'dirt' });
  });

  it('écrit le profil et sa version par upsert sur leur clé d’unicité (idempotent)', async () => {
    const log: Array<{ table: string; op: string; opts?: unknown }> = [];
    const c = supabaseProfileBuildClient(fakeSupabase({ user_performance_profiles: { single: { id: 'p9' } }, user_performance_profile_versions: {} }, log));
    expect(await c.upsertProfile({ user_id: 'u1' })).toEqual({ id: 'p9' });
    await c.upsertProfileVersion({ profile_id: 'p9', model_version: 'a3-v1' });
    expect(log.filter((l) => l.op === 'upsert').map((l) => l.opts)).toEqual([{ onConflict: 'user_id,activity_type' }, { onConflict: 'profile_id,model_version' }]);
  });

  it('profileIsUpToDate : sans observation ou profil plus récent = à jour ; observation plus récente = à recalculer', async () => {
    const mk = (obsAt: string | null, profAt: string | null) =>
      fakeSupabase({}, []) && ({
        from: (t: string) => {
          const b: Record<string, unknown> = {};
          for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b;
          b.maybeSingle = async () => ({ data: t === 'performance_observations' ? (obsAt ? { created_at: obsAt } : null) : profAt ? { computed_at: profAt } : null });
          return b;
        },
      } as unknown as SupabaseClient);
    expect(await profileIsUpToDate(mk(null, null), 'u1')).toBe(true);
    expect(await profileIsUpToDate(mk('2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z'), 'u1')).toBe(true);
    expect(await profileIsUpToDate(mk('2026-11-21T10:00:00Z', '2026-11-20T11:00:00Z'), 'u1')).toBe(false);
    expect(await profileIsUpToDate(mk('2026-11-21T10:00:00Z', null), 'u1')).toBe(false);
  });
});
