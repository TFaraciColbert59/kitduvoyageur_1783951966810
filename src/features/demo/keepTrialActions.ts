'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  KEEP_TRIAL_RETURN,
  KEEP_TRIAL_TEXT,
  keepTrialEmailSchema,
  keepTrialEnabled,
  keepTrialFailure,
  keepTrialPasswordSchema,
  type KeepTrialResult,
} from './keepTrial';

/**
 * Garder son essai (plan 2.3) : voir `keepTrial.ts` pour le parcours. Deux actions, pour la
 * personne connectée seulement :
 *  - `keepTrialEmailAction` : lie un e-mail à la session anonyme (e-mail de confirmation) ;
 *  - `keepTrialPasswordAction` : une fois l'e-mail confirmé (la session n'est plus anonyme),
 *    choisit un mot de passe pour se reconnecter ailleurs.
 * Éteint sans `NEXT_PUBLIC_KEEP_TRIAL=on`. Aucun jeton hCaptcha : Supabase ne le demande pas
 * pour `updateUser` (connexion, inscription, essai et mot de passe oublié seulement).
 */

const fail = (error: string, code: Extract<KeepTrialResult, { success: false }>['code']): KeepTrialResult => ({
  success: false,
  error,
  code,
});

/** L'origine du site pour le lien de l'e-mail (aperçu, production), jamais un hôte non http(s). */
async function siteOrigin(): Promise<string | null> {
  const h = await headers();
  const raw =
    h.get('origin') ??
    (h.get('host') ? `${h.get('x-forwarded-proto') === 'http' ? 'http' : 'https'}://${h.get('host')}` : null);
  try {
    const u = new URL(raw ?? '');
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
}

export async function keepTrialEmailAction(input: unknown): Promise<KeepTrialResult> {
  if (!keepTrialEnabled()) return fail(KEEP_TRIAL_TEXT.disabled, 'disabled');
  const parsed = keepTrialEmailSchema.safeParse(input);
  if (!parsed.success) return fail(KEEP_TRIAL_TEXT.invalidEmail, 'invalid');
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail(KEEP_TRIAL_TEXT.signedOut, 'signed_out');
    if (user.is_anonymous !== true) return fail(KEEP_TRIAL_TEXT.notTrial, 'not_trial');

    // Chaque envoi est un e-mail (quota de Supabase, partagé par tout le site) : peu par essai, plafond pour le site.
    const mine = await enforceRateLimit(user.id, {
      scope: 'keep-trial',
      limit: 5,
      windowMs: 60 * 60_000,
      failMode: 'closed',
    });
    const site = mine
      ? null
      : await enforceRateLimit('site', {
          scope: 'keep-trial-global',
          limit: 200,
          windowMs: 24 * 60 * 60_000,
          failMode: 'closed',
        });
    if (mine || site) return fail(KEEP_TRIAL_TEXT.limited, 'limited');

    const origin = await siteOrigin();
    const { error } = await supabase.auth.updateUser(
      { email: parsed.data.email },
      origin ? { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(KEEP_TRIAL_RETURN)}` } : undefined
    );
    if (error) {
      // Le code seulement : le texte de Supabase peut citer l'adresse.
      console.warn('[garder-essai] updateUser(email)', (error as { code?: string }).code ?? error.name);
      const { error: message, code } = keepTrialFailure(error);
      return fail(message, code);
    }
    return { success: true };
  } catch (err) {
    console.error('[garder-essai] keepTrialEmailAction', err instanceof Error ? err.name : 'erreur');
    return fail(KEEP_TRIAL_TEXT.unavailable, 'unavailable');
  }
}

export async function keepTrialPasswordAction(input: unknown): Promise<KeepTrialResult> {
  const parsed = keepTrialPasswordSchema.safeParse(input);
  if (!parsed.success) return fail(KEEP_TRIAL_TEXT.invalidPassword, 'invalid');
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail(KEEP_TRIAL_TEXT.signedOut, 'signed_out');
    // Avant la confirmation de l'e-mail, Supabase refuse un mot de passe à une session anonyme.
    if (user.is_anonymous === true) return fail(KEEP_TRIAL_TEXT.confirmFirst, 'unconfirmed');

    const mine = await enforceRateLimit(user.id, {
      scope: 'keep-trial-password',
      limit: 10,
      windowMs: 60 * 60_000,
      failMode: 'closed',
    });
    if (mine) return fail(KEEP_TRIAL_TEXT.limited, 'limited');

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      console.warn('[garder-essai] updateUser(password)', (error as { code?: string }).code ?? error.name);
      const { error: message, code } = keepTrialFailure(error);
      return fail(message, code);
    }
    return { success: true };
  } catch (err) {
    console.error('[garder-essai] keepTrialPasswordAction', err instanceof Error ? err.name : 'erreur');
    return fail(KEEP_TRIAL_TEXT.unavailable, 'unavailable');
  }
}
