import 'server-only';

import { createClient } from '@/lib/supabase/server';

/**
 * Lit l'identité du spectateur sans jamais faire échouer une route publique :
 * une configuration Supabase absente ou un cookie illisible équivaut à un
 * visiteur anonyme (les scopes privés restent fail-closed côté service).
 */
export async function getLeaderboardViewerId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
