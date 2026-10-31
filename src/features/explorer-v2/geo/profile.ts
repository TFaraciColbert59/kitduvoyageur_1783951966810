/**
 * Calcul du profil altimétrique côté navigateur (worker ou fallback main-thread).
 *
 * Séparé du bootstrap `workers/geo.worker.ts` pour que le fallback puisse
 * importer ce module **sans** exécuter de code `self.addEventListener`, et pour
 * que les tests Node puissent l'exercer avec un décodeur de tuiles injecté.
 */
import {
  decimateTrack,
  resampleTrack,
  summarizeElevation,
  trackDistanceM,
  type ElevationPoint,
  type LngLat,
} from './track';
import {
  TILE_SIZE,
  decodeTerrariumTile,
  latToTileY,
  lonToTileX,
  sampleTileElevation,
  terrariumTileUrl,
} from './dem';

export interface ProfileRequest {
  id: number;
  positions: Array<[number, number]>;
  stepM?: number;
  demZoom?: number;
}

export interface ProfilePoint {
  /** Distance cumulée depuis le départ, en mètres. */
  d: number;
  /** Altitude en mètres, ou null si la tuile n'a pas pu être lue. */
  ele: number | null;
}

export interface ProfileResult {
  id: number;
  points: ProfilePoint[];
  distance_m: number;
  gain_m: number;
  loss_m: number;
  min_m: number | null;
  max_m: number | null;
  source: 'aws-terrarium';
}

/** Charge et décode une tuile DEM ; `null` si le réseau ou le décodage échoue. */
export type TileLoader = (zoom: number, x: number, y: number) => Promise<Float32Array | null>;

const MAX_TILES = 24;

/** Cache LRU simple : 24 tuiles × 256² Float32 ≈ 6 Mo au pire. */
function createTileCache(loader: TileLoader): TileLoader {
  const cache = new Map<string, Float32Array>();
  return async (zoom, x, y) => {
    const key = `${zoom}/${x}/${y}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const tile = await loader(zoom, x, y);
    if (!tile) return null;
    if (cache.size >= MAX_TILES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(key, tile);
    return tile;
  };
}

/** Décodeur navigateur : `createImageBitmap` + `OffscreenCanvas`. */
export const browserTileLoader: TileLoader = createTileCache(async (zoom, x, y) => {
  try {
    if (typeof fetch !== 'function') return null;
    const response = await fetch(terrariumTileUrl(zoom, x, y));
    if (!response.ok) return null;
    const blob = await response.blob();
    // WebKit/iOS : createImageBitmap existe depuis Safari 15 ; sinon tuile nulle.
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
      return null;
    }
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    const size = bitmap.width;
    const { data } = context.getImageData(0, 0, size, size);
    bitmap.close();
    return decodeTerrariumTile(data, size, 4);
  } catch {
    return null;
  }
});

async function elevationAt(
  lng: number,
  lat: number,
  zoom: number,
  loadTile: TileLoader,
): Promise<number | null> {
  const x = Math.floor(lonToTileX(lng, zoom));
  const y = Math.floor(latToTileY(lat, zoom));
  const tile = await loadTile(zoom, x, y);
  if (!tile) return null;
  return sampleTileElevation(tile, TILE_SIZE, lng, lat, zoom);
}

/**
 * Construit le profil altimétrique d'une trace.
 *
 * - la trace est décimée à 400 points (bruit OSM) puis rééchantillonnée ;
 * - un trou DEM devient `ele: null`, jamais une altitude inventée ;
 * - `loadTile` est injectable pour les tests (aucun réseau en test unitaire).
 */
export async function buildProfile(
  request: ProfileRequest,
  loadTile: TileLoader = browserTileLoader,
): Promise<ProfileResult> {
  const { id } = request;
  const demZoom = Number.isFinite(request.demZoom) ? (request.demZoom as number) : 10;
  const raw = decimateTrack(request.positions as LngLat[], 400);
  const trackLength = trackDistanceM(raw);
  const stepM = Number.isFinite(request.stepM)
    ? (request.stepM as number)
    : Math.max(80, Math.ceil(trackLength / 40));
  const samples = resampleTrack(raw, stepM);

  const points: ProfilePoint[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const ele = await elevationAt(sample.position[0], sample.position[1], demZoom, loadTile);
    points.push({ d: Math.round(sample.distance_m), ele } satisfies ElevationPoint);
    // Rend la main toutes les 8 tuiles : la feuille reste interactive.
    if (index % 8 === 7 && typeof requestAnimationFrame === 'function') {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const summary = summarizeElevation(points, trackLength);
  return {
    id,
    points,
    distance_m: summary.distance_m,
    gain_m: summary.gain_m,
    loss_m: summary.loss_m,
    min_m: summary.min_m,
    max_m: summary.max_m,
    source: 'aws-terrarium',
  };
}
