#!/usr/bin/env node
/**
 * Sonde de santé du moteur de progression (P1 + P3 + P4).
 * Usage : node scripts/ops/progression_outbox_health.mjs
 * Env   : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 * Sortie: JSON
 *   { pending, failed, dead, oldestPendingMinutes,
 *     leaderboard: { pending, failed, oldestPendingMinutes }, ok }
 * `ok` est faux si :
 *   • des lignes `dead` existent dans l'outbox, ou si son retard dépasse 15 min ;
 *   • la file leaderboard (pending+failed) a plus de 30 min de retard.
 * Codes de sortie : 0 = ok, 1 = dégradé/lecture impossible, 2 = config absente.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[progression-outbox-health] SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  process.exit(2);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: outboxRows, error: outboxError } = await supabase
  .from('progression_outbox')
  .select('status, created_at')
  .in('status', ['pending', 'failed', 'dead']);

if (outboxError) {
  console.error('[progression-outbox-health] lecture outbox impossible:', outboxError.message);
  process.exit(1);
}

const { data: queueRows, error: queueError } = await supabase
  .from('leaderboard_refresh_queue')
  .select('status, created_at')
  .in('status', ['pending', 'failed']);

if (queueError) {
  console.error('[progression-outbox-health] lecture file leaderboard impossible:', queueError.message);
  process.exit(1);
}

const rows = outboxRows ?? [];
const count = (list, status) => list.filter((row) => row.status === status).length;
const oldestMinutes = (list) => {
  const oldest = list.reduce((min, row) => {
    const created = new Date(row.created_at).getTime();
    return min === null || created < min ? created : min;
  }, null);
  return oldest === null ? 0 : Math.round((Date.now() - oldest) / 60000);
};

const pending = rows.filter((row) => row.status === 'pending' || row.status === 'failed');
const oldestPendingMinutes = oldestMinutes(pending);
const dead = count(rows, 'dead');

const queue = queueRows ?? [];
const oldestLeaderboardMinutes = oldestMinutes(queue);

const ok =
  dead === 0 && oldestPendingMinutes <= 15 && oldestLeaderboardMinutes <= 30;

console.log(
  JSON.stringify(
    {
      pending: count(rows, 'pending'),
      failed: count(rows, 'failed'),
      dead,
      oldestPendingMinutes,
      leaderboard: {
        pending: count(queue, 'pending'),
        failed: count(queue, 'failed'),
        oldestPendingMinutes: oldestLeaderboardMinutes,
      },
      ok,
    },
    null,
    2
  )
);

process.exit(ok ? 0 : 1);
