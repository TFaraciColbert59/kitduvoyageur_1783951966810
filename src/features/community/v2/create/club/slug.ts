/**
 * Adresse (slug) d'un club — même normalisation que `public.lkdv_slugify`
 * côté SQL : minuscules, accents retirés, tout groupe non alphanumérique devient
 * un tiret, longueur bornée à 60. Pure et testée.
 */
export function slugifyClubName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Un slug proposable à l'utilisateur : 2 à 60 caractères. */
export function isValidClubSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,59}$/.test(slug);
}
