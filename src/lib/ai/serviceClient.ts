import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase SERVICE ROLE — SERVEUR UNIQUEMENT, partagé par les couches
 * IA (cache, quota, jobs, push). Bypass RLS : n'appeler que des fonctions
 * SECURITY DEFINER ou des tables service-only. Jamais exposé au client.
 * Memoïsé ; clé absente → null (couches appelantes dégradent gracieusement).
 */

let cached: SupabaseClient | null | undefined;

export function getServiceSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('[ai/serviceClient] SUPABASE_SERVICE_ROLE_KEY absente — couches IA dégradées');
    cached = null;
    return null;
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
