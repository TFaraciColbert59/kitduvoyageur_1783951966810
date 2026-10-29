/**
 * Recherche communautaire : types, regroupement et pagination (fonctions pures).
 * Les requêtes vivent dans `useCommunitySearch`.
 */

export type SearchKind = 'post' | 'carnet' | 'club' | 'sortie' | 'member';
export type SearchScope = 'all' | SearchKind;

export interface SearchResult {
  id: string;
  kind: SearchKind;
  title: string;
  meta: string;
  href: string;
  cover?: string | null;
}

export const SEARCH_KINDS: ReadonlyArray<{ id: SearchKind; label: string; tone: string }> = [
  { id: 'post', label: 'Publications', tone: '#17402C' },
  { id: 'carnet', label: 'Carnets', tone: '#8A6A2F' },
  { id: 'club', label: 'Clubs', tone: '#3D6F63' },
  { id: 'sortie', label: 'Sorties', tone: '#A05A3C' },
  { id: 'member', label: 'Membres', tone: '#4B6B7C' },
];

/** Étiquette d'un type, pour le point coloré et l'accessibilité. */
export function kindLabel(kind: SearchKind): string {
  return SEARCH_KINDS.find((entry) => entry.id === kind)?.label ?? kind;
}

export const SEARCH_MIN_CHARS = 2;
export const RESULTS_PER_PAGE = 4;

interface Row {
  [key: string]: any;
}

export interface SearchRows {
  posts?: Row[] | null;
  carnets?: Row[] | null;
  clubs?: Row[] | null;
  events?: Row[] | null;
  members?: Row[] | null;
}

/** Transforme les lignes brutes des cinq requêtes en résultats uniformes, dans l'ordre post → membre. */
export function mapSearchRows(rows: SearchRows): SearchResult[] {
  return [
    ...(rows.posts ?? []).map((row) => ({
      id: row.id,
      kind: 'post' as const,
      title: (row.content as string | null)?.trim().slice(0, 72) || 'Publication',
      meta: 'Publication',
      href: `/communaute?post=${row.id}`,
      cover: row.image_url || row.media_urls?.[0] || null,
    })),
    ...(rows.carnets ?? []).map((row) => ({
      id: row.id,
      kind: 'carnet' as const,
      title: row.title || 'Carnet',
      meta: 'Carnet',
      href: `/carnets/${row.id}`,
      cover: row.cover_image ?? null,
    })),
    ...(rows.clubs ?? []).map((row) => ({
      id: row.id,
      kind: 'club' as const,
      title: row.name,
      meta: `${row.members_count ?? 0} membres${row.category ? ` · ${row.category}` : ''}`,
      href: `/clubs/${row.slug || row.id}`,
      cover: row.cover_image ?? null,
    })),
    ...(rows.events ?? []).map((row) => ({
      id: row.id,
      kind: 'sortie' as const,
      title: row.title,
      meta: [row.location, row.event_date].filter(Boolean).join(' · '),
      href: '/evenements',
      cover: null,
    })),
    ...(rows.members ?? []).map((row) => ({
      id: row.id,
      kind: 'member' as const,
      title: row.full_name || `@${row.handle || 'voyageur'}`,
      meta: [row.handle ? `@${row.handle}` : null, row.location].filter(Boolean).join(' · '),
      href: `/profil/${row.id}`,
      cover: row.avatar_url ?? null,
    })),
  ];
}

export function filterByScope(results: readonly SearchResult[], scope: SearchScope): SearchResult[] {
  return scope === 'all' ? [...results] : results.filter((result) => result.kind === scope);
}

export function countByScope(results: readonly SearchResult[], scope: SearchScope): number {
  return scope === 'all' ? results.length : results.filter((result) => result.kind === scope).length;
}

/** Découpe en pages d'au plus `size` éléments (aucun défilement vertical : on balaie de page en page). */
export function paginate<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new RangeError('paginate : size doit valoir au moins 1');
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/** Texte à chercher : espaces rognés, caractères génériques `%` `_` `,` `(` `)` neutralisés pour `ilike`/`or`. */
export function normalizeQuery(raw: string): string {
  return raw.replace(/[%_,()\\]/g, ' ').replace(/\s+/g, ' ').trim();
}
