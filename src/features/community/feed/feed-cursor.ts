/**
 * Pagination du fil par curseur (keyset) : `(created_at, id)` décroissant.
 *
 * Avec `range(offset, …)`, une publication ajoutée pendant la lecture décale
 * toutes les pages suivantes (doublons ou posts sautés) et la base doit
 * parcourir `offset` lignes. Le curseur est stable et se sert de l'index
 * `idx_community_posts_created`.
 */
export interface FeedCursor {
  createdAt: string;
  id: string;
}

export const FEED_PAGE_SIZE = 10;

/** Curseur du dernier post d'une page, ou `null` si la page est vide ou mal formée. */
export function cursorOf(rows: ReadonlyArray<{ id?: string; created_at?: string | null }>): FeedCursor | null {
  const last = rows[rows.length - 1];
  if (!last?.id || !last.created_at) return null;
  return { createdAt: last.created_at, id: last.id };
}

/**
 * Filtre PostgREST `or(...)` : posts strictement plus anciens que le curseur,
 * ou même instant avec un `id` plus petit. Valeurs entre guillemets : un
 * horodatage contient `:` et `+`, qui sont des caractères de syntaxe.
 */
export function olderThanFilter(cursor: FeedCursor): string {
  const at = cursor.createdAt.replace(/"/g, '');
  const id = cursor.id.replace(/"/g, '');
  return `created_at.lt."${at}",and(created_at.eq."${at}",id.lt."${id}")`;
}

/** Une page pleine laisse supposer une suite ; une page courte ferme le fil. */
export function hasMorePages(received: number, pageSize = FEED_PAGE_SIZE): boolean {
  return received >= pageSize;
}

/** Ajoute une page sans doublon (un post déjà vu, par exemple après une insertion). */
export function appendUnique<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}
