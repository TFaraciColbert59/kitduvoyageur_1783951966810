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
