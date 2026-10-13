import { z } from 'zod';

/**
 * Mot de passe oublié : le parcours complet.
 *  1. `/connexion` : `resetPasswordForEmail(email, { redirectTo })`, avec `redirectTo` =
 *     `passwordResetRedirectTo(origin)` (jamais `/connexion` : rien n'y échange le code) ;
 *  2. le lien du courriel ouvre `/auth/callback?code=…&next=/connexion/nouveau-mot-de-passe` :
 *     la route échange le code PKCE contre une session (`exchangeCodeForSession`), puis renvoie
 *     vers `next` (chemin du site seulement, `safeNextPath`) ;
 *  3. `/connexion/nouveau-mot-de-passe` : `updateUser({ password })` sur cette session.
 * Module PUR (importable par le navigateur et les tests). Le code PKCE s'échange dans le navigateur
 * qui a demandé le lien (le vérificateur y est gardé) : un lien ouvert ailleurs échoue, et la page
 * le dit au lieu d'un échec muet.
 */

/** Page où l'on choisit son nouveau mot de passe (arrivée du lien du courriel). */
export const PASSWORD_RESET_PATH = '/connexion/nouveau-mot-de-passe';

/** Page de demande du lien (le formulaire « Mot de passe oublié » de la connexion). */
export const PASSWORD_FORGOT_PATH = '/connexion?oubli=1';

/** Où va la personne une fois le mot de passe changé. */
export const PASSWORD_RESET_DONE_PATH = '/compte';

/**
 * L'adresse que Supabase met dans le lien du courriel. Elle doit figurer dans les URL de
 * redirection autorisées de Supabase (sinon Supabase retombe sur l'adresse du site, sans chemin).
 */
export function passwordResetRedirectTo(origin: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(PASSWORD_RESET_PATH)}`;
}

/** Le retour de `/auth/callback` est-il celui du mot de passe oublié ? (`next` déjà validé) */
export function isPasswordResetPath(next: string): boolean {
  return next === PASSWORD_RESET_PATH || next.startsWith(`${PASSWORD_RESET_PATH}?`);
}

/** 8 caractères au moins (comme l'inscription), 72 au plus (limite de bcrypt), deux saisies identiques. */
export const newPasswordSchema = z
  .object({
    password: z.string().min(8).max(72),
    confirm: z.string().max(72),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'differ' });

export type PasswordResetFailure =
  | 'invalid'
  | 'mismatch'
  | 'signed_out'
  | 'limited'
  | 'weak'
  | 'reauth'
  | 'unavailable';

export type PasswordResetResult =
  | { success: true }
  | { success: false; error: string; code: PasswordResetFailure };

export const PASSWORD_RESET_TEXT = {
  invalid: 'Choisis un mot de passe de 8 à 72 caractères.',
  mismatch: 'Les deux mots de passe ne sont pas identiques.',
  signedOut:
    'Ce lien n’est plus valable : il ne sert qu’une fois et expire au bout d’un moment. Demande-en un nouveau.',
  linkFailed:
    'Le lien n’a pas pu s’ouvrir ici. Ouvre-le dans le navigateur, sur l’appareil, où tu as demandé la réinitialisation. Il ne sert qu’une fois et expire au bout d’un moment : au besoin, demande-en un nouveau.',
  limited: 'Beaucoup d’essais depuis cette connexion : réessaie dans une heure.',
  weak: 'Ce mot de passe n’est pas accepté : choisis-en un autre, plus long ou moins courant, et différent de l’ancien.',
  reauth: 'Pour des raisons de sécurité, demande un nouveau lien depuis « Mot de passe oublié », puis réessaie.',
  unavailable: 'Erreur du service : réessaie dans un instant. Ton mot de passe n’a pas changé.',
  done: 'Mot de passe changé. Tu es connecté·e.',
} as const;

/**
 * Message honnête pour une erreur de Supabase Auth (codes documentés : `weak_password`,
 * `same_password`, `reauthentication_needed`, `over_request_rate_limit`, `session_not_found`…).
 * Jamais le texte brut de l'erreur.
 */
export function passwordResetFailure(error: unknown): { error: string; code: PasswordResetFailure } {
  const e = (error && typeof error === 'object' ? error : {}) as { code?: unknown; status?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  if (code === 'weak_password' || code === 'same_password') return { error: PASSWORD_RESET_TEXT.weak, code: 'weak' };
  if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid')
    return { error: PASSWORD_RESET_TEXT.reauth, code: 'reauth' };
  if (code === 'session_not_found' || code === 'session_expired' || code === 'refresh_token_not_found' || e.status === 401)
    return { error: PASSWORD_RESET_TEXT.signedOut, code: 'signed_out' };
  if (code === 'over_request_rate_limit' || e.status === 429) return { error: PASSWORD_RESET_TEXT.limited, code: 'limited' };
  return { error: PASSWORD_RESET_TEXT.unavailable, code: 'unavailable' };
}
