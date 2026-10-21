/** Helpers de formatage partagés par les cartes du slot Communauté. */

/**
 * Formate une date ISO (`YYYY-MM-DD` ou timestamp) en français, sans décalage
 * de fuseau pour les dates seules : `2026-10-24` reste le 24 octobre partout.
 */
export function formatCommunityDate(value?: string | null): string {
  if (!value) return '';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
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
