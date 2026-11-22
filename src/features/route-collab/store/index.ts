import type { SupabaseClient } from '@supabase/supabase-js';
import { memoryRouteCollabStore } from './memoryStore';
import { createSupabaseRouteCollabStore } from './supabaseStore';
import type { RouteCollabStore } from './types';

export { RouteCollabStoreError } from './types';
export type { GroupedRouteNotification, RouteCollabStore } from './types';

/**
 * Supabase si l'URL et la clé anon sont définies, hors Vitest, et sauf `ROUTE_COLLAB_STORE=memory`
 * (repli explicite pour le développement local) ; sinon le store mémoire.
 */
export function shouldUseSupabaseRouteCollabStore(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VITEST) return false;
  if (env.ROUTE_COLLAB_STORE === 'memory') return false;
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Retourne le store à utiliser pour la requête courante. En mode Supabase, le client doit être celui
 * de l'utilisateur (cookies de session, RLS active) : il est créé ici s'il n'est pas fourni.
 */
export async function getRouteCollabStore(supabase?: SupabaseClient): Promise<RouteCollabStore> {
  if (!shouldUseSupabaseRouteCollabStore()) return memoryRouteCollabStore;
  if (supabase) return createSupabaseRouteCollabStore(supabase);
  const { createClient } = await import('@/lib/supabase/server');
  return createSupabaseRouteCollabStore(await createClient());
}
