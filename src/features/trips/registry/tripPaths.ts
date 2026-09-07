/**
 * Y3.5 — Constructeurs de chemins /voyages/ PURS (règle Y-D80 n°11).
 *
 * Règle 11 : « aucune route /voyages/ littérale hors du registre ». Ce module
 * est le seul endroit — avec tripSectionRegistry — qui écrit des chemins
 * /voyages/... Il est PURE (aucun import React / lucide), donc importable
 * depuis les server actions (revalidatePath, redirect) sans tirer le registre
 * complet ni les icônes.
 */

/** Chemin racine d'un voyage. */
export function tripPath(slug: string): string {
  return `/voyages/${slug}`;
}

/** Chemin de création d'un voyage (wizard). */
export function tripNewPath(): string {
  return '/voyages/nouveau';
}

/** Chemin complet d'une section par segment d'URL (ex: 'itineraire', 'kit', '' = racine). */
export function tripSegmentPath(slug: string, segment: string): string {
  const base = tripPath(slug);
  return segment ? `${base}/${segment}` : base;
}
