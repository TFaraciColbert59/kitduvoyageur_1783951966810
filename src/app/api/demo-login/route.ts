import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const email = process.env.DEMO_LOGIN_EMAIL?.trim();
  const password = process.env.DEMO_LOGIN_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!email || !password || !url || !anonKey) {
    return NextResponse.json({ success: false, error: 'Compte de démonstration indisponible.' }, { status: 503 });
  }

  const cookieStore = await cookies();
  const pending: { name: string; value: string; options?: Record<string, unknown> }[] = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        pending.push(...items);
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ success: false, error: 'Connexion démo impossible pour le moment.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
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
