import 'server-only';

/**
 * Identité des routes A08.
 *
 * Deux surfaces doivent fonctionner avec le même contrat :
 *   • l'application (cookies Supabase) ;
 *   • un assistant externe autorisé, qui présente un jeton Bearer.
 * Le client Supabase est construit avec ce jeton pour que la RLS s'applique
 * réellement : on ne remplace jamais l'autorisation par un client service.
 */

import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { createClient as createCookieClient } from '@/lib/supabase/server';

export interface AssistantIdentity {
  supabase: SupabaseClient;
  user: User;
  auth: 'cookie' | 'bearer';
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export async function resolveAssistantIdentity(request: Request): Promise<AssistantIdentity | null> {
  const token = readBearerToken(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (token) {
    if (!url || !anon) return null;
    const supabase = createSupabaseClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { supabase, user: data.user, auth: 'bearer' };
  }

  const supabase = await createCookieClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user, auth: 'cookie' };
}
