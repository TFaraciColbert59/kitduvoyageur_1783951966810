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
if (!URL || !URL.includes('icxyvwzfjbflcbqukpfz')) {
  console.error('Refus : URL prod attendue (icxyvwzfjbflcbqukpfz).');
  process.exit(1);
}
if (!KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY absent de .env.local');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const TABLES = [
  'user_profiles', 'loyalty_history', 'loyalty_redemptions', 'reward_transactions',
  'progression_outbox', 'progression_events', 'user_progression', 'user_season_progress',
  'orders', 'progression_legacy_snapshot', 'reward_accounts', 'kit_reports',
];

async function countOf(table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) return { table, error: error.message };
  return { table, count: count ?? 0 };
}

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

const out = { capturedAt: new Date().toISOString(), url: URL, counts: {}, findings: {} };

out.counts = {};
for (const t of TABLES) {
  const r = await countOf(t);
  out.counts[t] = r.error ? `ERR: ${r.error}` : r.count;
}

try {
  const profiles = await fetchAll('user_profiles', 'id, loyalty_points, loyalty_level, email, role');
  const history = await fetchAll('loyalty_history', 'user_id, points, type, source_id');
  const sumByUser = new Map();
  for (const h of history) {
    const k = h.user_id ?? 'null';
    sumByUser.set(k, (sumByUser.get(k) ?? 0) + (h.points ?? 0));
  }
  const mismatches = [];
  for (const p of profiles) {
    const sum = sumByUser.get(p.id) ?? 0;
    if ((p.loyalty_points ?? 0) !== sum) {
      mismatches.push({ user_id: p.id, profile: p.loyalty_points ?? 0, history_sum: sum, delta: (p.loyalty_points ?? 0) - sum });
    }
  }
  out.findings.loyalty = {
    profiles: profiles.length,
    profiles_nonzero: profiles.filter((p) => (p.loyalty_points ?? 0) !== 0).length,
    history_rows: history.length,
    history_by_type: history.reduce((acc, h) => { acc[h.type] = (acc[h.type] ?? 0) + 1; return acc; }, {}),
    opening_rows: history.filter((h) => (h.source_id ?? '').startsWith('opening:')).length,
    mismatches_count: mismatches.length,
    mismatches: mismatches.slice(0, 50),
  };
  out.findings.users = profiles.map((p) => ({ id: p.id, email: (p.email ?? '').slice(0, 40), role: p.role, loyalty_points: p.loyalty_points }));
} catch (e) {
  out.findings.loyalty = { error: String(e.message ?? e) };
}

try {
  const tx = await fetchAll('reward_transactions', 'id, user_id, transaction_type, counts_for_progression, affects_balance, idempotency_key, metadata');
  const outbox = await fetchAll('progression_outbox', 'reward_transaction_id, status');
  const events = await fetchAll('progression_events', 'reward_transaction_id, idempotency_key, user_id, points_total');
  const eventTxIds = new Set(events.map((e) => e.reward_transaction_id).filter(Boolean));
  const progressionTx = tx.filter((t) => t.counts_for_progression === true);
  const processedNoEvent = outbox.filter((o) => o.status === 'processed' && !eventTxIds.has(o.reward_transaction_id));
  const seedTx = tx.filter((t) => (t.metadata?.seeded_by ?? '') === 'seed_ultra_demo');
  out.findings.progression = {
    reward_transactions: tx.length,
    progression_tx: progressionTx.length,
    seed_tx: seedTx.length,
    outbox_rows: outbox.length,
    outbox_by_status: outbox.reduce((acc, o) => { acc[o.status] = (acc[o.status] ?? 0) + 1; return acc; }, {}),
    events: events.length,
    processed_without_event: processedNoEvent.length,
    progression_tx_without_event: progressionTx.filter((t) => !eventTxIds.has(t.id)).length,
  };
} catch (e) {
  out.findings.progression = { error: String(e.message ?? e) };
}

const dir = path.join(ROOT, 'backups', `phase1-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'preflight.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`preflight écrit: ${file}`);
console.log(JSON.stringify({ counts: out.counts, findings: out.findings }, null, 2));
