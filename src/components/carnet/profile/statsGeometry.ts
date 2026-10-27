/**
 * Géométrie des aires et des barres du sous-drawer statistiques.
 *
 * Aucune valeur n'est inventée : une série vide rend `null`, et l'appelant
 * affiche alors un état vide honnête plutôt qu'une courbe décorative.
 */

export type SeriesValue = number | null;

export interface SeriesPoint {
  /** Position dans la série d'origine (le jour), trous compris. */
  index: number;
  value: number;
  x: number;
  y: number;
}

export interface ProfileGeometry {
  /** Chemin du trait, en unités du `viewBox`. */
  line: string;
  /** Chemin de l'aire fermée sous le trait. */
  area: string;
  points: SeriesPoint[];
  summit: SeriesPoint;
  min: number;
  max: number;
}

function finitePositive(value: SeriesValue): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Valeurs réelles de la série, dans l'ordre des jours. */
export function seriesValues(series: SeriesValue[]): number[] {
  return series.filter(finitePositive);
}

/**
 * Aire altimétrique : `width` × `height`, marge verticale `pad`. Les jours sans
 * valeur ne créent aucun point (le trait les saute) mais gardent leur place sur
 * l'axe horizontal, pour que les repères restent ceux des vrais jours.
 */
export function elevationProfile(
  series: SeriesValue[],
  width = 374,
  height = 72,
  pad = 9,
): ProfileGeometry | null {
  const values = seriesValues(series);
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const usable = Math.max(height - pad * 2, 1);
  const last = Math.max(series.length - 1, 1);
  const points: SeriesPoint[] = [];
  series.forEach((value, index) => {
    if (!finitePositive(value)) return;
    const x = series.length <= 1 ? width / 2 : (index / last) * width;
    const ratio = max === min ? 0.5 : (value - min) / (max - min);
    const y = pad + (1 - ratio) * usable;
    points.push({ index, value, x, y });
  });
  if (points.length === 0) return null;
  const line = points
    .map((point, position) => `${position === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const area = `${line} L${width.toFixed(2)} ${height.toFixed(2)} L0 ${height.toFixed(2)} Z`;
  const summit = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]);
  return { line, area, points, summit, min, max };
}

/**
 * Répartition en trois segments : la série est coupée en trois tiers
 * consécutifs (début, milieu, fin) et chaque segment vaut la somme de ses
 * valeurs réelles. `null` sans aucune valeur.
 */
export function splitThirds(series: SeriesValue[]): [number, number, number] | null {
  const values = seriesValues(series);
  if (values.length === 0) return null;
  const bands: [number, number, number] = [0, 0, 0];
  const count = series.length;
  series.forEach((value, index) => {
    if (!finitePositive(value)) return;
    const band = count <= 1 ? 0 : Math.min(2, Math.floor((index / count) * 3));
    bands[band] += value;
  });
  return bands.some((band) => band > 0) ? bands : null;
}

/** Hauteurs réelles des barres journalières, proportionnelles à la série. */
export function dailyBarHeights(series: SeriesValue[], maxHeight = 16): (number | null)[] {
  const values = seriesValues(series);
  if (values.length === 0) return [];
  const max = Math.max(...values);
  return series.map((value) => {
    if (!finitePositive(value)) return null;
    return Math.max(2, Math.round((value / max) * maxHeight));
  });
}

/** Valeur formatée et unité séparées : `106,4 km` → `{ value: '106,4', unit: 'km' }`. */
export function splitUnit(formatted: string | null): { value: string; unit: string } {
  if (!formatted) return { value: '—', unit: '' };
  const trimmed = formatted.trim();
  const cut = Math.max(
    trimmed.lastIndexOf(' '),
    trimmed.lastIndexOf('\u00a0'),
    trimmed.lastIndexOf('\u202f'),
  );
  if (cut <= 0) return { value: trimmed, unit: '' };
  return { value: trimmed.slice(0, cut), unit: trimmed.slice(cut + 1) };
}
