import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';
import { apiError, translateDbError } from '@/lib/errors';
import type { StaffContext } from '@/lib/rpc';
import type { Database } from '@/types/db';

/**
 * Contexte d'appel d'une personne de l'équipe.
 *
 * Chaîne : session Supabase (cookie) → `aal2` → `admin.my_context()` en base.
 * Le rôle n'est jamais lu dans un en-tête ou un cookie : la base est la vérité.
 */
export type StaffSession = {
  client: SupabaseClient<Database>;
  user: { id: string; email: string | null };
  context: StaffContext;
  role: StaffContext['role'];
  poles: StaffContext['poles'];
  solo: boolean;
};

export async function requireStaffSession(): Promise<StaffSession> {
  const client = await supabaseServer();

  const { data: userData, error: userError } = await client.auth.getUser();
  const user = userData?.user ?? null;
  if (userError || !user) throw apiError('unauthenticated');

  // EX-AUTH-02 : aucune action métier sans second facteur vérifié.
  const { data: aal, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) throw apiError('mfa_required');
  if (aal?.currentLevel !== 'aal2') throw apiError('mfa_required');

  // `admin.my_context()` renvoie le rôle, les pôles et le mode solo calculés en base.
  const { data, error } = await client.schema('admin').rpc('my_context', {});
  if (error) throw translateDbError(error);

  const raw = (data ?? null) as Partial<StaffContext> | null;
  if (!raw || typeof raw !== 'object') throw apiError('server_error');

  const context: StaffContext = {
    role: (raw.role ?? null) as StaffContext['role'],
    poles: Array.isArray(raw.poles) ? raw.poles : [],
    solo: Boolean(raw.solo),
    staff: Boolean(raw.staff),
    display_name: raw.display_name ?? null,
    email: raw.email ?? null
  };

  if (!context.staff) throw apiError('staff_only');

  return {
    client,
    user: { id: user.id, email: user.email ?? null },
    context,
    role: context.role,
    poles: context.poles,
    solo: context.solo
  };
}

/** Vrai si la personne est super admin (facultatif côté UI, jamais seul contrôle). */
export function isSuperAdmin(session: StaffSession): boolean {
  return session.role === 'super_admin';
}

/** Le pôle de l'appelant lui est-il accessible ? (miroir d'`admin.can`, jamais seul contrôle) */
export function belongsToPole(session: StaffSession, pole: string): boolean {
  if (session.role === 'super_admin') return true;
  return session.poles.some((entry) => entry.code === pole);
}
