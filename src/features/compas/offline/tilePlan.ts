/**
 * Plan des tuiles à garder pour la zone d'une aventure (PLAN-100 phase 8, hors ligne).
 *
 * Pur : à partir des points de l'aventure, calcule la liste (z/x/y) à précharger. Le service
 * worker (`public/sw.js`, stratégie E) met en cache chaque tuile récupérée ; la précharger
 * revient donc à la demander une fois. Borne dure : les conditions d'usage des tuiles OSM
 * interdisent le téléchargement en masse, le plan reste petit (quelques dizaines de tuiles).
 */
export interface LatLon {
  lat: number;
  lon: number;
}
export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/** Plafond de tuiles pour une aventure (respect des conditions d'usage d'OSM). */
export const MAX_TILES = 120;
export const MIN_ZOOM = 9;
export const MAX_ZOOM = 14;

export function lonToX(lon: number, z: number): number {
  const n = 2 ** z;
  return Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
}
export function latToY(lat: number, z: number): number {
  const n = 2 ** z;
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const r = (clamped * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return Math.min(n - 1, Math.max(0, Math.floor(y)));
}

function validPoints(points: ReadonlyArray<Partial<LatLon> | null | undefined>): LatLon[] {
  const out: LatLon[] = [];
  for (const p of points) {
    if (
      p &&
      typeof p.lat === 'number' &&
      typeof p.lon === 'number' &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lon)
    ) {
      out.push({ lat: p.lat, lon: p.lon });
    }
  }
  return out;
}

/**
 * Tuiles couvrant les points, du zoom MIN_ZOOM jusqu'au zoom le plus fin (<= MAX_ZOOM) qui
 * tient dans le plafond (vue d'ensemble toujours gardée). Sans point : liste vide.
 */
export function planTiles(
  points: ReadonlyArray<Partial<LatLon> | null | undefined>,
  max = MAX_TILES
): TileCoord[] {
  const pts = validPoints(points);
  if (pts.length === 0) return [];
  const at = (z: number): TileCoord[] => {
    const seen = new Set<string>();
    const out: TileCoord[] = [];
    for (const p of pts) {
      const x = lonToX(p.lon, z);
      const y = latToY(p.lat, z);
      // la tuile du point et ses voisines : le bord de l'écran reste couvert
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const tx = x + dx;
          const ty = y + dy;
          if (tx < 0 || ty < 0 || tx >= 2 ** z || ty >= 2 ** z) continue;
          const k = `${z}/${tx}/${ty}`;
          if (!seen.has(k)) {
            seen.add(k);
            out.push({ z, x: tx, y: ty });
          }
        }
      }
    }
    return out;
  };
  const levels: TileCoord[][] = [];
  let total = 0;
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z += 1) {
    const l = at(z);
    if (total + l.length > max) break;
    levels.push(l);
    total += l.length;
  }
  if (levels.length === 0) return at(MIN_ZOOM).slice(0, max);
  return levels.flat();
}

export function tileUrl(template: string, t: TileCoord): string {
  return template
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y));
}

const defaultFetcher = (url: string): Promise<{ ok: boolean }> =>
  fetch(url, { mode: 'no-cors' }).then((r) => ({ ok: r.ok || r.type === 'opaque' }));

/**
 * Précharge les tuiles (client). Concurrence 4, tout échec ignoré ; renvoie le nombre de
 * tuiles obtenues. Ne fait rien hors ligne.
 */
export async function prefetchTiles(
  template: string,
  tiles: TileCoord[],
  fetcher: (url: string) => Promise<{ ok: boolean }> = defaultFetcher
): Promise<number> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
  let done = 0;
  let i = 0;
  const worker = async () => {
    while (i < tiles.length) {
      const t = tiles[i++];
      try {
        const r = await fetcher(tileUrl(template, t));
        if (r.ok) done += 1;
      } catch {
        /* au mieux */
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return done;
}
