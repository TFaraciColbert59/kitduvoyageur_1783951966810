/**
 * CHANTIER ATLAS — Phase 6 — Preuve brute des privilèges de fonction.
 *
 * Capture `has_function_privilege` pour :
 *   - trails_in_viewport   : anon/authenticated/service_role = EXECUTE (lecture publique)
 *   - refresh_atlas_density: service_role uniquement (anon/authenticated = false)
 *
 * Usage: node scripts/atlas/verify-function-grants.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[grants] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase.rpc('atlas_debug_function_privileges');
if (error) {
  console.error('[grants] erreur sonde:', error.message);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));

const rows = data ?? [];
const expect = (functionName, roleName, expected) => {
  const row = rows.find((r) => r.function_name === functionName && r.role_name === roleName);
  if (!row) {
    console.error(`FAIL ${functionName} / ${roleName}: ligne absente`);
    return false;
  }
  const ok = row.can_execute === expected;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${functionName} / ${roleName}: can_execute=${row.can_execute} (attendu ${expected})`);
  return ok;
};

let failed = 0;
failed += expect('trails_in_viewport', 'anon', true) ? 0 : 1;
failed += expect('trails_in_viewport', 'authenticated', true) ? 0 : 1;
failed += expect('refresh_atlas_density', 'anon', false) ? 0 : 1;
failed += expect('refresh_atlas_density', 'authenticated', false) ? 0 : 1;
failed += expect('refresh_atlas_density', 'service_role', true) ? 0 : 1;

console.log(failed === 0 ? '\n[grants] SUCCÈS' : `\n[grants] ${failed} ÉCHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
