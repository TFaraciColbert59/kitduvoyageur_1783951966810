#!/usr/bin/env node
/**
 * Sonde en lecture seule, bornée : compteurs exacts et première date uniquement.
 * Env : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.
 * Codes : 0 sain, 1 dégradé/lecture impossible, 2 configuration absente.
 * Node 24 derrière le proxy : node --use-env-proxy scripts/ops/progression_outbox_health.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function readProgressionHealth(supabase, now = Date.now()) {
  async function count(table, status) {
    const result = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('status', status);
    if (result.error || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error(`Comptage ${table}/${status} indisponible`);
    }
    return result.count;
  }
  async function oldest(table, statuses, total) {
    if (total === 0) return 0;
    const result = await supabase.from(table).select('created_at').in('status', statuses)
      .order('created_at', { ascending: true }).limit(1);
    const timestamp = Date.parse(result.data?.[0]?.created_at);
    if (result.error || !Number.isFinite(timestamp)) {
      throw new Error(`Date ${table} indisponible`);
    }
    return Math.max(0, (now - timestamp) / 60_000);
  }
  const [pending, failed, dead, leaderboardPending, leaderboardFailed, leaderboardDead] = await Promise.all([
    count('progression_outbox', 'pending'), count('progression_outbox', 'failed'),
    count('progression_outbox', 'dead'), count('leaderboard_refresh_queue', 'pending'),
    count('leaderboard_refresh_queue', 'failed'), count('leaderboard_refresh_queue', 'dead'),
  ]);
  const [oldestPendingMinutes, oldestLeaderboardMinutes] = await Promise.all([
    oldest('progression_outbox', ['pending', 'failed'], pending + failed),
    oldest('leaderboard_refresh_queue', ['pending', 'failed'], leaderboardPending + leaderboardFailed),
  ]);
  return {
    pending, failed, dead, oldestPendingMinutes,
    leaderboard: { pending: leaderboardPending, failed: leaderboardFailed, dead: leaderboardDead, oldestPendingMinutes: oldestLeaderboardMinutes },
    ok: dead === 0 && leaderboardDead === 0 && oldestPendingMinutes <= 15 && oldestLeaderboardMinutes <= 30,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[progression-outbox-health] URL Supabase et clé service requises');
    process.exitCode = 2;
  } else {
    try {
      const client = createClient(url, key, { auth: { persistSession: false } });
      const result = await readProgressionHealth(client);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    } catch (error) {
      console.error('[progression-outbox-health]', error.message);
      process.exitCode = 1;
    }
  }
}
