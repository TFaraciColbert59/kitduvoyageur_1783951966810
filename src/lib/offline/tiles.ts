// Prompt #4 — mode hors-ligne : calcul des tuiles slippy-map (zoom fixe 14).
// Une seule bande de zoom, plafonné à MAX_TILES tuiles par randonnée.

export const TILE_ZOOM = 14;
export const MAX_TILES = 400;
export const MAX_REQUESTS_PER_SECOND = 3;
export const REQUEST_SPACING_MS = Math.ceil(1000 / MAX_REQUESTS_PER_SECOND); // ~334 ms

// Fond de carte hors-ligne : OpenTopoMap (host canonical, sans sous-domaine).
export const TILE_URL_TEMPLATE = 'https://tile.opentopomap.org/{z}/{x}/{y}.png';

export interface TileBBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

/** Longitude/latitude -> coordonnée tuile (slippy map, Web Mercator). */
export function lonLatToTile(lon: number, lat: number, zoom: number): TileCoord {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y, z: zoom };
}

/**
 * Liste de tuiles couvrant la bbox (incluant les bords), bornée à la grille mondiale.
 * Retourne aussi le nombre total pour un refus > MAX_TILES.
 */
export function computeTilesForBbox(bbox: TileBBox, zoom: number): TileCoord[] {
  const n = 2 ** zoom;
  const latClamp = 85.05112878; // limite de la projection Web Mercator

  const latTop = Math.min(bbox.maxLat, latClamp);
  const latBottom = Math.max(bbox.minLat, -latClamp);
  const lngLeft = Math.max(bbox.minLng, -180);
  const lngRight = Math.min(bbox.maxLng, 180);
  if (latBottom >= latTop || lngLeft >= lngRight) return [];

  const tMin = lonLatToTile(lngLeft, latTop, zoom); // coin haut-gauche
  const tMax = lonLatToTile(lngRight, latBottom, zoom); // coin bas-droit

  const tiles: TileCoord[] = [];
  for (let x = tMin.x; x <= tMax.x; x++) {
    for (let y = tMin.y; y <= tMax.y; y++) {
      if (x >= 0 && x < n && y >= 0 && y < n) {
        tiles.push({ x, y, z: zoom });
      }
    }
  }
  return tiles;
}

export function tileToUrl(coord: TileCoord, template: string = TILE_URL_TEMPLATE): string {
  return template.replace('{z}', String(coord.z)).replace('{x}', String(coord.x)).replace('{y}', String(coord.y));
}

export function estimateTileBytes(tileCount: number): number {
  // ~15 Ko par tuile PNG OpenTopoMap (ordre de grandeur constaté)
  return tileCount * 15_000;
}