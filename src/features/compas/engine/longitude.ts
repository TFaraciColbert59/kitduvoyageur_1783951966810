/**
 * Compas — longitudes et antiméridien (±180°). Module PUR : aucune I/O.
 *
 * Fidji, Chukotka, les Aléoutiennes : une destination peut chevaucher la
 * coupure à ±180°. Deux pièges, tous deux vus sur Photon (11 octobre 2026) :
 * - la boîte minimale d'une forme coupée par l'antiméridien couvre TOUT le
 *   globe : Fidji et même Taveuni (une île de 40 km) reviennent avec
 *   [-180, nord, 180, sud] ; on n'en lit plus la largeur, seulement la hauteur ;
 * - une moyenne ou une différence de longitudes naïve passe par le méridien 0 :
 *   la moyenne de 179,9 et -179,9 vaut 0, pas 180.
 * Toute longitude calculée passe ici.
 */

/** Emprise [ouest, nord, est, sud], comme Photon la rend. */
export type Extent = readonly [number, number, number, number];

/** Au-delà de cette largeur (°), l'emprise est la boîte d'un globe entier : sa largeur ne dit rien. */
const WORLDWIDE_DEG = 359;

/** Longitude ramenée dans [-180, 180] ; une valeur déjà valide n'est jamais touchée. */
export function wrapLon(lon: number): number {
  if (!Number.isFinite(lon)) return lon;
  if (lon >= -180 && lon <= 180) return lon;
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Différence signée `to - from` par le plus court chemin, dans [-180, 180].
 * Sans coupure entre les deux, c'est la soustraction exacte (aucun bruit de
 * calcul ajouté aux itinéraires qui n'en ont pas besoin).
 */
export function lonDelta(from: number, to: number): number {
  const d = to - from;
  if (d >= -180 && d <= 180) return d;
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

/** Moyenne de longitudes proches les unes des autres, de part et d'autre de la coupure comprise. */
export function meanLon(lons: readonly number[]): number {
  if (!lons.length) return 0;
  const ref = lons[0];
  // Aucune longitude de l'autre côté de la coupure : la moyenne ordinaire, exacte.
  if (lons.every((l) => Math.abs(l - ref) <= 180))
    return lons.reduce((t, l) => t + l, 0) / lons.length;
  const mean = lons.reduce((t, l) => t + lonDelta(ref, l), 0) / lons.length;
  return wrapLon(ref + mean);
}

/** Largeur (°) d'une emprise ; ouest > est veut dire qu'elle franchit la coupure. */
export function extentWidthDeg(extent: Extent): number {
  const [w, , e] = extent;
  return e >= w ? e - w : e - w + 360;
}

/** La boîte d'un globe entier : la forme est coupée par l'antiméridien, sa largeur est inconnue. */
export function extentIsWorldwide(extent: Extent): boolean {
  return extentWidthDeg(extent) >= WORLDWIDE_DEG;
}

/** La longitude est-elle dans l'emprise, élargie de `marginDeg` de chaque côté (coupure comprise) ? */
export function lonInExtent(lon: number, extent: Extent, marginDeg = 0): boolean {
  const width = extentWidthDeg(extent);
  if (width + 2 * marginDeg >= 360) return true;
  const offset = (((lon - (extent[0] - marginDeg)) % 360) + 360) % 360;
  return offset <= width + 2 * marginDeg;
}

/**
 * Une plage de longitudes [ouest, est] en segments valides dans [-180, 180] :
 * un seul quand elle ne franchit pas la coupure, deux sinon (ouest → 180 et
 * -180 → est). Les bornes peuvent dépasser ±180 (un rayon autour de 179,9° E).
 */
export function splitLonRange(west: number, east: number): Array<[number, number]> {
  const width = east >= west ? east - west : east - west + 360;
  if (width >= 360) return [[-180, 180]];
  const w = wrapLon(west);
  const e = wrapLon(east);
  return w <= e
    ? [[w, e]]
    : [
        [w, 180],
        [-180, e],
      ];
}

/**
 * Le filtre `or` de PostgREST pour des plages de longitudes (`splitLonRange`) :
 * `and(lng.gte.179.83,lng.lte.180),and(lng.gte.-180,lng.lte.-179.93)`. Les bornes
 * sont arrondies au cent-millième de degré (≈ 1 m) : pas de bruit de calcul dans l'URL.
 */
export function lonOrFilter(
  column: string,
  segments: ReadonlyArray<readonly [number, number]>
): string {
  const r = (v: number) => Math.round(v * 1e5) / 1e5;
  return segments.map(([a, b]) => `and(${column}.gte.${r(a)},${column}.lte.${r(b)})`).join(',');
}
