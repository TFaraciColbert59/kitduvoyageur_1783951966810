import 'server-only';

import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { getAssuranceLevel, requiresAal2 } from '@/server/admin/mfa';

/**
 * Garde admin serveur — À appeler en tête de chaque API `/api/admin/*`
 * et Server Action d'administration.
 *
 * Autorité canonique unique : `has_permission(code)` sur `user_roles`
 * (migration P0-02, sans repli `is_admin()`).
 * 401 si non authentifié, 503 si le contrôle de permission est
 * injoignable (fail-closed, jamais de bypass), 403 si refusé,
 * 403 si la permission exige AAL2 (MFA) et que la session est AAL1.
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
  if (permError) {
    // Fail-closed : contrôle injoignable → 503, jamais de repli is_admin().
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Contrôle des permissions indisponible' },
        { status: 503 }
      ),
    };
  }
  if (perm === true) {
    allowed = true;
  } else {
    // Élévation JIT active (≤ 8 h, auditée à l'octroi) : habilitation
    // temporaire explicite. Usage tracé par les audits de commandes.
    const { data: elevated } = await supabase.rpc('has_active_elevation', {
      p_code: code,
    });
    allowed = elevated === true;
  }

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accès interdit' }, { status: 403 }),
    };
  }

  // MFA imposée sur les permissions critiques (octroi de rôles, finances).
  if (requiresAal2(code)) {
    const level = await getAssuranceLevel(supabase);
    if (level !== 'aal2') {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Authentification à deux facteurs requise', code: 'mfa_required' },
          { status: 403 }
        ),
      };
    }
  }

  return { ok: true, ctx: { supabase, user } };
}
