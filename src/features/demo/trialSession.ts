'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { anonymousSignInsEnabled } from './anonymousSettings';

/**
 * Essai sans compte (plan 2.3, audit du 8 octobre) : chaque visiteur reçoit
 * son propre espace (session anonyme Supabase) au lieu du compte démo partagé,
 * où chacun voyait et changeait les voyages des autres.
 *
 * Rien à configurer côté site : dès que les connexions anonymes sont allumées
 * dans Supabase Auth, l'essai remplace la connexion démo. Les espaces d'essai
 * ne publient rien (politiques `essai_sans_ecriture_publique`) et sont purgés
 * après 7 jours sans activité (`purge_anonymous_users`).
 */

export async function trialLoginAvailableAction(): Promise<boolean> {
  return anonymousSignInsEnabled();
}

export async function trialLoginAction(captchaToken?: string): Promise<
  { success: true } | { success: false; error: string }
> {
  if (!(await anonymousSignInsEnabled()))
    return { success: false, error: 'Essai sans compte indisponible pour le moment.' };
  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'inconnu';
    // Chaque essai est un compte en base : peu par adresse, plafond pour le site.
    const mine = await enforceRateLimit(ip, {
      scope: 'trial-login',
      limit: 5,
      windowMs: 60 * 60_000,
      failMode: 'closed',
    });
    const site = mine
      ? null
      : await enforceRateLimit('site', {
          scope: 'trial-login-global',
          limit: 300,
          windowMs: 24 * 60 * 60_000,
          failMode: 'closed',
        });
    if (mine || site)
      return {
        success: false,
        error: mine
          ? 'Beaucoup d’essais depuis cette connexion : réessaie dans une heure, ou crée un compte.'
          : 'Beaucoup d’essais aujourd’hui : crée un compte pour commencer tout de suite.',
      };
    const supabase = await createClient();
    // Jeton hCaptcha du navigateur : Supabase le vérifie si la protection est allumée.
    const token = typeof captchaToken === 'string' && captchaToken.length <= 10_000 ? captchaToken : undefined;
    const { error } = await supabase.auth.signInAnonymously(token ? { options: { captchaToken: token } } : undefined);
    if (error) {
      console.warn('[essai] signInAnonymously', error.message);
      return { success: false, error: 'Essai sans compte impossible pour le moment.' };
    }
    return { success: true };
  } catch (err) {
    console.error('[essai] trialLoginAction', err instanceof Error ? err.message : 'erreur');
    return { success: false, error: 'Erreur serveur' };
  }
}
