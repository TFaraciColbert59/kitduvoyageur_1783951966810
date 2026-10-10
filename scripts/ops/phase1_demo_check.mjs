#!/usr/bin/env node
/**
 * phase1_demo_check.mjs — vérification POST-MIGRATION (lecture seule stricte)
 * de l'isolation du compte démo après 20261010160000_phase1_demo_isolation.
 *
 * Contrôles :
 *   1. user_profiles.is_demo du compte pinné = true ;
 *   2. progression_events du démo = 15, tous adossés aux tx seed
 *      (metadata.seeded_by = 'seed_ultra_demo', counts_for_progression) ;
 *   3. user_progression.lifetime_points démo = Σ points des tx seed ;
 *   4. 0 ligne progression_leaderboard_agg pour le démo ;
 *   5. progression_legacy_snapshot contient le snapshot incr2
 *      (reason = 'demo_canonical_rebuild_incr2').
 *
 * Sortie : JSON sur stdout ; exit non-nul si un contrôle échoue.
 * SÉCURITÉ : refuse toute URL qui n'est pas le projet prod (icxyvwzfjbflcbqukpfz)
 * et n'émet AUCUNE écriture (uniquement des .select()).
 *
 * Usage : node scripts/ops/phase1_demo_check.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const PROD_REF = 'icxyvwzfjbflcbqukpfz';
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !URL.includes(PROD_REF)) {
  console.error(`Refus : URL prod (réf ${PROD_REF}) attendue. Script en lecture seule, jamais sur une autre base.`);
  process.exit(1);
}
if (!KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY absent de .env.local');
  process.exit(1);
}

const DEMO_ID = 'd5451f35-db9f-4575-9114-6d3b79550bbc';
const SNAPSHOT_REASON = 'demo_canonical_rebuild_incr2';

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function fetchAll(table, columns, apply = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply(sb.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const out = {
  ok: false,
  capturedAt: new Date().toISOString(),
  demoId: DEMO_ID,
  checks: {},
  details: {},
};

try {
  const { data: profile, error: pErr } = await sb
    .from('user_profiles')
    .select('id, email, role, is_demo')
    .eq('id', DEMO_ID)
    .maybeSingle();
  if (pErr) throw new Error(`user_profiles: ${pErr.message}`);

  const seedTx = await fetchAll(
    'reward_transactions',
    'id, points, counts_for_progression, metadata',
    (q) => q.eq('user_id', DEMO_ID).eq('counts_for_progression', true).eq('metadata->>seeded_by', 'seed_ultra_demo')
  );

  const events = await fetchAll(
    'progression_events',
    'id, reward_transaction_id, user_id, points_total',
    (q) => q.eq('user_id', DEMO_ID)
  );

  const { data: progression, error: upErr } = await sb
    .from('user_progression')
    .select('lifetime_points')
    .eq('user_id', DEMO_ID)
    .maybeSingle();
  if (upErr) throw new Error(`user_progression: ${upErr.message}`);

  const { count: aggCount, error: aggErr } = await sb
    .from('progression_leaderboard_agg')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', DEMO_ID);
  if (aggErr) throw new Error(`progression_leaderboard_agg: ${aggErr.message}`);

  const { count: snapshotCount, error: snapErr } = await sb
    .from('progression_legacy_snapshot')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', DEMO_ID)
    .eq('reason', SNAPSHOT_REASON);
  if (snapErr) throw new Error(`progression_legacy_snapshot: ${snapErr.message}`);

  const seedIds = new Set(seedTx.map((t) => t.id));
  const seedSum = seedTx.reduce((acc, t) => acc + (t.points ?? 0), 0);
  const orphanEvents = events
    .filter((e) => !seedIds.has(e.reward_transaction_id))
    .map((e) => e.reward_transaction_id);

  out.checks = {
    is_demo_true: profile?.is_demo === true,
    events_count_15: events.length === 15,
    events_all_seed_tx: events.length > 0 && orphanEvents.length === 0,
    lifetime_equals_seed_sum: progression?.lifetime_points === seedSum,
    agg_zero_for_demo: (aggCount ?? 0) === 0,
    incr2_snapshot_present: (snapshotCount ?? 0) >= 1,
  };

  out.details = {
    profile: profile ?? null,
    seed_tx_count: seedTx.length,
    seed_points_sum: seedSum,
    events_count: events.length,
    events_orphan_reward_transaction_ids: orphanEvents,
    lifetime_points: progression?.lifetime_points ?? null,
    agg_rows: aggCount ?? 0,
    incr2_snapshot_rows: snapshotCount ?? 0,
  };

  out.ok = Object.values(out.checks).every(Boolean);
} catch (e) {
  out.error = String(e?.message ?? e);
  out.ok = false;
}

console.log(JSON.stringify(out, null, 2));
// exitCode (pas process.exit) : évite l'assertion libuv Windows quand le
// client HTTP a encore des handles en cours de fermeture.
process.exitCode = out.ok ? 0 : 1;
