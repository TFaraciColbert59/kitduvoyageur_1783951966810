import 'server-only';

import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

/**
 * Garde admin serveur — À appeler en tête de chaque API `/api/admin/*`
 * et Server Action d'administration.
 *
 * 401 si non authentifié, 403 si `has_permission(code)` est faux
 * (avec repli `is_admin()` si la migration RBAC n'est pas encore appliquée).
 * Retourne le client RLS de l'appelant : les lectures/écritures restent
 * soumises aux policies (défense en profondeur, jamais de service_role ici).
 */

export interface AdminContext {
  supabase: SupabaseClient;
  user: User;
}

export type AdminResolution =
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse };

export async function requireAdmin(
  code: string = 'users.read'
): Promise<AdminResolution> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentification requise' }, { status: 401 }),
    };
  }

  let allowed = false;
  const { data: perm, error: permError } = await supabase.rpc('has_permission', {
    p_code: code,
  });
  if (!permError && perm === true) {
    allowed = true;
  } else {
    // Filet : migration RBAC pas encore déployée → ancien prédicat.
    const { data: legacy } = await supabase.rpc('is_admin');
    allowed = legacy === true;
  }

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accès interdit' }, { status: 403 }),
    };
  }

  return { ok: true, ctx: { supabase, user } };
}
