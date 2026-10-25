/**
 * Pont entre le runtime du Compte et `user_profiles`.
 *
 * Deux réglages voisins mais distincts :
 * - `signature_visibility` (`private | communaute | public`) porte la
 *   visibilité de l'empreinte et des carnets ;
 * - `profile_visibility` (`public | prive`) porte la confidentialité du
 *   compte, seule valeur acceptée par le CHECK de la migration
 *   `20261022100000_profile_visibility_invitations.sql`.
 *
 * Aucune traduction n'est inventée : `world` est une valeur de carnet, jamais
 * une valeur de signature ; une valeur inconnue est rejetée (`null`).
 */

export type AccountVisibility = 'public' | 'prive';
export type SignatureVisibility = 'private' | 'communaute' | 'public';

/** Événement émis par le pont après une tentative de persistance. */
export const PROFILE_VISIBILITY_EVENT = 'lkdv:profile-visibility';

export interface ProfileVisibilityEventDetail {
  value: AccountVisibility;
  persisted: boolean;
  /** Valeur rétablie côté runtime quand la persistance a échoué. */
  revertedTo?: AccountVisibility;
}

/** Résout une valeur runtime exacte de confidentialité du compte. */
export function toAccountVisibility(value: unknown): AccountVisibility | null {
  return value === 'public' || value === 'prive' ? value : null;
}

/** Charge utile Supabase : jamais de valeur hors du CHECK `public|prive`. */
export function accountVisibilityUpdate(value: unknown): {
  profile_visibility: AccountVisibility;
} | null {
  const target = toAccountVisibility(value);
  return target ? { profile_visibility: target } : null;
}

/**
 * Index historique du runtime (`S.vis`) → colonne `signature_visibility`.
 * `1` est la communauté ; `world` est réservé aux carnets et serait rejeté
 * par le CHECK (`private | communaute | public`).
 */
export function signatureVisibilityForValue(
  value: unknown
): SignatureVisibility | null {
  if (value === 0 || value === '0') return 'private';
  if (value === 1 || value === '1') return 'communaute';
  if (value === 2 || value === '2') return 'public';
  return null;
}
