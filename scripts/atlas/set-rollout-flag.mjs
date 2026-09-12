/**
 * CHANTIER ATLAS — Opération du rollout (Phase 7).
 *
 * Bascule le flag `explorer_unified_map_enabled` et/ou la cohorte (5 %/25 %)
 * via le service-role (PostgREST), sans migration ni redéploiement.
 * Le rollback est immédiat : `--enabled false` (les pages legacy restent intactes).
 *
 * Usage :
 *   node scripts/atlas/set-rollout-flag.mjs --enabled true
 *   node scripts/atlas/set-rollout-flag.mjs --enabled false
 *   node scripts/atlas/set-rollout-flag.mjs --cohort 5
 *   node scripts/atlas/set-rollout-flag.mjs --enabled true --cohort 100
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const FLAG_ID = 'explorer_unified_map_enabled';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[rollout] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  process.exit(1);
}

const args = process.argv.slice(2);
function argValue(name) {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : null;
}

const enabledRaw = argValue('--enabled');
const cohortRaw = argValue('--cohort');

const enabled = enabledRaw === null ? null : enabledRaw === 'true' || enabledRaw === '1';
const cohort = cohortRaw === null ? null : Number(cohortRaw);

if (enabled === null && cohort === null) {
  console.error('[rollout] rien à faire : passe --enabled true|false et/ou --cohort 0..100');
  process.exit(1);
}
if (cohort !== null && (!Number.isFinite(cohort) || cohort < 0 || cohort > 100)) {
  console.error('[rollout] --cohort doit être un nombre entre 0 et 100');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function readState() {
  const flag = await supabase.from('feature_flags').select('id, enabled').eq('id', FLAG_ID).maybeSingle();
  const cohortRow = await supabase
    .from('feature_flag_cohorts')
    .select('flag_id, percentage')
    .eq('flag_id', FLAG_ID)
    .maybeSingle();
  return {
    flag: flag.data ?? { error: flag.error?.message },
    cohort: cohortRow.data ?? { error: cohortRow.error?.message },
  };
}

console.log('[rollout] avant :', JSON.stringify(await readState()));

if (enabled !== null) {
  const { error } = await supabase.from('feature_flags').update({ enabled }).eq('id', FLAG_ID);
  if (error) {
    console.error('[rollout] échec update flag:', error.message);
    process.exit(1);
  }
}

if (cohort !== null) {
  const { error } = await supabase
    .from('feature_flag_cohorts')
    .update({ percentage: cohort })
    .eq('flag_id', FLAG_ID);
  if (error) {
    console.error('[rollout] échec update cohorte:', error.message);
    process.exit(1);
  }
}

console.log('[rollout] après :', JSON.stringify(await readState()));
console.log(
  enabled === false
    ? '[rollout] ROLLBACK : /explorer sert à nouveau le moteur legacy.'
    : '[rollout] flag appliqué — /explorer sert le moteur unifié pour la population couverte.'
);
