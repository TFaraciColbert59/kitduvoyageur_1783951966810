// Préférences d'interface par compte (4.1) : GET lit, PUT écrit `routeViewMode` (simple | expert) dans
// `user_ui_prefs` sous RLS. Session exigée, entrée validée par zod (clé unique, `.strict()`).
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api/requireUser';
import { ok, fail } from '@/lib/api/respond';
import { uiPrefsPutSchema } from '@/features/route-collab/uiPrefs';
import { getRouteViewModeForUser, setRouteViewModeForUser } from '@/features/route-collab/server/uiPrefs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const mode = await getRouteViewModeForUser(auth.supabase as unknown as SupabaseClient, auth.user.id);
  if (mode === 'error') return fail('server', 'prefs_indisponibles');
  return ok({ routeViewMode: mode });
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail('bad_request', 'json_invalide');
  }
  const parsed = uiPrefsPutSchema.safeParse(json);
  if (!parsed.success) return fail('bad_request', 'entree_invalide');
  const done = await setRouteViewModeForUser(auth.supabase as unknown as SupabaseClient, auth.user.id, parsed.data.routeViewMode);
  if (!done) return fail('server', 'ecriture_impossible');
  return ok({ routeViewMode: parsed.data.routeViewMode });
}
