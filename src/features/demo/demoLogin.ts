'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

/**
 * Connexion au compte de démonstration. Les identifiants vivent UNIQUEMENT
 * dans les variables d'environnement du serveur (DEMO_LOGIN_EMAIL,
 * DEMO_LOGIN_PASSWORD) : ils ne sont jamais envoyés au navigateur. Sans ces
 * variables, le bouton n'apparaît pas.
 */

function demoCredentials(): { email: string; password: string } | null {
  const email = process.env.DEMO_LOGIN_EMAIL?.trim();
  const password = process.env.DEMO_LOGIN_PASSWORD;
  return email && password ? { email, password } : null;
}

export async function demoLoginAvailableAction(): Promise<boolean> {
  return demoCredentials() != null;
}

export async function demoLoginAction(): Promise<
  { success: true } | { success: false; error: string }
> {
  const creds = demoCredentials();
  if (!creds) return { success: false, error: 'Compte de démonstration indisponible.' };
  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'inconnu';
    const limited = await enforceRateLimit(ip, {
      scope: 'demo-login',
      limit: 10,
      windowMs: 10 * 60_000,
      failMode: 'closed',
    });
    if (limited)
      return { success: false, error: 'Trop de connexions démo : réessaie dans quelques minutes.' };
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(creds);
    if (error) return { success: false, error: 'Connexion démo impossible pour le moment.' };
    return { success: true };
  } catch (err) {
    console.error('[demo] demoLoginAction', err instanceof Error ? err.message : 'erreur');
    return { success: false, error: 'Erreur serveur' };
  }
}
