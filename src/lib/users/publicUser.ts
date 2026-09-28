/**
 * La projection PUBLIQUE d une personne, et les deux fonctions pures qui la
 * construisent.
 *
 * Ces fonctions vivaient dans `src/app/api/users/search/route.ts`. Next.js
 * verifie qu un `route.ts` n exporte QUE son handler et quelques cles de
 * config : le moindre autre `export` fait echouer le build, meme si le code est
 * parfaitement correct. Les deplacer ici les rend reutilisables par le
 * composant client - qui avait duplique `PublicUser` - sans importer une route.
 *
 * Rien ici ne touche la base : ce sont des fonctions pures, testables seules.
 */

export interface PublicUser {
  readonly id: string;
  readonly fullName: string;
  readonly avatarUrl: string | null;
  readonly location: string | null;
  readonly trustScore: number | null;
}

/** Longueur maximale d un terme de recherche, bornee a la fois par la saisie et par la colonne. */
export const MAX_SEARCH_QUERY = 60;

/**
 * Neutralise le terme avant toute requete.
 *
 * Le terme part dans une chaine PostgREST (`.or(...)`) : un `%`, un `_`, une
 * virgule ou une parenthesegression de la syntaxe. Plutot que de reconstruire
 * la chaine, on ne garde que ce qui peut apparaitre dans un prenom, un nom ou
 * un lieu : lettres, chiffres, espace, apostrophe, point, tiret. Un `%` saisi
 * n est pas un caractere de recherche reel, il disparait.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} '.°-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SEARCH_QUERY);
}

/**
 * Ligne de `public_profiles` vers la forme publique.
 *
 * `avatar_url`, `location` et `trust_score` sont nullables en base : un champ
 * vide devient `null`, ce qui equivaut a « non renseigne », jamais a une valeur
 * de remplacement. `full_name` est NOT NULL mais peut valoir '' : on le rend
 * tel quel plutot que d inventer un prenom ou de disparaitre de la liste.
 */
export function toPublicUser(row: Record<string, unknown>): PublicUser {
  const text = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value : null;

  return {
    id: String(row.id),
    fullName: typeof row.full_name === 'string' ? row.full_name : '',
    avatarUrl: text(row.avatar_url),
    location: text(row.location),
    trustScore: typeof row.trust_score === 'number' && Number.isFinite(row.trust_score)
      ? row.trust_score
      : null,
  };
}