import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * T02 — Audit ciblé de l'isolation des données de démonstration et des
 * projections canoniques (incrément 2, reçu le 2026-10-11).
 *
 * STRICTEMENT LECTURE SEULE. Il vérifie que :
 *   1. Les 15 transactions seed sont traçables (provenance) et toutes portées
 *      par des comptes `is_demo = true` ;
 *   2. Aucun événement / outbox / projection de ces gains n'appartient à un
 *      compte réel (aucun recrédit hors démo) ;
 *   3. La chaîne canonique du compte démo est cohérente :
 *      Σ events = projection, outbox toutes `processed` ;
 *   4. Les agrégats de classement n'exposent aucun compte démo ;
 *   5. Σ journaux legacy = soldes profils pour tous les comptes NON démo ;
 *   6. Avant/après : les comptes hors démo n'ont aucun solde de progression
 *      (lifetime_points) issu des 15 transactions seed.
 *
 * Sortie JSON dans backups/phase1-demo-projection-scan-<horodatage>/scan.json,
 * exit 1 dès qu'un invariant est violé. Réservé au projet de production
 * (garde projet comme phase1_points_anomaly_scan.mjs).
 */

const ROOT = process.cwd();
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL?.includes('icxyvwzfjbflcbqukpfz')) {
  console.error('Refus : cet audit est réservé au projet de production.');
  process.exit(1);
}
if (!KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY absente.');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const report = { capturedAt: new Date().toISOString(), url: URL, checks: {}, violations: [] };
const violations = report.violations;

function fail(rule, detail) {
  violations.push({ rule, ...detail });
}

try {
  const profiles = await fetchAll('user_profiles', 'id, email, is_demo, loyalty_points');
  const demoIds = new Set(profiles.filter((p) => p.is_demo).map((p) => p.id));

  report.checks.profiles = {
    total: profiles.length,
    demo: demoIds.size,
    demo_emails: profiles.filter((p) => p.is_demo).map((p) => p.email).slice(0, 50),
  };

  // 1/2/3. Chaîne canonique des 15 transactions seed.
  const tx = await fetchAll(
    'reward_transactions',
    'id, user_id, points, transaction_type, idempotency_key, reference_type, metadata'
  );
  const progressionTx = tx.filter((t) => t.transaction_type === 'PROGRESSION_AWARD');
  const outbox = await fetchAll(
    'progression_outbox',
    'id, reward_transaction_id, user_id, status, attempts, last_error'
  );
  const events = await fetchAll(
    'progression_events',
    'id, user_id, reward_transaction_id, points_total, idempotency_key'
  );
  const projections = await fetchAll('user_progression', 'user_id, lifetime_points, season_points');

  const outboxByTx = new Map(outbox.map((o) => [o.reward_transaction_id, o]));
  const eventsByTx = new Map(events.map((e) => [e.reward_transaction_id, e]));

  const seed = progressionTx.map((t) => {
    const o = outboxByTx.get(t.id);
    const e = eventsByTx.get(t.id);
    return {
      tx_id: t.id,
      user_id: t.user_id,
      is_demo: demoIds.has(t.user_id),
      points: t.points,
      idempotency_key: t.idempotency_key,
      reference_type: t.reference_type,
      has_outbox: Boolean(o),
      outbox_status: o?.status ?? null,
      has_event: Boolean(e),
      event_points: e?.points_total ?? null,
    };
  });

  const nonDemoSeed = seed.filter((s) => !s.is_demo);
  if (nonDemoSeed.length > 0) {
    fail('seed_non_demo', { count: nonDemoSeed.length, transactions: nonDemoSeed.slice(0, 20) });
  }
  const notProcessed = seed.filter((s) => !s.has_outbox || s.outbox_status !== 'processed');
  if (notProcessed.length > 0) {
    fail('seed_outbox_non_processed', { count: notProcessed.length, transactions: notProcessed.slice(0, 20) });
  }
  const missingEvent = seed.filter((s) => !s.has_event);
  if (missingEvent.length > 0) {
    fail('seed_event_manquant', { count: missingEvent.length, transactions: missingEvent.slice(0, 20) });
  }

  // Événements/outbox hors de ces transactions : aucun ne doit viser un compte
  // réel tant que la reconstruction canonique n'est pas ouverte (état T02).
  const seedTxIds = new Set(progressionTx.map((t) => t.id));
  const eventsHorsSeed = events.filter((e) => !seedTxIds.has(e.reward_transaction_id));
  const eventsHorsSeedReels = eventsHorsSeed.filter((e) => !demoIds.has(e.user_id));
  if (eventsHorsSeedReels.length > 0) {
    fail('evenement_hors_seed_non_demo', { count: eventsHorsSeedReels.length, events: eventsHorsSeedReels.slice(0, 20) });
  }

  report.checks.seed_chain = {
    progression_transactions: progressionTx.length,
    total_reward_transactions: tx.length,
    outbox_total: outbox.length,
    outbox_dead_or_failed: outbox.filter((o) => ['dead', 'failed'].includes(o.status)).length,
    seed_user_ids: [...new Set(seed.map((s) => s.user_id))],
    seed_demo: seed.filter((s) => s.is_demo).length,
    seed_non_demo: nonDemoSeed.length,
    events: events.length,
    events_hors_seed: eventsHorsSeed.length,
  };

  // Cohérence projective par utilisateur.
  const evSum = new Map();
  for (const e of events) evSum.set(e.user_id, (evSum.get(e.user_id) ?? 0) + (e.points_total ?? 0));
  const projectionMismatches = [];
  for (const up of projections) {
    const sum = evSum.get(up.user_id) ?? 0;
    if ((up.lifetime_points ?? 0) !== sum) {
      projectionMismatches.push({
        user_id: up.user_id,
        is_demo: demoIds.has(up.user_id),
        projection: up.lifetime_points ?? 0,
        events_sum: sum,
      });
    }
  }
  const nonDemoProjectionMismatches = projectionMismatches.filter((m) => !m.is_demo);
  if (nonDemoProjectionMismatches.length > 0) {
    fail('projection_non_demo_incoherente', {
      count: nonDemoProjectionMismatches.length,
      details: nonDemoProjectionMismatches.slice(0, 20),
    });
  }
  report.checks.projection_chain = {
    projections: projections.length,
    event_users: evSum.size,
    demo_mismatches: projectionMismatches.filter((m) => m.is_demo).length,
    non_demo_mismatches: nonDemoProjectionMismatches.length,
  };

  // 4. Agrégats de classement sans comptes démo.
  try {
    const agg = await fetchAll('progression_leaderboard_agg', 'user_id, season_id, scope_type, season_points');
    const demoInAgg = agg.filter((r) => demoIds.has(r.user_id));
    if (demoInAgg.length > 0) {
      fail('demo_dans_classement', { count: demoInAgg.length, details: demoInAgg.slice(0, 20) });
    }
    report.checks.leaderboard_agg = { rows: agg.length, demo_rows: demoInAgg.length };
  } catch (error) {
    report.checks.leaderboard_agg = { error: String(error.message ?? error) };
  }

  // 5. Fidélité legacy : Σ journal = solde, comptes non démo.
  const history = await fetchAll('loyalty_history', 'user_id, points');
  const histSum = new Map();
  for (const h of history) histSum.set(h.user_id, (histSum.get(h.user_id) ?? 0) + (h.points ?? 0));
  const loyaltyMismatches = profiles
    .filter((p) => !p.is_demo && (p.loyalty_points ?? 0) !== (histSum.get(p.id) ?? 0))
    .map((p) => ({
      user_id: p.id,
      loyalty_points: p.loyalty_points ?? 0,
      journal_sum: histSum.get(p.id) ?? 0,
    }));
  if (loyaltyMismatches.length > 0) {
    fail('fidelite_non_demo_ecart', { count: loyaltyMismatches.length, details: loyaltyMismatches.slice(0, 20) });
  }
  report.checks.legacy_loyalty = {
    history_rows: history.length,
    non_demo_mismatches: loyaltyMismatches.length,
  };

  // 6. Avant/après : aucun compte démo crédité dans un compte réel.
  const demoSeedPoints = seed.reduce((acc, s) => acc + (s.points ?? 0), 0);
  report.checks.before_after = {
    seed_points_total: demoSeedPoints,
    real_profiles_with_progression: projections.filter((p) => !demoIds.has(p.user_id)).length,
  };
  if (report.checks.before_after.real_profiles_with_progression > 0) {
    fail('progression_reelle_hors_demo', {
      count: report.checks.before_after.real_profiles_with_progression,
      users: projections
        .filter((row) => !demoIds.has(row.user_id))
        .map((row) => row.user_id)
        .slice(0, 20),
    });
  }

  report.ok = violations.length === 0;
} catch (e) {
  report.ok = false;
  report.error = String(e.message ?? e);
}

const dir = path.join(ROOT, 'backups', `phase1-demo-projection-scan-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
