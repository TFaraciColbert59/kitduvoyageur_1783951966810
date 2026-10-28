import type { ZodType } from 'zod';

/**
 * Premier message d'erreur d'un schéma `zod`, ou `null` si la valeur est valide.
 * Chaque étape d'un formulaire a son schéma ; le bouton « Suivant » affiche ce
 * message au lieu d'un échec silencieux.
 */
export function firstIssue<T>(schema: ZodType<T>, value: unknown): string | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? 'Vérifie les champs.';
}

/** Date locale du jour au format `YYYY-MM-DD` (champ `type="date"`). */
export function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
