import { createClient } from '@/lib/supabase/server';
import { fail } from './respond';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type RequireUserResult =
  | { ok: true; supabase: SupabaseServerClient; user: { id: string; email?: string | null } }
  | { ok: false; response: ReturnType<typeof fail> };

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: fail('unauthorized', 'Session requise.') };
  }
  return { ok: true, supabase, user: { id: data.user.id, email: data.user.email } };
}
