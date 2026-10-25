import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * T37 — Inventaire des droits commerciaux (LECTURE SEULE production).
 *
 * Trois familles STRICTEMENT distinguées (aucune conversion) :
 *   • fidélité : Σ loyalty_history vs user_profiles.loyalty_points ;
 *   • parts (Reward Engine) : Σ reward_transactions(affects_balance) vs
 *     reward_accounts.available_points/lifetime_points ;
 *   • crédit boutique de lignée : Σ store_credit_ledger vs
 *     reward_accounts.store_credit_cents.
 *
 * Sortie : backups/economic-entitlements-<horodatage>/scan.json — aucune
 * écriture, aucun RPC mutant, garde projet prod.
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
  console.error('Refus : inventaire réservé au projet de production.');
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

const report = { capturedAt: new Date().toISOString(), url: URL, families: {}, notes: [] };

try {
  const profiles = await fetchAll('user_profiles', 'id, is_demo, loyalty_points');
  const history = await fetchAll('loyalty_history', 'user_id, points');
  const accounts = await fetchAll('reward_accounts', 'user_id, available_points, lifetime_points, store_credit_cents');
  const tx = await fetchAll('reward_transactions', 'user_id, points, affects_balance');
  const storeLedger = await fetchAll('store_credit_ledger', 'user_id, amount_cents').catch(() => []);

  const demoIds = new Set(profiles.filter((p) => p.is_demo).map((p) => p.id));

  const sumBy = (rows, key, pick) => {
    const map = new Map();
    for (const row of rows) map.set(row[key], (map.get(row[key]) ?? 0) + (pick(row) ?? 0));
    return map;
  };

  // Fidélité.
  const loyaltySum = sumBy(history, 'user_id', (row) => row.points);
  let loyaltyGaps = 0;
  for (const profile of profiles) {
    if ((profile.loyalty_points ?? 0) !== (loyaltySum.get(profile.id) ?? 0)) loyaltyGaps += 1;
  }

  // Parts (Reward Engine).
  const partsAvailable = sumBy(
    tx.filter((row) => row.affects_balance !== false),
    'user_id',
    (row) => row.points
  );
  const partsLifetime = sumBy(
    tx.filter((row) => row.affects_balance !== false && (row.points ?? 0) > 0),
    'user_id',
    (row) => row.points
  );
  let partsGaps = 0;
  for (const account of accounts) {
    if (
      (account.available_points ?? 0) !== (partsAvailable.get(account.user_id) ?? 0) ||
      (account.lifetime_points ?? 0) !== (partsLifetime.get(account.user_id) ?? 0)
    ) {
      partsGaps += 1;
    }
  }

  // Crédit boutique de lignée.
  const creditSum = sumBy(storeLedger, 'user_id', (row) => row.amount_cents);
  let creditGaps = 0;
  let creditNonZero = 0;
  for (const account of accounts) {
    const ledger = creditSum.get(account.user_id) ?? 0;
    if ((account.store_credit_cents ?? 0) !== ledger) creditGaps += 1;
    if ((account.store_credit_cents ?? 0) !== 0) creditNonZero += 1;
  }

  report.families = {
    loyalty: {
      users_with_points: profiles.filter((p) => (p.loyalty_points ?? 0) !== 0).length,
      history_rows: history.length,
      gaps: loyaltyGaps,
    },
    contribution_shares: {
      accounts: accounts.length,
      balance_transactions: tx.filter((row) => row.affects_balance !== false).length,
      gaps: partsGaps,
    },
    store_credit: {
      ledger_rows: storeLedger.length,
      accounts_with_credit: creditNonZero,
      gaps: creditGaps,
    },
    demo_excluded_from_reports: demoIds.size,
  };

  report.notes.push('Les trois familles ne sont jamais converties entre elles (aucune passerelle XP/€).');
  report.notes.push('Les anciens droits restent dans leurs journaux respectifs ; aucun ratio modifié par ce scan.');

  report.ok = loyaltyGaps === 0 && partsGaps === 0 && creditGaps === 0;
} catch (error) {
  report.ok = false;
  report.error = String(error.message ?? error);
}

const dir = path.join(ROOT, 'backups', `economic-entitlements-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
