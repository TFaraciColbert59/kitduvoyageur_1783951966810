import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL?.includes('icxyvwzfjbflcbqukpfz') || !KEY) {
  console.error('Refus : projet prod attendu + service key requise.');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const TABLES = [
  'user_profiles', 'loyalty_history', 'loyalty_redemptions', 'reward_transactions',
  'progression_outbox', 'progression_events', 'user_progression', 'user_season_progress',
  'orders', 'progression_legacy_snapshot', 'reward_accounts', 'kit_reports', 'reward_config',
];

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.join(ROOT, 'backups', `phase1-${stamp}`);
fs.mkdirSync(dir, { recursive: true });

const manifest = { capturedAt: new Date().toISOString(), url: URL, tables: {} };

for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999);
    if (error) {
      manifest.tables[table] = { error: error.message };
      break;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (manifest.tables[table]?.error) continue;
  const json = JSON.stringify(rows, null, 2);
  const file = path.join(dir, `${table}.json`);
  fs.writeFileSync(file, json);
  manifest.tables[table] = {
    rows: rows.length,
    bytes: Buffer.byteLength(json),
    sha256: crypto.createHash('sha256').update(json).digest('hex'),
  };
}

fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`backup écrit: ${dir}`);
console.log(JSON.stringify(manifest.tables, null, 2));
