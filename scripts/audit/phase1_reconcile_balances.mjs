import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL?.includes('icxyvwzfjbflcbqukpfz')) {
  console.error('Refus : ce script est réservé au projet de production.');
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

const report = { capturedAt: new Date().toISOString(), url: URL, checks: {}, findings: [] };

try {
  const profiles = await fetchAll('user_profiles', 'id, email, role, loyalty_points, is_demo');
  const history = await fetchAll('loyalty_history', 'user_id, points, type, source_id');
  const demos = new Set(profiles.filter((p) => p.is_demo).map((p) => p.id));

  const sumByUser = new Map();
  for (const h of history) {
    sumByUser.set(h.user_id, (sumByUser.get(h.user_id) ?? 0) + (h.points ?? 0));
  }
  const loyaltyDiffs = [];
  for (const p of profiles) {
    const sum = sumByUser.get(p.id) ?? 0;
    if ((p.loyalty_points ?? 0) !== sum) {
      loyaltyDiffs.push({
        user_id: p.id,
        email: (p.email ?? '').slice(0, 40),
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
    mismatches: loyaltyDiffs.length,
    non_demo_mismatches: loyaltyDiffs.filter((d) => !d.is_demo).length,
    details: loyaltyDiffs.slice(0, 50),
  };

  const accounts = await fetchAll('reward_accounts', 'user_id, available_points, lifetime_points, redeemed_points');
  const tx = await fetchAll('reward_transactions', 'user_id, points, transaction_type, affects_balance, counts_for_progression');
  const accSum = new Map();
  for (const t of tx) {
    if (t.affects_balance === false) continue;
    const cur = accSum.get(t.user_id) ?? { sum: 0, positive: 0, redeemed: 0 };
    cur.sum += t.points ?? 0;
    if ((t.points ?? 0) > 0) cur.positive += t.points;
    if (t.transaction_type === 'REDEMPTION') cur.redeemed += Math.abs(t.points ?? 0);
    accSum.set(t.user_id, cur);
  }
  const econDiffs = [];
  for (const a of accounts) {
    const s = accSum.get(a.user_id) ?? { sum: 0, positive: 0, redeemed: 0 };
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
    mismatches: econDiffs.length,
    non_demo_mismatches: econDiffs.filter((d) => !d.is_demo).length,
    details: econDiffs.slice(0, 50),
  };

  const progression = await fetchAll('user_progression', 'user_id, lifetime_points');
  const events = await fetchAll('progression_events', 'user_id, points_total');
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
  report.checks.progression = {
    projections: progression.length,
    events: events.length,
    mismatches: progDiffs.length,
    non_demo_mismatches: progDiffs.filter((d) => !d.is_demo).length,
    details: progDiffs.slice(0, 50),
  };

  const nonDemo = report.checks.legacy_loyalty.non_demo_mismatches + report.checks.economic_accounts.non_demo_mismatches + report.checks.progression.non_demo_mismatches;
  report.ok = nonDemo === 0;
} catch (e) {
  report.ok = false;
  report.error = String(e.message ?? e);
}

const dir = path.join(ROOT, 'backups', `reconcile-i4-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'reconcile.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
