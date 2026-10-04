import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /auth/callback?code=…&next=/compte — retour OAuth/SSO (PKCE).
 * Échange le code contre une session, puis redirige vers `next`
 * (chemin relatif interne uniquement, anti open-redirect).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const rawNext = req.nextUrl.searchParams.get('next');
  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/compte';

  if (!code) {
    return NextResponse.redirect(new URL('/connexion?error=sso', req.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/connexion?error=sso', req.url));
  }

  // Bootstrap profil (les flux email le font côté client ; le SSO atterrit
  // ici). Upsert idempotent, politique RLS own-profile.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const fullName =
        (meta['full_name'] as string) ||
        (meta['name'] as string) ||
        (user.email ?? '').split('@')[0];
      await supabase.from('user_profiles').upsert(
        {
          id: user.id,
          email: user.email ?? '',
          full_name: fullName,
          trust_score: 50,
          loyalty_points: 0,
          loyalty_level: 'Explorateur',
          xp: 0,
          level: 1,
        },
        { onConflict: 'id', ignoreDuplicates: false }
      );
    }
  } catch {
    // Profil créé à la première visite dans ce cas ; ne bloque pas la connexion.
  }
  return NextResponse.redirect(new URL(next, req.url));
}
