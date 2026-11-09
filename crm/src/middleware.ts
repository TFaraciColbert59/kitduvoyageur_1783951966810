import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv, idleMinutes, sessionMaxHours } from './lib/env';

const PUBLIC_PATHS = ['/connexion', '/double-authentification', '/acces-refuse', '/robots.txt'];
// Les routes /api/* font leur propre contrôle (session, aal2, rôle) et répondent
// en JSON ; le middleware ne doit pas les rediriger en HTML (401 typé attendu).
const PUBLIC_API = ['/api/'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request });
  if (PUBLIC_API.some((p) => pathname.startsWith(p)) || PUBLIC_PATHS.includes(pathname)) return response;

  try {
  const env = publicEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) =>
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options as never))
    }
  });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.redirect(new URL('/connexion', request.url));

  // Session 12 h max et verrou après 30 min d'inactivité (EX-AUTH-03).
  const now = Date.now();
  const started = Number(request.cookies.get('crm_started')?.value ?? now);
  const seen = Number(request.cookies.get('crm_seen')?.value ?? now);
  const expired = now - started > sessionMaxHours() * 3600_000 || now - seen > idleMinutes() * 60_000;
  if (expired) {
    await supabase.auth.signOut();
    const url = new URL('/connexion', request.url);
    url.searchParams.set('raison', 'session-expiree');
    return NextResponse.redirect(url);
  }
  response.cookies.set('crm_seen', String(now), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: idleMinutes() * 60 });
  response.cookies.set('crm_started', String(started), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: sessionMaxHours() * 3600 });

  // Double authentification obligatoire (EX-AUTH-02).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    if (pathname === '/double-authentification') return response;
    return NextResponse.redirect(new URL('/double-authentification', request.url));
  }

  // Rôle d'équipe lu en base (admin_roles + pôles), jamais dans le navigateur (EX-ROLE-05).
  const { data: role, error } = await supabase.rpc('my_role');
  if (error) {
    // Schéma admin absent (installation en attente) : message dédié, pas un refus d'accès.
    const code = (error as { code?: string }).code;
    if (code === '3F000' || /schema .*admin/i.test(error.message ?? '')) {
      return NextResponse.redirect(new URL('/installation', request.url));
    }
    return NextResponse.redirect(new URL('/acces-refuse', request.url));
  }
  if (!role) return NextResponse.redirect(new URL('/acces-refuse', request.url));
  response.headers.set('x-crm-role', String(role));
  return response;
  } catch {
    // Toute panne (variables absentes, réseau, base non installée) ramène à la
    // connexion : jamais d'écran blanc ni de 500 (05_UI_UX_DESIGN § 6).
    return NextResponse.redirect(new URL('/connexion', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)']
};
