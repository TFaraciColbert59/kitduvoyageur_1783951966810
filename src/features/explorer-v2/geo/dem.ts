/**
 * Décodage du DEM **AWS Terrain Tiles** (tuiles `terrarium`, open data, sans clé).
 *
 * Partagé par le worker navigateur (`OffscreenCanvas` + `createImageBitmap`) et
 * la route serveur (`sharp`), pour que les deux profils altimétriques sortent de
 * la même mathématique de tuile. Module pur : aucun accès DOM ni réseau.
 *
 * Encodage terrarium : `élévation = R * 256 + G + B / 256 - 32768` (mètres).
 */

export const TILE_SIZE = 256;
export const TERRARIUM_BASE_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

/** URL de la tuile terrarium `z/x/y`. */
export function terrariumTileUrl(zoom: number, x: number, y: number): string {
  return `${TERRARIUM_BASE_URL}/${zoom}/${x}/${y}.png`;
}

/** Coordonnée X fractionnaire (0..2^z) d'une longitude dans le schéma Web Mercator. */
export function lonToTileX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * 2 ** zoom;
}

/** Coordonnée Y fractionnaire (0..2^z) d'une latitude dans le schéma Web Mercator. */
export function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}

/** Altitude terrarium d'un pixel RGB. */
export function terrariumElevation(red: number, green: number, blue: number): number {
  return red * 256 + green + blue / 256 - 32768;
}

/** Données pixels d'une tuile : `Uint8ClampedArray` (canvas) ou `Buffer` (sharp). */
export type TileDecoderInput = ArrayLike<number>;

/**
 * Décode les pixels d'une tuile en altitudes (Float32Array de `size * size`).
 * `channels` est le nombre de canaux par pixel produit par le décodeur
 * (4 pour `OffscreenCanvas`, `info.channels` pour `sharp`).
 */
export function decodeTerrariumTile(
  data: TileDecoderInput,
  size: number,
  channels: number,
): Float32Array {
  const elevations = new Float32Array(size * size);
  for (let index = 0; index < elevations.length; index += 1) {
    const offset = index * channels;
    elevations[index] = terrariumElevation(data[offset], data[offset + 1], data[offset + 2]);
  }
  return elevations;
}

/** Altitude d'un point (lng, lat) échantillonné au pixel le plus proche d'une tuile décodée. */
export function sampleTileElevation(
  tile: Float32Array,
  size: number,
  lng: number,
  lat: number,
  zoom: number,
): number {
  const xf = lonToTileX(lng, zoom);
  const yf = latToTileY(lat, zoom);
  const px = Math.min(size - 1, Math.max(0, Math.floor((xf - Math.floor(xf)) * size)));
  const py = Math.min(size - 1, Math.max(0, Math.floor((yf - Math.floor(yf)) * size)));
  return Math.round(tile[py * size + px]);
}

/**
 * Altitude bilinéaire lissée d'un point (lng, lat) sur une tuile DEM décodée.
 * Évite les marches d'escalier artificielles lors du calcul des pentes d'arêtes.
 */
export function sampleTileElevationBilinear(
  tile: Float32Array,
  size: number,
  lng: number,
  lat: number,
  zoom: number,
): number {
  const xf = lonToTileX(lng, zoom);
  const yf = latToTileY(lat, zoom);
  const fx = (xf - Math.floor(xf)) * size - 0.5;
  const fy = (yf - Math.floor(yf)) * size - 0.5;
  const x0 = Math.min(size - 1, Math.max(0, Math.floor(fx)));
  const y0 = Math.min(size - 1, Math.max(0, Math.floor(fy)));
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const tx = Math.min(1, Math.max(0, fx - x0));
  const ty = Math.min(1, Math.max(0, fy - y0));

  const z00 = tile[y0 * size + x0];
  const z10 = tile[y0 * size + x1];
  const z01 = tile[y1 * size + x0];
  const z11 = tile[y1 * size + x1];
  const z0 = z00 + (z10 - z00) * tx;
  const z1 = z01 + (z11 - z01) * tx;
  return z0 + (z1 - z0) * ty;
}

/**
 * Pente locale (degrés, opérateur Horn 3×3) autour d'un point sur une tuile Terrarium décodée.
 */
export function sampleTileSlopeDeg(
  tile: Float32Array,
  size: number,
  lng: number,
  lat: number,
  zoom: number,
): number {
  const xf = lonToTileX(lng, zoom);
  const yf = latToTileY(lat, zoom);
  const px = Math.min(size - 2, Math.max(1, Math.floor((xf - Math.floor(xf)) * size)));
  const py = Math.min(size - 2, Math.max(1, Math.floor((yf - Math.floor(yf)) * size)));

  const cellM = (156_543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  if (!Number.isFinite(cellM) || cellM <= 0.1) return 0;

  const at = (x: number, y: number) => tile[y * size + x];
  const dzdx =
    (at(px + 1, py - 1) + 2 * at(px + 1, py) + at(px + 1, py + 1) -
      (at(px - 1, py - 1) + 2 * at(px - 1, py) + at(px - 1, py + 1))) /
    (8 * cellM);
  const dzdy =
    (at(px - 1, py + 1) + 2 * at(px, py + 1) + at(px + 1, py + 1) -
      (at(px - 1, py - 1) + 2 * at(px, py - 1) + at(px + 1, py - 1))) /
    (8 * cellM);
  return Math.atan(Math.hypot(dzdx, dzdy)) * (180 / Math.PI);
}
