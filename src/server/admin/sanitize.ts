/**
 * Assainissement des recherches PostgREST `.or(ilike)` — les caractères
 * `,()` découpent les clauses, `%` et `"` élargissent/faussent le filtre.
 * On les retire (la recherche reste contains via les `%` posés par l'appelant).
 */
export function sanitizeIlike(raw: string): string {
  return raw.replace(/[,()%\"\\]/g, '').trim().slice(0, 120);
}
