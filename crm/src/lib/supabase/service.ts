import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/db';

/**
 * Clé service_role : trois usages seulement (02_ARCHITECTURE § 3) —
 * API admin d'Auth, tâches planifiées, amorçage des comptes d'agents.
 * Import interdit hors de src/server/** (règle ESLint).
 */
export function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('service_role_unavailable');
  }
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
