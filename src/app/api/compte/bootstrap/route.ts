import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadAccountBootstrap } from '@/features/compte/data/accountBootstrap';
import { getCached, setCached, userCacheKey } from '@/lib/perf/userMemo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    const cacheKey = userId ? userCacheKey(userId, 'bootstrap') : null;
    const cached = cacheKey ? getCached<Record<string, unknown>>(cacheKey) : null;
    const payload = cached ?? (await loadAccountBootstrap(supabase));
    if (cacheKey && !cached) setCached(cacheKey, payload, 15_000);
    const response = NextResponse.json(payload);
    response.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=45');
    return response;
  } catch {
    // Une erreur de lecture ne doit jamais casser le Compte : le runtime
    // conserve ses données de démonstration et l'erreur reste côté serveur.
    return NextResponse.json({ authenticated: false, error: 'bootstrap_unavailable' });
  }
}
