import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Auto-login du compte de démonstration.
 *
 * Désactivé par défaut : il faut DEMO_AUTO_LOGIN=true côté serveur et
 * NEXT_PUBLIC_DEMO_AUTO_LOGIN=true côté client. Les identifiants restent
 * uniquement dans les variables d'environnement serveur, jamais dans le bundle.
 */
export async function POST() {
  if (process.env.DEMO_AUTO_LOGIN !== 'true') {
    return NextResponse.json({ error: 'demo_disabled' }, { status: 404 });
  }

  const email = process.env.DEMO_LOGIN_EMAIL;
  const password = process.env.DEMO_LOGIN_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: 'demo_unavailable' }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return NextResponse.json({ ok: true, already: true });

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json({ error: 'demo_login_failed' }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'demo_login_failed' }, { status: 500 });
  }
}
