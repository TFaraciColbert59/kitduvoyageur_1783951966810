import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PendingCookie = { name: string; value: string; options?: Record<string, unknown> };

async function demoSession(): Promise<
  | { ok: true; pending: PendingCookie[] }
  | { ok: false; error: string; status: number }
> {
  // Même interrupteur que la route sœur `auth/demo` : sans lui, un simple GET
  // connectait n'importe qui au compte de démonstration (login CSRF).
  if (process.env.DEMO_AUTO_LOGIN !== 'true') {
    return { ok: false, error: 'Compte de démonstration désactivé.', status: 403 };
  }
  const email = process.env.DEMO_LOGIN_EMAIL?.trim();
  const password = process.env.DEMO_LOGIN_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!email || !password || !url || !anonKey) {
    return { ok: false, error: 'Compte de démonstration indisponible.', status: 503 };
  }

  const cookieStore = await cookies();
  const pending: PendingCookie[] = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items: PendingCookie[]) => {
        pending.push(...items);
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true, pending };

  // Secours : si le mot de passe enregistré ne correspond plus (réinitialisé
  // côté Supabase), on ouvre la session du compte démo par un lien de
  // connexion généré côté serveur avec la clé de service. Rien ne quitte le
  // serveur : le jeton est consommé immédiatement par `verifyOtp`.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const admin = createAdminClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = link?.properties?.hashed_token;
    if (!linkError && tokenHash) {
      pending.length = 0;
      const { error: otpError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
      if (!otpError) return { ok: true, pending };
    }
    console.error('[demo-login] secours lien de connexion :', linkError?.message ?? 'jeton absent ou refusé');
  }
  return { ok: false, error: 'Connexion démo impossible pour le moment.', status: 401 };
}

function applyCookies(response: NextResponse, pending: PendingCookie[]) {
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, {
      ...cookie.options,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
}

/** Lien direct : utilisable même si l’hydratation React n’a pas encore eu lieu. */
export async function GET(request: NextRequest) {
  const session = await demoSession();
  if (!session.ok) {
    const target = new URL('/connexion', request.url);
    target.searchParams.set('demo', session.error);
    return NextResponse.redirect(target, { status: 303 });
  }
  return applyCookies(NextResponse.redirect(new URL('/compte', request.url), { status: 303 }), session.pending);
}

export async function POST() {
  const session = await demoSession();
  if (!session.ok) {
    return NextResponse.json({ success: false, error: session.error }, { status: session.status });
  }
  return applyCookies(NextResponse.json({ success: true }), session.pending);
}
