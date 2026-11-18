import { createClient } from '@/lib/supabase/server';

export async function getAuthenticatedRouteActor(): Promise<{
  userId: string;
  displayName: string;
} | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const displayName =
      (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
      (typeof meta.name === 'string' && meta.name.trim()) ||
      user.email?.split('@')[0] ||
      `Voyageur ${user.id.slice(0, 6)}`;
    return { userId: user.id, displayName };
  } catch {
    return null;
  }
}
