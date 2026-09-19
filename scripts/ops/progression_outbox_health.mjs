#!/usr/bin/env node
/**
 * Sonde de santé de l'outbox de progression (P1).
 * Usage : node scripts/ops/progression_outbox_health.mjs
 * Env   : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 * Sortie: JSON { pending, failed, dead, oldestPendingMinutes, ok }
 * `ok` est faux si des lignes `dead` existent ou si le retard dépasse 15 minutes.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[progression-outbox-health] SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  process.exit(2);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from('progression_outbox')
  .select('status, created_at')
  .in('status', ['pending', 'failed', 'dead']);

if (error) {
  console.error('[progression-outbox-health] lecture impossible:', error.message);
  process.exit(1);
}

const rows = data ?? [];
const count = (status) => rows.filter((row) => row.status === status).length;
const pending = rows.filter((row) => row.status === 'pending' || row.status === 'failed');
const oldest = pending.reduce((min, row) => {
  const created = new Date(row.created_at).getTime();
  return min === null || created < min ? created : min;
}, null);
const oldestPendingMinutes = oldest === null ? 0 : Math.round((Date.now() - oldest) / 60000);
const dead = count('dead');
const ok = dead === 0 && oldestPendingMinutes <= 15;

console.log(
  JSON.stringify(
    { pending: count('pending'), failed: count('failed'), dead, oldestPendingMinutes, ok },
    null,
    2
  )
);

process.exit(ok ? 0 : 1);
