'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '../env';
import type { Database } from '../../types/db';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Client navigateur en LECTURE SEULE : RPC admin.* contrôlées et Realtime.
 * Toute écriture passe par /api/cmd (EX-GEN-04).
 */
export function supabaseBrowser() {
  if (client) return client;
  const env = publicEnv();
  client = createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return client;
}
