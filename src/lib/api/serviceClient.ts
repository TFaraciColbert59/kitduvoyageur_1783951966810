import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client service_role réservé aux routes serveur qui ont déjà vérifié
 * l'autorisation de l'appelant. Retourne `null` quand la clé n'est pas
 * configurée : l'appelant garde alors son chemin RLS normal.
 */
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
