import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * Phase 1 — scan de supervision des points (Incrément 6).
 *
 * STRICTEMENT LECTURE SEULE côté base : aucune écriture, aucun RPC mutant.
 * Destiné à un cron/CI nocturne sur la production ; il écrit uniquement un
 * rapport JSON local (`backups/phase1-anomaly-scan-<ts>/scan.json`) et sort en
 * erreur (exit 1) dès qu'une anomalie NON-démo est détectée.
 *
 * Contrôles :
 *   1. Σ journal legacy ≠ profil (is_demo rapportés à part) ;
 *   2. compte économique ≠ ledger (available / lifetime, démo à part) ;
 *   3. projection de progression ≠ Σ événements (démo à part) ;
 *   4. progression_outbox en `dead`/`failed` (tous) ;
 *   5. progression_events sans reward_transaction_id (tous) ;
 *   6. transaction counts_for_progression=true sans ligne outbox (tous) ;
 *   7. décision awarded/awarded_lifetime_only sans reward_transaction_id (tous) ;
 *   8. user_progression sans AUCUN événement (non-démo).
 *
 * Conventions reprises de scripts/audit/phase1_reconcile_balances.mjs
 * (parse .env.local, garde projet prod, pagination 1000).
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
  console.error('Refus : ce scan de supervision est réservé au projet de production.');
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

const report = { capturedAt: new Date().toISOString(), url: URL, checks: {}, anomalies: 0 };

function scoped(diffs) {
  const nonDemo = diffs.filter((d) => !d.is_demo);
  const demo = diffs.filter((d) => d.is_demo);
  return { mismatches: diffs.length, non_demo_mismatches: nonDemo.length, demo: demo.slice(0, 20), details: diffs.slice(0, 50) };
}

try {
  const profiles = await fetchAll('user_profiles', 'id, email, role, loyalty_points, is_demo');
  const history = await fetchAll('loyalty_history', 'user_id, points');
  const demos = new Set(profiles.filter((p) => p.is_demo).map((p) => p.id));

  // 1. Σ journal legacy vs profil.
  const sumByUser = new Map();
  for (const h of history) sumByUser.set(h.user_id, (sumByUser.get(h.user_id) ?? 0) + (h.points ?? 0));
  const loyaltyDiffs = [];
  for (const p of profiles) {
    const sum = sumByUser.get(p.id) ?? 0;
    if ((p.loyalty_points ?? 0) !== sum) {
      loyaltyDiffs.push({
        user_id: p.id,
        is_demo: demos.has(p.id),
        profile: p.loyalty_points ?? 0,
        journal_sum: sum,
        delta: (p.loyalty_points ?? 0) - sum,
      });
    }
  }
  report.checks.legacy_loyalty = {
    users: profiles.length,
    history_rows: history.length,
    ...scoped(loyaltyDiffs),
  };

  // 2. Compte économique vs ledger (available ET lifetime).
  const accounts = await fetchAll('reward_accounts', 'user_id, available_points, lifetime_points');
  const tx = await fetchAll('reward_transactions', 'id, user_id, points, transaction_type, affects_balance, counts_for_progression');
  const accSum = new Map();
  for (const t of tx) {
    if (t.affects_balance === false) continue;
    const cur = accSum.get(t.user_id) ?? { sum: 0, positive: 0 };
    cur.sum += t.points ?? 0;
    if ((t.points ?? 0) > 0) cur.positive += t.points;
    accSum.set(t.user_id, cur);
  }
  const econDiffs = [];
  for (const a of accounts) {
    const s = accSum.get(a.user_id) ?? { sum: 0, positive: 0 };
    const deltaAvailable = (a.available_points ?? 0) - s.sum;
    const deltaLifetime = (a.lifetime_points ?? 0) - s.positive;
    if (deltaAvailable !== 0 || deltaLifetime !== 0) {
      econDiffs.push({
        user_id: a.user_id,
        is_demo: demos.has(a.user_id),
        account_available: a.available_points,
        ledger_sum: s.sum,
        delta_available: deltaAvailable,
        account_lifetime: a.lifetime_points,
        ledger_positive: s.positive,
        delta_lifetime: deltaLifetime,
      });
    }
  }
  report.checks.economic_accounts = {
    accounts: accounts.length,
    affects_balance_tx: tx.filter((t) => t.affects_balance !== false).length,
    ...scoped(econDiffs),
  };

  // 3. Projection progression vs Σ événements.
  const progression = await fetchAll('user_progression', 'user_id, lifetime_points');
  const events = await fetchAll('progression_events', 'id, user_id, reward_transaction_id, points_total');
  const evSum = new Map();
  for (const e of events) evSum.set(e.user_id, (evSum.get(e.user_id) ?? 0) + (e.points_total ?? 0));
  const progDiffs = [];
  for (const up of progression) {
    const sum = evSum.get(up.user_id) ?? 0;
    if ((up.lifetime_points ?? 0) !== sum) {
      progDiffs.push({
        user_id: up.user_id,
        is_demo: demos.has(up.user_id),
        projection: up.lifetime_points ?? 0,
        events_sum: sum,
        delta: (up.lifetime_points ?? 0) - sum,
      });
    }
  }
  report.checks.progression_projection = {
    projections: progression.length,
    ...scoped(progDiffs),
  };

  // 4. Outbox dead/failed (tous).
  const outbox = await fetchAll('progression_outbox', 'id, reward_transaction_id, user_id, status');
  const outboxDead = outbox.filter((o) => o.status === 'dead' || o.status === 'failed');
  report.checks.outbox_dead_or_failed = { total: outbox.length, count: outboxDead.length, details: outboxDead.slice(0, 50) };

  // 5. Événements sans transaction.
  const eventsNoTx = events.filter((e) => !e.reward_transaction_id);
  report.checks.events_without_tx = { count: eventsNoTx.length, details: eventsNoTx.slice(0, 50) };

  // 6. Transactions de progression sans ligne outbox.
  const outboxTxIds = new Set(outbox.map((o) => o.reward_transaction_id));
  const txWithProgression = tx.filter((t) => t.counts_for_progression === true);
  const txNoOutbox = txWithProgression.filter((t) => !outboxTxIds.has(t.id));
  report.checks.progression_tx_without_outbox = { total: txWithProgression.length, count: txNoOutbox.length, details: txNoOutbox.slice(0, 50) };

  // 7. Décisions awarded sans transaction.
  const decisions = await fetchAll('progression_decisions', 'idempotency_key, user_id, outcome, reward_transaction_id');
  const awardedNoTx = decisions.filter(
    (d) => (d.outcome === 'awarded' || d.outcome === 'awarded_lifetime_only') && !d.reward_transaction_id
  );
  report.checks.awarded_decisions_without_tx = { count: awardedNoTx.length, details: awardedNoTx.slice(0, 50) };

  // 8. Projections sans AUCUN événement (non-démo).
  const usersWithEvents = new Set(events.map((e) => e.user_id));
  const projNoEvents = progression
    .filter((up) => !usersWithEvents.has(up.user_id))
    .map((up) => ({ user_id: up.user_id, is_demo: demos.has(up.user_id), lifetime_points: up.lifetime_points ?? 0 }));
  report.checks.projections_without_events = scoped(projNoEvents);

  const anomalies =
    report.checks.legacy_loyalty.non_demo_mismatches +
    report.checks.economic_accounts.non_demo_mismatches +
    report.checks.progression_projection.non_demo_mismatches +
    report.checks.outbox_dead_or_failed.count +
    report.checks.events_without_tx.count +
    report.checks.progression_tx_without_outbox.count +
    report.checks.awarded_decisions_without_tx.count +
    report.checks.projections_without_events.non_demo_mismatches;
  report.anomalies = anomalies;
  report.ok = anomalies === 0;
} catch (e) {
  report.ok = false;
  report.error = String(e.message ?? e);
}

const dir = path.join(ROOT, 'backups', `phase1-anomaly-scan-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
