import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readRouteViewMode, type RouteViewMode } from '../uiPrefs';

/** Lecture / écriture des préférences du compte courant, sous RLS (`user_id = auth.uid()`). */
export async function getRouteViewModeForUser(supabase: SupabaseClient, userId: string): Promise<RouteViewMode | null | 'error'> {
  const { data, error } = await supabase.from('user_ui_prefs').select('prefs').eq('user_id', userId).maybeSingle();
  if (error) return 'error';
  return readRouteViewMode((data as { prefs?: unknown } | null)?.prefs);
}

export async function setRouteViewModeForUser(supabase: SupabaseClient, userId: string, mode: RouteViewMode): Promise<boolean> {
  // Fusion : les autres clés éventuelles du compte sont conservées.
  const { data: row, error: readError } = await supabase.from('user_ui_prefs').select('prefs').eq('user_id', userId).maybeSingle();
  if (readError) return false;
  const current = (row as { prefs?: unknown } | null)?.prefs;
  const base = current && typeof current === 'object' && !Array.isArray(current) ? (current as Record<string, unknown>) : {};
  const { error } = await supabase
    .from('user_ui_prefs')
    .upsert({ user_id: userId, prefs: { ...base, routeViewMode: mode }, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return !error;
}
