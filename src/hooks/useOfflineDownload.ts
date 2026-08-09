'use client';

/**
 * LKDV — Hook de téléchargement hors-ligne (Prompt #4)
 *
 * - Calcule les tuiles Leaflet z=14 dans la bbox du tracé GeoJSON
 * - Limite à 400 tuiles max, débit ≤ 3 req/s (politique OSM/OpenTopoMap)
 * - Stocke les données de la route dans IndexedDB via offlineStorage
 * - Pilote le Service Worker via postMessage (lkdv:set-active-route)
 */

import { useState, useCallback } from 'react';
import type { MapTrail } from '@/components/explorer/types';
import {
  saveRouteOffline,
  deleteRouteOffline,
  type OfflinePoi,
} from '@/lib/offlineStorage';

// ── Tile maths (Leaflet convention) ──────────────────────────────────────────

const ZOOM = 14;
const MAX_TILES = 400;
const REQUESTS_PER_SEC = 3;
const MARGIN_TILES = 2; // ~1 tuile ≈ 3 km à z14 → 2 tuiles ≈ ~500m de marge

/** Lon → tile X at given zoom */
function lonToTile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

/** Lat → tile Y at given zoom */
function latToTile(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

interface TileCoord { z: number; x: number; y: number }

/**
 * Retourne la liste de toutes les tuiles z=14 couvrant la bbox donnée (avec marge).
 */
function tilesForBbox(
  minLat: number, maxLat: number,
  minLon: number, maxLon: number,
): TileCoord[] {
  const xMin = lonToTile(minLon, ZOOM) - MARGIN_TILES;
  const xMax = lonToTile(maxLon, ZOOM) + MARGIN_TILES;
  const yMin = latToTile(maxLat, ZOOM) - MARGIN_TILES; // lat → y est inversé
  const yMax = latToTile(minLat, ZOOM) + MARGIN_TILES;

  const tiles: TileCoord[] = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ z: ZOOM, x, y });
    }
  }
  return tiles;
}

/**
 * URL OSM pour une tuile (on utilise OSM/CARTO comme tuile par défaut).
 * OpenTopoMap ne gère pas les sous-domaines pour ce pattern simplifié.
 */
function tileUrl({ z, x, y }: TileCoord): string {
  return `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@1x.png`;
}

// ── Bbox depuis un GeoJSON LineString ────────────────────────────────────────

function bboxFromGeojson(geojson: { type: string; coordinates: number[][] } | null | undefined): {
  minLat: number; maxLat: number; minLon: number; maxLon: number;
} | null {
  if (!geojson || geojson.type !== 'LineString') return null;
  const coords = geojson.coordinates;
  if (!coords || coords.length === 0) return null;

  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLat, maxLat, minLon, maxLon };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export type DownloadStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'done'
  | 'error'
  | 'too_large'
  | 'no_geom';

export interface UseOfflineDownloadReturn {
  status: DownloadStatus;
  progress: number;   // 0-100
  total: number;      // nombre total de tuiles
  downloaded: number; // tuiles téléchargées
  error: string | null;
  downloadForOffline: (trail: MapTrail, pois?: OfflinePoi[]) => Promise<void>;
  deleteOffline: (routeId: string) => Promise<void>;
  reset: () => void;
}

export function useOfflineDownload(): UseOfflineDownloadReturn {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setTotal(0);
    setDownloaded(0);
    setError(null);
  }, []);

  const downloadForOffline = useCallback(async (trail: MapTrail, pois: OfflinePoi[] = []) => {
    setStatus('checking');
    setProgress(0);
    setDownloaded(0);
    setError(null);

    try {
      // 1. Calculer la bbox
      const bbox = bboxFromGeojson(trail.geojson);

      if (!bbox && (trail.lat == null || trail.lng == null)) {
        setStatus('no_geom');
        setError('Aucune géométrie disponible pour cette randonnée.');
        return;
      }

      const effectiveBbox = bbox ?? {
        minLat: (trail.lat ?? 0) - 0.05,
        maxLat: (trail.lat ?? 0) + 0.05,
        minLon: (trail.lng ?? 0) - 0.05,
        maxLon: (trail.lng ?? 0) + 0.05,
      };

      // 2. Calculer les tuiles nécessaires
      const tiles = tilesForBbox(
        effectiveBbox.minLat,
        effectiveBbox.maxLat,
        effectiveBbox.minLon,
        effectiveBbox.maxLon,
      );

      if (tiles.length > MAX_TILES) {
        setStatus('too_large');
        setError(
          `Cette randonnée nécessiterait ${tiles.length} tuiles (max ${MAX_TILES}). ` +
          `Elle est trop longue pour le mode hors-ligne pour le moment.`
        );
        return;
      }

      setTotal(tiles.length);
      setStatus('downloading');

      // 3. Informer le SW quelle route est active (pour qu'il la mette en cache)
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'lkdv:set-active-route',
          routeId: trail.id,
        });
      }

      // 4. Télécharger séquentiellement à ≤ 3 req/s
      const DELAY_MS = Math.ceil(1000 / REQUESTS_PER_SEC);
      let done = 0;

      for (const tile of tiles) {
        try {
          await fetch(tileUrl(tile), { mode: 'cors', cache: 'reload' });
        } catch {
          // Tuile inaccessible (hors réseau temporairement) → on continue
        }

        done++;
        setDownloaded(done);
        setProgress(Math.round((done / tiles.length) * 100));

        // Attendre entre chaque requête pour respecter la limite de débit
        await new Promise<void>((res) => setTimeout(res, DELAY_MS));
      }

      // 5. Sauvegarder les métadonnées dans IndexedDB
      await saveRouteOffline({
        routeId: String(trail.id),
        name: trail.name,
        distanceKm: trail.distance_km ?? null,
        difficulty: trail.difficulty ?? null,
        geojson: trail.geojson ?? null,
        pois,
        cachedAt: new Date().toISOString(),
        tileCount: tiles.length,
      });

      setStatus('done');
    } catch (err) {
      console.error('[useOfflineDownload]', err);
      setStatus('error');
      setError('Erreur inattendue lors du téléchargement.');
    }
  }, []);

  const deleteOffline = useCallback(async (routeId: string) => {
    try {
      // Supprimer le cache SW
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'lkdv:delete-route',
          routeId,
        });
      }

      // Supprimer depuis la Cache API directement aussi (au cas où le SW ne répond pas)
      if (typeof caches !== 'undefined') {
        await caches.delete(`lkdv-tiles-route-${routeId}`).catch(() => {});
      }

      // Supprimer depuis IndexedDB
      await deleteRouteOffline(routeId);
    } catch (err) {
      console.error('[useOfflineDownload] deleteOffline error', err);
    }
  }, []);

  return {
    status,
    progress,
    total,
    downloaded,
    error,
    downloadForOffline,
    deleteOffline,
    reset,
  };
}
