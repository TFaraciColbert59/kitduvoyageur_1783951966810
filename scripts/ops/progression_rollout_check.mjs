import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * T47 — Contrôle de santé avant de changer de cohorte (LECTURE SEULE).
 * Usage : node scripts/ops/progression_rollout_check.mjs
 * Sortie JSON : { tierOk, reasons[], metrics } — exit 1 si un palier ne peut
 * pas être dépassé selon les conditions publiées (docs/progression/DEPLOYMENT.md).
 */
const ROOT = process.cwd();
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Configuration Supabase absente (.env.local).');
  process.exit(2);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const reasons = [];
const metrics = {};

try {
  const { count: deadOutbox } = await sb
    .from('progression_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'dead');
  metrics.deadOutbox = deadOutbox ?? 0;
  if ((deadOutbox ?? 0) > 0) reasons.push('outbox_dead');

  const { data: oldest } = await sb
    .from('progression_outbox')
    .select('created_at')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(1);
  const oldestMinutes = oldest?.[0]?.created_at
    ? Math.round((Date.now() - new Date(oldest[0].created_at).getTime()) / 60000)
    : 0;
  metrics.oldestPendingMinutes = oldestMinutes;
  if (oldestMinutes > 15) reasons.push('retard_outbox_15min');

  const { count: deadIntents } = await sb
    .from('progression_award_intents')
    .select('id', { count: 'exact', head: true })
    .eq('state', 'dead');
  metrics.deadIntents = deadIntents ?? 0;
  if ((deadIntents ?? 0) > 0) reasons.push('intentions_dead');

  const { count: stuckIntents } = await sb
    .from('progression_award_intents')
    .select('id', { count: 'exact', head: true })
    .eq('state', 'processing');
  metrics.processingIntents = stuckIntents ?? 0;
} catch (error) {
  reasons.push(`lecture_impossible:${String(error.message ?? error)}`);
}

const result = { capturedAt: new Date().toISOString(), tierOk: reasons.length === 0, reasons, metrics };
console.log(JSON.stringify(result, null, 2));
process.exit(result.tierOk ? 0 : 1);
