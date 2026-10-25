import Dexie, { type Table } from 'dexie';
import type { Carte3DOfflinePack, Carte3DTrail, TileCoordinate } from '../types';
import { ATLAS_TILES } from '@/components/map/engine/createMapStyle';

/**
 * Moteur hors-ligne pour la Carte 3D vivante LKDV.
 * Enregistre les tracés, waypoints, profils altimétriques et tuiles
 * satellite / DEM dans IndexedDB (Dexie) et Cache API.
 */

export const CARTE3D_CACHE_NAME = 'lkdv-tiles-v1';
export const CARTE3D_OFFLINE_DB_NAME = 'lkdv-carte3d-offline';

export class Carte3DOfflineDb extends Dexie {
  offline_packs!: Table<Carte3DOfflinePack, string>;

  constructor() {
    super(CARTE3D_OFFLINE_DB_NAME);
    this.version(1).stores({
      offline_packs: 'id, trailId, downloadedAt',
    });
  }
}

// Singleton de base de données Dexie pour la Carte 3D
let offlineDbInstance: Carte3DOfflineDb | null = null;
export function getCarte3DOfflineDb(): Carte3DOfflineDb {
  if (!offlineDbInstance) {
    offlineDbInstance = new Carte3DOfflineDb();
  }
  return offlineDbInstance;
}

/**
 * Conversion coordonnées WGS84 (lon/lat) en index de tuile XYZ Web Mercator.
 */
export function lngToTileX(lng: number, zoom: number): number {
  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  return Math.max(0, Math.min(Math.pow(2, zoom) - 1, x));
}

export function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
  return Math.max(0, Math.min(Math.pow(2, zoom) - 1, y));
}

/**
 * Calcule l'ensemble des coordonnées de tuiles pour un bounding box donné.
 */
export function computeBoundingBoxTiles(
  bounds: [number, number, number, number],
  zooms: number[] = [12, 13]
): TileCoordinate[] {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  const tiles: TileCoordinate[] = [];

  for (const z of zooms) {
    const xMin = lngToTileX(minLng, z);
    const xMax = lngToTileX(maxLng, z);
    const yMin = latToTileY(maxLat, z); // Note: tile Y décroît vers le nord
    const yMax = latToTileY(minLat, z);

    // Sécurité de quota : maximum 250 tuiles par niveau pour éviter la saturation réseau
    const countX = Math.abs(xMax - xMin) + 1;
    const countY = Math.abs(yMax - yMin) + 1;
    if (countX * countY > 300) {
      continue;
    }

    for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x++) {
      for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y++) {
        tiles.push({ x, y, z });
      }
    }
  }

  return tiles;
}

/**
 * Télécharge et met en cache la zone d'un sentier (données + tuiles satellite & DEM).
 */
export async function downloadTrailOfflinePack(
  trail: Carte3DTrail,
  onProgress?: (progressPct: number, downloaded: number, total: number) => void
): Promise<Carte3DOfflinePack> {
  const tileCoords = computeBoundingBoxTiles(trail.bounds, [12, 13]);
  let downloadedCount = 0;
  let estimatedBytes = 0;

  const hasCacheApi = typeof window !== 'undefined' && 'caches' in window;
  let cache: Cache | null = null;

  if (hasCacheApi) {
    try {
      cache = await window.caches.open(CARTE3D_CACHE_NAME);
    } catch (e) {
      console.warn('[Carte3DOffline] Cache API non accessible, sauvegarde métadonnées uniquement', e);
    }
  }

  // Téléchargement progressif par petits lots de 6 requêtes concurrentes
  const BATCH_SIZE = 6;
  const urlsToFetch: string[] = [];

  const satTemplate = ATLAS_TILES.satellite.tiles[0];
  for (const { x, y, z } of tileCoords) {
    const satUrl = satTemplate
      .replace('{z}', String(z))
      .replace('{y}', String(y))
      .replace('{x}', String(x));
    urlsToFetch.push(satUrl);
    urlsToFetch.push(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`);
  }

  for (let i = 0; i < urlsToFetch.length; i += BATCH_SIZE) {
    const batch = urlsToFetch.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (url) => {
        try {
          if (cache) {
            const existing = await cache.match(url);
            if (!existing) {
              const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
              if (res.ok) {
                const blob = await res.blob();
                estimatedBytes += blob.size || 25000;
                await cache.put(url, new Response(blob, { headers: res.headers }));
              }
            } else {
              estimatedBytes += 25000;
            }
          }
        } catch {
          // Tolérance aux pannes : échec isolé d'une tuile n'annule pas le pack complet
        } finally {
          downloadedCount++;
          if (onProgress) {
            const pct = Math.round((downloadedCount / Math.max(1, urlsToFetch.length)) * 100);
            onProgress(pct, downloadedCount, urlsToFetch.length);
          }
        }
      })
    );
  }

  const pack: Carte3DOfflinePack = {
    id: `pack-${trail.id}`,
    trailId: trail.id,
    trailName: trail.name,
    bounds: trail.bounds,
    downloadedAt: new Date().toISOString(),
    sizeBytes: estimatedBytes || 500000,
    tileCount: downloadedCount,
    isComplete: true,
    trailData: trail,
  };

  try {
    const db = getCarte3DOfflineDb();
    await db.offline_packs.put(pack);
  } catch (e) {
    console.warn('[Carte3DOffline] Sauvegarde Dexie ignorée (environnement sans IndexedDB)', e);
  }

  return pack;
}

/**
 * Supprime le pack hors-ligne d'un sentier.
 */
export async function deleteTrailOfflinePack(trailId: string): Promise<void> {
  try {
    const db = getCarte3DOfflineDb();
    await db.offline_packs.where('trailId').equals(trailId).delete();
  } catch (e) {
    console.warn('[Carte3DOffline] Suppression Dexie ignorée', e);
  }
}

/**
 * Vérifie si un sentier est déjà téléchargé hors-ligne.
 */
export async function checkTrailOfflineStatus(trailId: string): Promise<Carte3DOfflinePack | null> {
  try {
    const db = getCarte3DOfflineDb();
    const pack = await db.offline_packs.where('trailId').equals(trailId).first();
    return pack || null;
  } catch {
    return null;
  }
}
