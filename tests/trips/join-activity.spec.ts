/**
 * Task 17 — `joinActivity` : consentement, snapshot de profil et recalcul.
 *
 * Couverture :
 *   (a) anonyme → `auth`, aucune écriture ;
 *   (b) slug inconnu → `not_found` ;
 *   (c) lien valide → collaborateur `editor` + participant `member/confirmed`
 *       + snapshot appris (consentement actif) + sync crew + recompute ;
 *   (d) privé sans token → `not_found` ; privé + token → jonction ;
 *   (e) déjà membre → `already_member`, aucune écriture ;
 *   (f) consentement UI vrai sans `personal_performance` actif → snapshot
 *       estimé (orientation), jamais le profil appris ;
 *   (g) sans consentement → snapshot moyennes, `consented_at` null.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { serviceHolder } = vi.hoisted(() => ({ serviceHolder: { client: {} as unknown } }));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceHolder.client),
}));

vi.mock('@/features/hub/server/syncTripCrew', () => ({
  syncTripCollaboratorsToCrew: vi.fn(async () => undefined),
}));

vi.mock('@/features/trips/server/recomputeParty', () => ({
  recomputeParty: vi.fn(async () => ({ partySize: 2, version: 1, warnings: [] })),
}));

import { joinActivity } from '@/features/trips/server/joinActivity';
import { syncTripCollaboratorsToCrew } from '@/features/hub/server/syncTripCrew';
import { recomputeParty } from '@/features/trips/server/recomputeParty';

const TRIP_ID = '17171717-1717-4717-8717-171717171717';
const OWNER_ID = '17171717-1717-4717-8717-000000000001';
const JOINER_ID = '17171717-1717-4717-8717-000000000002';
const SHARE_TOKEN = 'share-token-1717';

interface JoinDb {
  trips: Record<string, unknown>[];
  trip_collaborators: Record<string, unknown>[];
  user_orientation: Record<string, unknown>[];
  user_performance_profiles: Record<string, unknown>[];
  rpcConsent: boolean;
  rpcs: { name: string; params: unknown }[];
  upserts: { table: string; values: Record<string, unknown>; options?: unknown }[];
}

function createDb(overrides: Partial<JoinDb> = {}): JoinDb {
  return {
    trips: [
      {
        id: TRIP_ID,
        user_id: OWNER_ID,
        slug: 'trek-partage',
        share_token: SHARE_TOKEN,
        visibility: 'private',
      },
    ],
    trip_collaborators: [],
    user_orientation: [],
    user_performance_profiles: [],
    rpcConsent: false,
    rpcs: [],
    upserts: [],
    ...overrides,
  };
}

function filterRows(rows: Record<string, unknown>[], filters: [string, unknown][]) {
  return rows.filter((row) => filters.every(([column, value]) => row[column] === value));
}

function createClient(db: JoinDb): unknown {
  return {
    from(table: keyof JoinDb) {
      const filters: [string, unknown][] = [];
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      };
      builder.maybeSingle = () =>
        Promise.resolve({ data: filterRows(db[table] as never, filters)[0] ?? null, error: null });
      builder.upsert = (values: Record<string, unknown>, options?: unknown) => {
        db.upserts.push({ table, values, options });
        return Promise.resolve({ data: null, error: null });
      };
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: filterRows(db[table] as never, filters), error: null }).then(
          resolve,
          reject
        );
      return builder;
    },
    rpc(name: string, params: unknown) {
      db.rpcs.push({ name, params });
      return Promise.resolve({ data: db.rpcConsent, error: null });
    },
  };
}

function upsertValues(db: JoinDb, table: string): Record<string, unknown> | undefined {
  return db.upserts.find((entry) => entry.table === table)?.values;
}

const CONSENTED_PROFILE = {
  user_id: JOINER_ID,
  activity_type: 'hiking',
  flat_speed_kmh: 5.4,
  ascent_speed_m_per_h: 430,
  descent_speed_m_per_h: 640,
  calibration_level: 'contextualization',
  sample_count: 24,
};

describe('joinActivity (Task 17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceHolder.client = {};
  });

  it('(a) anonyme → auth, aucune écriture', async () => {
    const db = createDb();
    serviceHolder.client = createClient(db);

    const result = await joinActivity('trek-partage', { consent: true, userId: null });

    expect(result).toEqual({ ok: false, code: 'auth' });
    expect(db.upserts).toHaveLength(0);
    expect(syncTripCollaboratorsToCrew).not.toHaveBeenCalled();
    expect(recomputeParty).not.toHaveBeenCalled();
  });

  it('(b) slug inconnu → not_found', async () => {
    const db = createDb({ trips: [] });
    serviceHolder.client = createClient(db);

    const result = await joinActivity('inconnu', { consent: true, userId: JOINER_ID });

    expect(result).toEqual({ ok: false, code: 'not_found' });
    expect(db.upserts).toHaveLength(0);
  });

  it('(c) lien public valide → membres, snapshot appris, sync et recompute', async () => {
    const db = createDb({
      trips: [{ ...createDb().trips[0], visibility: 'public' }],
      rpcConsent: true,
      user_performance_profiles: [CONSENTED_PROFILE],
      user_orientation: [{ user_id: JOINER_ID, experience: 'aguerri', terrain: 'montagne', autonomy: null }],
    });
    serviceHolder.client = createClient(db);

    const result = await joinActivity('trek-partage', { consent: true, userId: JOINER_ID });

    expect(result).toEqual({ ok: true, tripId: TRIP_ID });

    const collaborator = upsertValues(db, 'trip_collaborators');
    expect(collaborator).toMatchObject({
      trip_id: TRIP_ID,
      user_id: JOINER_ID,
      role: 'editor',
      invited_by: OWNER_ID,
    });
    expect(db.upserts.find((entry) => entry.table === 'trip_collaborators')?.options).toEqual({
      onConflict: 'trip_id,user_id',
      ignoreDuplicates: true,
    });

    const participant = upsertValues(db, 'trip_participants');
    expect(participant).toMatchObject({
      trip_id: TRIP_ID,
      user_id: JOINER_ID,
      role: 'member',
      status: 'confirmed',
    });

    const snapshot = upsertValues(db, 'trip_member_profiles');
    expect(snapshot?.flat_speed_kmh).toBe(5.4);
    expect(snapshot?.ascent_speed_m_per_h).toBe(430);
    expect(snapshot?.descent_speed_m_per_h).toBe(640);
    expect(snapshot?.calibration_level).toBe('contextualization');
    expect(snapshot?.sample_count).toBe(24);
    expect(snapshot?.consented_at).toEqual(expect.any(String));
    const sources = snapshot?.sources as Record<string, string>;
    expect(sources.flatSpeedKmH).toBe('learned');
    expect(sources.experienceLevel).toBe('estimated');
    expect(sources.packWeightKg).toBe('estimated');

    expect(syncTripCollaboratorsToCrew).toHaveBeenCalledWith(TRIP_ID);
    expect(recomputeParty).toHaveBeenCalledWith(TRIP_ID);
  });

  it('(d) privé : token exigé, token valide accepté', async () => {
    const db = createDb();
    serviceHolder.client = createClient(db);

    const denied = await joinActivity('trek-partage', { consent: false, userId: JOINER_ID });
    expect(denied).toEqual({ ok: false, code: 'not_found' });
    expect(db.upserts).toHaveLength(0);

    const allowed = await joinActivity('trek-partage', {
      consent: false,
      token: SHARE_TOKEN,
      userId: JOINER_ID,
    });
    expect(allowed).toEqual({ ok: true, tripId: TRIP_ID });
    expect(upsertValues(db, 'trip_member_profiles')?.flat_speed_kmh).toBe(4);
  });

  it('(e) déjà membre → already_member, aucune écriture', async () => {
    const db = createDb({
      trip_collaborators: [{ trip_id: TRIP_ID, user_id: JOINER_ID, role: 'editor' }],
    });
    serviceHolder.client = createClient(db);

    const result = await joinActivity('trek-partage', {
      consent: true,
      token: SHARE_TOKEN,
      userId: JOINER_ID,
    });

    expect(result).toEqual({ ok: false, code: 'already_member', tripId: TRIP_ID });
    expect(db.upserts).toHaveLength(0);
    expect(recomputeParty).not.toHaveBeenCalled();
  });

  it('(f) consentement UI sans consentement personnel actif → estimé, pas appris', async () => {
    const db = createDb({
      rpcConsent: false,
      user_performance_profiles: [CONSENTED_PROFILE],
      user_orientation: [{ user_id: JOINER_ID, experience: 'regulier', terrain: null, autonomy: null }],
    });
    serviceHolder.client = createClient(db);

    const result = await joinActivity('trek-partage', {
      consent: true,
      token: SHARE_TOKEN,
      userId: JOINER_ID,
    });

    expect(result.ok).toBe(true);
    expect(db.rpcs).toHaveLength(1);
    const snapshot = upsertValues(db, 'trip_member_profiles');
    expect(snapshot?.flat_speed_kmh).toBe(4);
    expect(snapshot?.calibration_level).toBeNull();
    const sources = snapshot?.sources as Record<string, string>;
    expect(sources.flatSpeedKmH).toBe('average');
    expect(sources.experienceLevel).toBe('estimated');
    expect(sources.packWeightKg).toBe('estimated');
    expect(snapshot?.consented_at).toEqual(expect.any(String));
  });

  it('(g) sans consentement → snapshot moyennes, consented_at null, aucun profil lu', async () => {
    const db = createDb({
      user_performance_profiles: [CONSENTED_PROFILE],
      user_orientation: [{ user_id: JOINER_ID, experience: 'aguerri', terrain: null, autonomy: null }],
    });
    serviceHolder.client = createClient(db);

    await joinActivity('trek-partage', { consent: false, token: SHARE_TOKEN, userId: JOINER_ID });

    expect(db.rpcs).toHaveLength(0);
    const snapshot = upsertValues(db, 'trip_member_profiles');
    expect(snapshot?.consented_at).toBeNull();
    const sources = snapshot?.sources as Record<string, string>;
    expect(sources.flatSpeedKmH).toBe('average');
    expect(sources.experienceLevel).toBe('average');
    expect(sources.packWeightKg).toBe('average');
  });
});
