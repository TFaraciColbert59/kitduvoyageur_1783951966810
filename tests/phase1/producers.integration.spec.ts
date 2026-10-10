import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  awardHikeSessionProcessed,
  awardTrailPrepared,
  awardKitFieldReport,
  awardPlaceReview,
  awardCarnetPublished,
  awardChecklistCompleted,
  awardTripCompleted,
} from '@/features/progression/server/producerHooks';

/**
 * Incrément 3 — intégration RÉELLE des 7 producteurs d'aventure.
 *
 * Chaque cas écrit des faits en base locale (service_role), appelle le hook
 * (sans mock du moteur ni de la DB) puis vérifie la chaîne canonique :
 * décision → ledger (`reward_transactions`) → outbox → projection.
 *
 * Env-gated : `PHASE1_PRODUCERS_E2E=1` + stack Supabase locale + clé service.
 * Sans env, la suite est entièrement SKIP (CI standard).
 */

const E2E = process.env.PHASE1_PRODUCERS_E2E === '1';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function assertLocalEnv(): void {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) {
    throw new Error('[phase1-producers] NEXT_PUBLIC_SUPABASE_URL requis (stack locale)');
  }
  let hostname = '';
  try {
    hostname = new URL(rawUrl).hostname;
  } catch {
    hostname = '';
  }
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`[phase1-producers] URL Supabase non locale refusée : ${rawUrl}`);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('[phase1-producers] SUPABASE_SERVICE_ROLE_KEY requis (stack locale)');
  }
}

type ServiceClient = NonNullable<ReturnType<typeof getServiceSupabase>>;

let svc: ServiceClient;

interface ActionRule {
  points?: number;
  max_points?: number;
}
let rulesActions: Record<string, ActionRule> = {};

function rulePoints(action: string): number {
  const points = rulesActions[action]?.points;
  if (typeof points !== 'number') {
    throw new Error(`Barème actif sans points pour ${action}`);
  }
  return points;
}

function expectedPoints(action: string, bonus = 0): number {
  const base = rulePoints(action);
  const max = typeof rulesActions[action]?.max_points === 'number'
    ? (rulesActions[action]?.max_points as number)
    : base;
  return Math.min(base + bonus, Math.max(max, base));
}

interface TrackedFixtures {
  users: string[];
  segments: number[];
  sessions: string[];
  passages: string[];
  kits: string[];
  reports: string[];
  trips: string[];
  checklist: string[];
  pois: string[];
  carnets: string[];
  moments: string[];
}

const F: TrackedFixtures = {
  users: [],
  segments: [],
  sessions: [],
  passages: [],
  kits: [],
  reports: [],
  trips: [],
  checklist: [],
  pois: [],
  carnets: [],
  moments: [],
};

const RUN = `${Date.now()}`;
let userA = '';
let userB = '';

async function createUser(tag: string): Promise<string> {
  const { data, error } = await svc.auth.admin.createUser({
    email: `integ-prod-${RUN}-${tag}@lkdv.test`,
    password: 'IntegProd!2026',
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser ${tag}: ${error?.message}`);
  F.users.push(data.user.id);
  return data.user.id;
}

let segmentBase = 0;

async function createSegments(count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = segmentBase + i;
    const { error } = await svc.from('trail_segments').insert({
      id,
      osm_id: id,
      name: `phase1-e2e-${RUN}-${i}`,
      highway: 'path',
      geom: `SRID=4326;LINESTRING(6.0${i} 45.0, 6.0${i + 1} 45.001)`,
    });
    if (error) throw new Error(`trail_segments: ${error.message}`);
    F.segments.push(id);
    ids.push(id);
  }
  return ids;
}

async function createSession(userId: string, status: 'processed' | 'pending'): Promise<string> {
  const { data, error } = await svc
    .from('hike_sessions')
    .insert({
      user_id: userId,
      started_at: new Date(Date.now() - 3_600_000).toISOString(),
      ended_at: new Date().toISOString(),
      distance_km: 8,
      duration_seconds: 3600,
      processing_status: status,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`hike_sessions: ${error?.message}`);
  F.sessions.push(data.id);
  return data.id;
}

async function createPassage(
  sessionId: string,
  userId: string,
  segmentId: number,
  index: number
): Promise<void> {
  const { data, error } = await svc
    .from('session_segment_passages')
    .insert({
      session_id: sessionId,
      user_id: userId,
      segment_id: segmentId,
      direction: 'forward',
      entered_at: new Date(Date.now() - 3_600_000 + index).toISOString(),
      exited_at: new Date(Date.now() - 3_600_000 + index + 300).toISOString(),
      duration_s: 300,
      distance_m: 400,
      processor_version: 'phase1-e2e-v1',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`session_segment_passages: ${error?.message}`);
  F.passages.push(data.id);
}

async function createKit(userId: string): Promise<string> {
  const { data, error } = await svc
    .from('materiel_kits')
    .insert({ user_id: userId, name: `Kit E2E ${RUN}` })
    .select('id')
    .single();
  if (error || !data) throw new Error(`materiel_kits: ${error?.message}`);
  F.kits.push(data.id);
  return data.id;
}

async function createKitReport(sessionId: string, userId: string): Promise<void> {
  const kitId = await createKit(userId);
  const { data, error } = await svc
    .from('kit_field_reports')
    .insert({
      kit_id: kitId,
      hike_session_id: sessionId,
      user_id: userId,
      item_key: 'sac-40l',
      verdict: 'utile',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`kit_field_reports: ${error?.message}`);
  F.reports.push(data.id);
}

async function createTrip(userId: string, status: 'planned' | 'completed'): Promise<string> {
  const suffix = `${RUN}-${F.trips.length}`;
  const { data, error } = await svc
    .from('trips')
    .insert({
      slug: `phase1-e2e-${suffix}`,
      title: `Phase1 E2E ${suffix}`,
      user_id: userId,
      status,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`trips: ${error?.message}`);
  F.trips.push(data.id);
  return data.id;
}

async function createChecklistItem(tripId: string, done: boolean): Promise<void> {
  const { data, error } = await svc
    .from('trip_checklist_items')
    .insert({
      trip_id: tripId,
      label: `item-${F.checklist.length}`,
      done,
      done_at: done ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`trip_checklist_items: ${error?.message}`);
  F.checklist.push(data.id);
}

/** Le trigger `trips` seede une checklist par défaut : on la renvoie telle quelle. */
async function listChecklistItems(tripId: string): Promise<Array<{ id: string; done: boolean }>> {
  const { data, error } = await svc
    .from('trip_checklist_items')
    .select('id, done')
    .eq('trip_id', tripId);
  if (error) throw new Error(`trip_checklist_items(select): ${error.message}`);
  return (data ?? []) as Array<{ id: string; done: boolean }>;
}

async function markAllChecklistDone(tripId: string): Promise<number> {
  const items = await listChecklistItems(tripId);
  for (const item of items) {
    const { error } = await svc
      .from('trip_checklist_items')
      .update({ done: true, done_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) throw new Error(`trip_checklist_items(update): ${error.message}`);
  }
  return items.length;
}

async function deleteAllChecklistItems(tripId: string): Promise<void> {
  const { error } = await svc.from('trip_checklist_items').delete().eq('trip_id', tripId);
  if (error) throw new Error(`trip_checklist_items(delete): ${error.message}`);
}

async function createPoi(tripId: string, visited: boolean): Promise<void> {
  const { data, error } = await svc
    .from('trip_pois')
    .insert({ trip_id: tripId, name: `poi-${F.pois.length}`, visited })
    .select('id')
    .single();
  if (error || !data) throw new Error(`trip_pois: ${error?.message}`);
  F.pois.push(data.id);
}

async function createCarnet(
  userId: string,
  options: { visibility: string; tripId?: string | null }
): Promise<string> {
  const { data, error } = await svc
    .from('carnets')
    .insert({
      author_id: userId,
      title: `Carnet E2E ${RUN}-${F.carnets.length}`,
      visibility: options.visibility,
      trip_id: options.tripId ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`carnets: ${error?.message}`);
  F.carnets.push(data.id);
  return data.id;
}

async function createMoment(carnetId: string): Promise<void> {
  const { data, error } = await svc
    .from('carnet_moments')
    .insert({ carnet_id: carnetId, citation: `moment-${F.moments.length}` })
    .select('id')
    .single();
  if (error || !data) throw new Error(`carnet_moments: ${error?.message}`);
  F.moments.push(data.id);
}

interface AwardResult {
  success: boolean;
  outcome: string;
  reason?: string | null;
  points?: number;
  rewardTransactionId?: string | null;
}

interface TransactionRow {
  id: string;
  user_id: string;
  points: number;
  transaction_type: string;
  counts_for_progression: boolean;
  affects_balance: boolean;
  idempotency_key: string;
}

async function fetchTransaction(key: string): Promise<TransactionRow | null> {
  const { data, error } = await svc
    .from('reward_transactions')
    .select('id, user_id, points, transaction_type, counts_for_progression, affects_balance, idempotency_key')
    .eq('idempotency_key', key)
    .maybeSingle();
  if (error) throw new Error(`reward_transactions(${key}): ${error.message}`);
  return (data as TransactionRow | null) ?? null;
}

async function fetchDecision(key: string) {
  const { data, error } = await svc
    .from('progression_decisions')
    .select('outcome, reason, reward_transaction_id, user_id, action_type')
    .eq('idempotency_key', key)
    .maybeSingle();
  if (error) throw new Error(`progression_decisions(${key}): ${error.message}`);
  return data as
    | {
        outcome: string;
        reason: string | null;
        reward_transaction_id: string | null;
        user_id: string;
        action_type: string;
      }
    | null;
}

async function fetchOutboxStatus(txId: string): Promise<string | null> {
  const { data, error } = await svc
    .from('progression_outbox')
    .select('status')
    .eq('reward_transaction_id', txId)
    .maybeSingle();
  if (error) throw new Error(`progression_outbox(${txId}): ${error.message}`);
  return (data as { status: string } | null)?.status ?? null;
}

async function expectAwarded(params: {
  result: AwardResult;
  userId: string;
  action: string;
  sourceType: string;
  sourceId: string;
  points: number;
  metadataUser?: string;
}): Promise<TransactionRow> {
  const key = `${params.sourceType}:${params.sourceId}`;
  expect(params.result.success, JSON.stringify(params.result)).toBe(true);
  expect(params.result.outcome).toBe('awarded');
  expect(params.result.rewardTransactionId).toBeTruthy();

  const tx = await fetchTransaction(key);
  expect(tx).not.toBeNull();
  if (!tx) throw new Error(`transaction absente pour ${key}`);
  expect(tx.user_id).toBe(params.userId);
  expect(tx.points).toBe(params.points);
  expect(tx.transaction_type).toBe('PROGRESSION_AWARD');
  expect(tx.counts_for_progression).toBe(true);
  expect(tx.affects_balance).toBe(false);
  expect(params.result.rewardTransactionId).toBe(tx.id);

  const decision = await fetchDecision(key);
  expect(decision).not.toBeNull();
  expect(decision?.outcome).toBe('awarded');
  expect(decision?.action_type).toBe(params.action);
  expect(decision?.reward_transaction_id).toBe(tx.id);

  const outbox = await fetchOutboxStatus(tx.id);
  expect(outbox).toBe('pending');

  return tx;
}

async function expectRefused(
  result: AwardResult,
  reason: string,
  key?: string
): Promise<void> {
  expect(result.success).toBe(false);
  expect(result.outcome).toBe('refused');
  expect(result.reason).toBe(reason);
  if (key) {
    const tx = await fetchTransaction(key);
    expect(tx).toBeNull();
  }
}

async function expectIdempotent(key: string): Promise<void> {
  const { count: txCount, error: txError } = await svc
    .from('reward_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('idempotency_key', key);
  if (txError) throw new Error(txError.message);
  expect(txCount).toBe(1);

  const { count: decisionCount, error: decisionError } = await svc
    .from('progression_decisions')
    .select('idempotency_key', { count: 'exact', head: true })
    .eq('idempotency_key', key);
  if (decisionError) throw new Error(decisionError.message);
  expect(decisionCount).toBe(1);
}

describe.skipIf(!E2E)('phase1 — producteurs d’aventure (intégration locale réelle)', { timeout: 30_000 }, () => {
  beforeAll(async () => {
    assertLocalEnv();
    const client = getServiceSupabase();
    if (!client) throw new Error('[phase1-producers] service client indisponible');
    svc = client;

    const { data: rules, error } = await svc
      .from('progression_rules')
      .select('payload')
      .eq('active', true)
      .single();
    if (error || !rules) throw new Error(`progression_rules: ${error?.message}`);
    rulesActions =
      ((rules.payload as { actions?: Record<string, ActionRule> }).actions ?? {}) as Record<
        string,
        ActionRule
      >;

    segmentBase = 8_000_000_000 + (Date.now() % 100_000_000) * 10;
    userA = await createUser('a');
    userB = await createUser('b');
  }, 60_000);

  afterAll(async () => {
    if (!E2E || !svc) return;
    const safe = async (label: string, fn: () => unknown) => {
      try {
        await fn();
      } catch (err) {
        console.error(`[phase1-producers] cleanup ${label}:`, err);
      }
    };

    for (const userId of F.users) {
      await safe(`leaderboard(${userId})`, () =>
        svc.from('leaderboard_refresh_queue').delete().eq('user_id', userId)
      );
      await safe(`events(${userId})`, () =>
        svc.from('progression_events').delete().eq('user_id', userId)
      );
      await safe(`outbox(${userId})`, () =>
        svc.from('progression_outbox').delete().eq('user_id', userId)
      );
      await safe(`season(${userId})`, () =>
        svc.from('user_season_progress').delete().eq('user_id', userId)
      );
      await safe(`progression(${userId})`, () =>
        svc.from('user_progression').delete().eq('user_id', userId)
      );
      await safe(`decisions(${userId})`, () =>
        svc.from('progression_decisions').delete().eq('user_id', userId)
      );
      await safe(`transactions(${userId})`, () =>
        svc.from('reward_transactions').delete().eq('user_id', userId)
      );
    }

    if (F.moments.length) await safe('carnet_moments', () => svc.from('carnet_moments').delete().in('id', F.moments));
    if (F.carnets.length) await safe('carnets', () => svc.from('carnets').delete().in('id', F.carnets));
    if (F.checklist.length) await safe('checklist', () => svc.from('trip_checklist_items').delete().in('id', F.checklist));
    // Les checklists seedées par le trigger `trips` sont purgées par trip.
    for (const tripId of F.trips) {
      await safe(`checklist(${tripId})`, () => svc.from('trip_checklist_items').delete().eq('trip_id', tripId));
      await safe(`pois(${tripId})`, () => svc.from('trip_pois').delete().eq('trip_id', tripId));
    }
    if (F.trips.length) await safe('trips', () => svc.from('trips').delete().in('id', F.trips));
    if (F.reports.length) await safe('reports', () => svc.from('kit_field_reports').delete().in('id', F.reports));
    if (F.kits.length) await safe('kits', () => svc.from('materiel_kits').delete().in('id', F.kits));
    if (F.passages.length) await safe('passages', () => svc.from('session_segment_passages').delete().in('id', F.passages));
    if (F.sessions.length) await safe('sessions', () => svc.from('hike_sessions').delete().in('id', F.sessions));
    if (F.segments.length) await safe('segments', () => svc.from('trail_segments').delete().in('id', F.segments));

    for (const userId of F.users) {
      await safe(`user(${userId})`, () => svc.auth.admin.deleteUser(userId));
    }
  }, 60_000);

  it('1. session traitée + 3 passages ⇒ awarded (+bonus), rejeu idempotent', async () => {
    const segments = await createSegments(3);
    const sessionId = await createSession(userA, 'processed');
    for (let i = 0; i < 3; i += 1) {
      await createPassage(sessionId, userA, segments[i], i);
    }

    const result = (await awardHikeSessionProcessed(sessionId)) as AwardResult;
    await expectAwarded({
      result,
      userId: userA,
      action: 'hike_session_processed',
      sourceType: 'hike_session',
      sourceId: sessionId,
      points: expectedPoints('hike_session_processed', 15),
    });

    const replay = (await awardHikeSessionProcessed(sessionId)) as AwardResult;
    expect(replay.success).toBe(true);
    expect(replay.outcome).toBe('awarded');
    await expectIdempotent(`hike_session:${sessionId}`);
  });

  it('1b. session non traitée ⇒ refused session_non_traitee', async () => {
    const sessionId = await createSession(userA, 'pending');
    const result = (await awardHikeSessionProcessed(sessionId)) as AwardResult;
    await expectRefused(result, 'session_non_traitee', `hike_session:${sessionId}`);
    // Refus au niveau du hook : le moteur n'est jamais atteint → AUCUNE
    // progression_decisions (borne documentée ; tous les refus métier de la
    // suite — carnet privé, checklist, aucune_preuve — sont aussi des refus
    // de hook).
    expect(await fetchDecision(`hike_session:${sessionId}`)).toBeNull();
  });

  it('2. sentier préparé ⇒ awarded, rejeu idempotent', async () => {
    const tripId = await createTrip(userA, 'planned');
    const routeId = segmentBase + 900;
    const result = (await awardTrailPrepared(userA, routeId, tripId)) as AwardResult;
    await expectAwarded({
      result,
      userId: userA,
      action: 'trail_prepared',
      sourceType: 'trail_prep',
      sourceId: `${userA}:${routeId}`,
      points: expectedPoints('trail_prepared'),
    });

    const replay = (await awardTrailPrepared(userA, routeId, tripId)) as AwardResult;
    expect(replay.success).toBe(true);
    await expectIdempotent(`trail_prep:${userA}:${routeId}`);
  });

  it('3. débrief kit ⇒ awarded ; session sans débrief ⇒ refused aucun_debrief', async () => {
    const withReport = await createSession(userA, 'processed');
    await createKitReport(withReport, userA);
    const awarded = (await awardKitFieldReport(withReport)) as AwardResult;
    await expectAwarded({
      result: awarded,
      userId: userA,
      action: 'kit_field_report',
      sourceType: 'kit_report',
      sourceId: withReport,
      points: expectedPoints('kit_field_report', 2),
    });

    const withoutReport = await createSession(userA, 'processed');
    const refused = (await awardKitFieldReport(withoutReport)) as AwardResult;
    await expectRefused(refused, 'aucun_debrief', `kit_report:${withoutReport}`);
  });

  it('4. avis lieu ⇒ 1 crédit par utilisateur sur le même lieu', async () => {
    const placeId = crypto.randomUUID();
    const first = (await awardPlaceReview(userA, placeId)) as AwardResult;
    await expectAwarded({
      result: first,
      userId: userA,
      action: 'place_review',
      sourceType: 'place_review',
      sourceId: `${userA}:${placeId}`,
      points: expectedPoints('place_review'),
    });

    const second = (await awardPlaceReview(userB, placeId)) as AwardResult;
    await expectAwarded({
      result: second,
      userId: userB,
      action: 'place_review',
      sourceType: 'place_review',
      sourceId: `${userB}:${placeId}`,
      points: expectedPoints('place_review'),
    });

    expect(first.rewardTransactionId).not.toBe(second.rewardTransactionId);
  });

  it('5. carnet publié ⇒ awarded ; privé ⇒ refused carnet_non_publie ; public vide ⇒ refused', async () => {
    const tripId = await createTrip(userA, 'planned');
    const carnetId = await createCarnet(userA, { visibility: 'public', tripId });
    await createMoment(carnetId);
    await createMoment(carnetId);
    await createMoment(carnetId);

    const awarded = (await awardCarnetPublished(carnetId)) as AwardResult;
    await expectAwarded({
      result: awarded,
      userId: userA,
      action: 'carnet_published',
      sourceType: 'carnet',
      sourceId: carnetId,
      points: expectedPoints('carnet_published'),
    });

    const privateCarnet = await createCarnet(userA, { visibility: 'private', tripId });
    await createMoment(privateCarnet);
    const refusedPrivate = (await awardCarnetPublished(privateCarnet)) as AwardResult;
    await expectRefused(refusedPrivate, 'carnet_non_publie', `carnet:${privateCarnet}`);

    const emptyCarnet = await createCarnet(userA, { visibility: 'public' });
    const refusedEmpty = (await awardCarnetPublished(emptyCarnet)) as AwardResult;
    await expectRefused(refusedEmpty, 'carnet_non_rattache', `carnet:${emptyCarnet}`);
  });

  it('6. checklist 100 % ⇒ awarded ; incomplète ⇒ refused ; vide ⇒ refused', async () => {
    // Réalité repo : le trigger `trips` seede une checklist par défaut — la
    // complétude se prouve donc en cochant TOUS les items existants.
    const tripDone = await createTrip(userA, 'planned');
    await createChecklistItem(tripDone, true);
    await createChecklistItem(tripDone, true);
    const doneCount = await markAllChecklistDone(tripDone);
    expect(doneCount).toBeGreaterThanOrEqual(2);

    const awarded = (await awardChecklistCompleted(tripDone)) as AwardResult;
    await expectAwarded({
      result: awarded,
      userId: userA,
      action: 'checklist_completed',
      sourceType: 'checklist',
      sourceId: tripDone,
      points: expectedPoints('checklist_completed'),
    });

    const tripIncomplete = await createTrip(userA, 'planned');
    await createChecklistItem(tripIncomplete, true);
    const refusedIncomplete = (await awardChecklistCompleted(tripIncomplete)) as AwardResult;
    await expectRefused(refusedIncomplete, 'checklist_incomplete', `checklist:${tripIncomplete}`);

    const tripEmpty = await createTrip(userA, 'planned');
    await deleteAllChecklistItems(tripEmpty);
    const refusedEmpty = (await awardChecklistCompleted(tripEmpty)) as AwardResult;
    await expectRefused(refusedEmpty, 'checklist_vide', `checklist:${tripEmpty}`);
  });

  it('7. voyage terminé avec preuve ⇒ awarded ; sans preuve ⇒ refused aucune_preuve', async () => {
    const tripVisited = await createTrip(userA, 'completed');
    await createPoi(tripVisited, true);
    const awarded = (await awardTripCompleted(tripVisited)) as AwardResult;
    await expectAwarded({
      result: awarded,
      userId: userA,
      action: 'trip_completed',
      sourceType: 'trip',
      sourceId: tripVisited,
      points: expectedPoints('trip_completed'),
    });

    const tripBare = await createTrip(userA, 'completed');
    const refused = (await awardTripCompleted(tripBare)) as AwardResult;
    await expectRefused(refused, 'aucune_preuve', `trip:${tripBare}`);
  });

  it('8. chaîne complète : outbox → progression_events + user_progression (total exact)', async () => {
    const { data: awardedTx, error } = await svc
      .from('reward_transactions')
      .select('id, points')
      .eq('user_id', userA)
      .eq('transaction_type', 'PROGRESSION_AWARD');
    if (error) throw new Error(error.message);
    const rows = (awardedTx ?? []) as Array<{ id: string; points: number }>;
    // 7 producteurs exactement pour l'utilisateur A (le 8e crédit est pour B).
    expect(rows.length).toBe(7);
    const totalA = rows.reduce((sum, row) => sum + row.points, 0);

    const { data: outboxResult, error: processError } = await svc.rpc('process_progression_outbox', {
      p_limit: 50,
    });
    expect(processError).toBeNull();
    const stats = (outboxResult ?? {}) as { processed?: number; failed?: number };
    expect(stats.failed).toBe(0);
    expect(stats.processed ?? 0).toBeGreaterThanOrEqual(7);

    for (const row of rows) {
      const status = await fetchOutboxStatus(row.id);
      expect(status).toBe('processed');

      const { count, error: eventError } = await svc
        .from('progression_events')
        .select('id', { count: 'exact', head: true })
        .eq('reward_transaction_id', row.id);
      if (eventError) throw new Error(eventError.message);
      expect(count).toBe(1);
    }

    const { data: progression, error: progressionError } = await svc
      .from('user_progression')
      .select('lifetime_points')
      .eq('user_id', userA)
      .single();
    if (progressionError) throw new Error(progressionError.message);
    expect((progression as { lifetime_points: number }).lifetime_points).toBe(totalA);
  });
});
