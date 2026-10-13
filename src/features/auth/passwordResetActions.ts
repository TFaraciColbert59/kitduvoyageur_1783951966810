'use server';

import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  newPasswordSchema,
  PASSWORD_RESET_TEXT,
  passwordResetFailure,
  type PasswordResetFailure,
  type PasswordResetResult,
} from './passwordReset';

/**
 * Nouveau mot de passe (après le lien du courriel « mot de passe oublié ») : `updateUser({ password })`
 * sur la session que `/auth/callback` vient d'ouvrir. Aucun jeton hCaptcha : Supabase ne le demande
 * pas pour `updateUser` (connexion, inscription, essai et mot de passe oublié seulement ; le captcha
 * du flux est déjà passé à la demande du lien).
 */

const fail = (error: string, code: PasswordResetFailure): PasswordResetResult => ({ success: false, error, code });

export async function newPasswordAction(input: unknown): Promise<PasswordResetResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((i) => i.message === 'differ');
    return mismatch ? fail(PASSWORD_RESET_TEXT.mismatch, 'mismatch') : fail(PASSWORD_RESET_TEXT.invalid, 'invalid');
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Pas de session (lien expiré, déjà servi, ouvert ailleurs) ou essai anonyme : rien à changer ici.
    if (!user || user.is_anonymous === true) return fail(PASSWORD_RESET_TEXT.signedOut, 'signed_out');

    const mine = await enforceRateLimit(user.id, {
      scope: 'password-reset',
      limit: 10,
      windowMs: 60 * 60_000,
      failMode: 'closed',
    });
    if (mine) return fail(PASSWORD_RESET_TEXT.limited, 'limited');

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      // Le code seulement : le texte de Supabase peut citer l'adresse.
      console.warn('[mot-de-passe] updateUser(password)', (error as { code?: string }).code ?? error.name);
      const { error: message, code } = passwordResetFailure(error);
      return fail(message, code);
    }
    return { success: true };
  } catch (err) {
    console.error('[mot-de-passe] newPasswordAction', err instanceof Error ? err.name : 'erreur');
    return fail(PASSWORD_RESET_TEXT.unavailable, 'unavailable');
  }
}
