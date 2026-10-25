import { z } from 'zod';

/**
 * Garder son essai (plan 2.3) : une personne en essai sans compte (session anonyme Supabase)
 * lie un e-mail à SA session au lieu de créer un nouveau compte qui perdrait son voyage.
 * Module PUR (importable par le navigateur et les tests).
 *
 * Parcours, tel que Supabase le décrit (« Convert an anonymous user to a permanent user ») :
 *  1. `updateUser({ email })` sur la session anonyme : un e-mail de confirmation part ;
 *  2. la personne ouvre le lien (retour par `/auth/callback`) : la session devient un compte
 *     (`is_anonymous` faux), le voyage est le même, la purge à 7 jours ne le touche plus ;
 *  3. seulement ensuite, `updateUser({ password })` : Supabase n'accepte pas de mot de passe
 *     avant que l'e-mail soit vérifié.
 * Demande « Allow manual linking » allumé dans Supabase (Authentication → Sign In / Providers).
 * D'où un interrupteur, éteint par défaut : `NEXT_PUBLIC_KEEP_TRIAL=on`.
 */

/** Page du parcours (formulaire d'e-mail, puis choix du mot de passe). */
export const KEEP_TRIAL_PATH = '/compte/garder-mon-essai';
/** Retour du lien de confirmation (via /auth/callback) : la page sait que l'e-mail vient d'être confirmé. */
export const KEEP_TRIAL_RETURN = KEEP_TRIAL_PATH + '?lien=ok';

/** Interrupteur d'environnement : seule la valeur `on` allume (éteint par défaut). */
export function keepTrialEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.NEXT_PUBLIC_KEEP_TRIAL?.trim().toLowerCase() === 'on';
}

export const keepTrialEmailSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254).email(),
});

/** 8 caractères au moins (comme l'inscription), 72 au plus (limite de bcrypt). */
export const keepTrialPasswordSchema = z.object({
  password: z.string().min(8).max(72),
});

export type KeepTrialResult =
  | { success: true }
  | { success: false; error: string; code: KeepTrialFailure };

export type KeepTrialFailure =
  | 'disabled'
  | 'signed_out'
  | 'not_trial'
  | 'unconfirmed'
  | 'invalid'
  | 'limited'
  | 'refused'
  | 'exists'
  | 'unavailable';

export const KEEP_TRIAL_TEXT = {
  disabled:
    'Garder ton essai n’est pas encore ouvert. Ton voyage reste là 7 jours sans visite ; tu peux aussi créer un compte, mais il ne reprendra pas ce voyage.',
  signedOut: 'Ouvre d’abord ton essai pour pouvoir le garder.',
  confirmFirst: 'Confirme d’abord ton e-mail (le lien que tu as reçu), puis choisis ton mot de passe.',
  notTrial: 'Tu as déjà un compte : il n’y a rien à garder.',
  invalidEmail: 'Cette adresse e-mail ne ressemble pas à une adresse valide.',
  invalidPassword: 'Choisis un mot de passe de 8 à 72 caractères.',
  limited: 'Beaucoup d’essais depuis cette connexion : réessaie dans une heure.',
  /** Supabase refuse sans dire pourquoi à la personne : ce qu'on sait, sans détail technique. */
  refused:
    'Supabase n’a pas accepté le lien pour le moment. Ton essai reste tel quel, rien n’est perdu : réessaie plus tard.',
  /** « Allow manual linking » éteint côté Supabase : le dire franchement. */
  linkingOff:
    'Garder ton essai n’est pas ouvert pour le moment (réglage du service). Ton voyage reste là 7 jours sans visite ; réessaie plus tard.',
  exists:
    'Cette adresse a déjà un compte. Connecte-toi avec : ton voyage d’essai ne se déplace pas tout seul vers un compte existant, il restera ici 7 jours sans visite.',
  mailLimit: 'Trop d’e-mails envoyés pour le moment : réessaie dans un moment.',
  mailRefused:
    'Le service ne peut pas envoyer d’e-mail à cette adresse pour le moment. Essaie une autre adresse ou réessaie plus tard.',
  unavailable: 'Erreur du service : réessaie dans un instant. Ton essai n’est pas touché.',
  sameOrWeak: 'Ce mot de passe n’est pas assez solide : choisis-en un autre, plus long ou moins courant.',
  sent: 'Un e-mail de confirmation vient de partir. Ouvre le lien sur cet appareil, dans ce navigateur : ton voyage devient alors ton compte.',
  passwordDone: 'Mot de passe enregistré. Tu pourras te reconnecter avec ton e-mail et ce mot de passe.',
} as const;

/**
 * Message honnête pour une erreur de Supabase Auth (codes documentés : `manual_linking_disabled`,
 * `email_exists`, `over_email_send_rate_limit`, `email_address_invalid`, `email_address_not_authorized`,
 * `weak_password`, `same_password`...). Jamais le texte brut de l'erreur : il peut citer l'adresse.
 */
export function keepTrialFailure(error: unknown): { error: string; code: KeepTrialFailure } {
  const e = (error && typeof error === 'object' ? error : {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  if (code === 'manual_linking_disabled' || message.includes('manual linking'))
    return { error: KEEP_TRIAL_TEXT.linkingOff, code: 'disabled' };
  if (code === 'email_exists' || code === 'user_already_exists' || code === 'identity_already_exists' || message.includes('already been registered'))
    return { error: KEEP_TRIAL_TEXT.exists, code: 'exists' };
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || e.status === 429)
    return { error: KEEP_TRIAL_TEXT.mailLimit, code: 'limited' };
  if (code === 'email_address_invalid') return { error: KEEP_TRIAL_TEXT.invalidEmail, code: 'invalid' };
  if (code === 'email_address_not_authorized') return { error: KEEP_TRIAL_TEXT.mailRefused, code: 'refused' };
  if (code === 'weak_password' || code === 'same_password') return { error: KEEP_TRIAL_TEXT.sameOrWeak, code: 'invalid' };
  if (code === 'anonymous_provider_disabled' || code === 'signup_disabled' || code === 'email_provider_disabled')
    return { error: KEEP_TRIAL_TEXT.refused, code: 'refused' };
  if (typeof e.status === 'number' && e.status >= 500) return { error: KEEP_TRIAL_TEXT.unavailable, code: 'unavailable' };
  return { error: KEEP_TRIAL_TEXT.refused, code: 'refused' };
}
