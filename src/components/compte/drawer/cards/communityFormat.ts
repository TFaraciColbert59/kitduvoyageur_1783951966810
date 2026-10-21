/** Helpers de formatage partagés par les cartes du slot Communauté. */

/**
 * Formate une date ISO (`YYYY-MM-DD` ou timestamp) en français, sans décalage
 * de fuseau pour les dates seules : `2026-10-24` reste le 24 octobre partout.
 */
export function formatCommunityDate(value?: string | null): string {
  if (!value) return '';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(year, month, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return '';
    }
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Pluriel français simple : `1 membre`, `2 membres`. */
export function pluralizeCommunity(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Initiale d'un profil, sans inventer de nom quand la donnée est absente. */
export function communityInitial(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

/** Nombre fini, sinon la valeur de repli (jamais de NaN affiché). */
export function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Compteur fini positif ou nul, `null` si la donnée est absente/invalide. */
export function finiteCountOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
