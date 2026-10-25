/**
 * CHANTIER ATLAS — Phase 7 — Preuve du flag de rollout.
 *
 * Vérifie que :
 *   - le flag `explorer_unified_map_enabled` existe (valeur courante imprimée) ;
 *   - un client ANONYME peut lire `current_feature_flags()` (SSR /explorer sans session).
 *
 * Usage: node scripts/atlas/verify-rollout-flag.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('[rollout] env manquantes (URL / ANON / SERVICE).');
  process.exit(1);
}

async function readFlags(label, key) {
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc('current_feature_flags');
  if (error) {
    console.log(`FAIL ${label}: ${error.message}`);
    return { ok: false };
  }
  const flag = (data ?? []).find((row) => row.id === 'explorer_unified_map_enabled');
  console.log(`${label}: ${JSON.stringify(flag ?? null)}`);
  return { ok: Boolean(flag), enabled: flag?.enabled ?? null };
}

const anon = await readFlags('anon', anonKey);
const service = await readFlags('service_role', serviceKey);

let failed = 0;
if (!anon.ok) {
  console.error('FAIL le client anonyme ne peut pas lire current_feature_flags()');
  failed += 1;
}
if (!service.ok) {
  console.error('FAIL flag explorer_unified_map_enabled absent');
  failed += 1;
}

console.log(failed === 0 ? '\n[rollout] SUCCÈS (flag présent, lecture anonyme opérationnelle)' : `\n[rollout] ${failed} ÉCHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
