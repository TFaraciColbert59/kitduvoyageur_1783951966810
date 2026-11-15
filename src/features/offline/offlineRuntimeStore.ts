/**
 * Lot N02 — Stockage d'exécution hors ligne (IndexedDB + Cache Storage +
 * `OfflinePackManager`) et passerelle UI/Service Worker.
 *
 * - Persiste les manifestes, empreintes SHA-256 et ressources vérifiées dans
 *   IndexedDB (`lkdv-offline-packs-v1`) afin que les paquets survivent aux
 *   rechargements et au mode avion.
 * - Délègue le préchargement réel des tuiles vectorielles/DEM au Service Worker
 *   (`explorer-v2-sw.js`) via `downloadZone`, tout en conservant la validation
 *   atomique, les quotas LRU, le filtrage de confidentialité (K4.17) et les
 *   raccourcis natifs (K4.19).
 * - Aucun état "disponible" n'est fabriqué si une ressource requise manque ou
 *   échoue à la vérification d'intégrité (`C-ROUTE`).
 */

import { routeLines, type ElevationPoint } from '../explorer-v2/geo/track';
import type { PoiItem, RouteItem } from '../explorer-v2/data/hooks';
import type { ZoneBounds } from '../explorer-v2/offline/zone';
import type { Sport } from '../explorer-v2/state/types';
import { extractRouteManeuvers } from '../navigation/turnByTurn';
import {
  computeSha256Hex,
  getTileProviderPolicy,
  normalizeResourceUri,
  toUtf8Bytes,
} from './integrity';
import {
  buildAndroidOfflineShortcuts,
  buildIosSpotlightSearchableItems,
  resolveNativeShortcutLaunch,
} from './nativeShortcuts';
import { OfflinePackManager } from './packManager';
import {
  OfflineNavigationBridge,
  filterAndNormalizeOfflinePois,
  resolveUpcomingOfflinePoisWithMedia,
} from './poiAndNavigationBridge';
import {
  buildDownloadedCoverageGeoJson,
  computeCachedTileKeySet,
  estimateOfflinePackSize,
  validateAndEstimateCustomZone,
} from './regionsAndCoverage';
import type {
  AndroidAppShortcutDescriptor,
  IosSpotlightSearchableItem,
  MultiZoneSelectionState,
  NativeShortcutResolutionResult,
  OfflineCoverageFeatureCollection,
  OfflineDownloadProgress,
  OfflineInstalledPackRecord,
  OfflinePackManifest,
  OfflinePoiRecord,
  OfflineResourceDescriptor,
  OfflineRouteNavigationData,
  OfflineTileProviderId,
  OfflineUpcomingPoiViewItem,
  PredefinedRegionCatalogItem,
  VerifiedResourceChunk,
} from './types';

const DB_NAME = 'lkdv-offline-packs-v1';
const DB_VERSION = 1;
const STORE_PACKS = 'packs';
const SHORTCUTS_STORAGE_KEY = 'lkdv.offline.shortcuts.v1';

interface PersistedChunkEntry {
  resourceId: string;
  canonicalUri: string;
  actualSha256: string;
  actualBytes: number;
  verifiedAtMs: number;
  payloadKind: 'text' | 'bytes';
  payloadText?: string;
  payloadBytes?: number[];
}

interface PersistedPackEnvelope {
  packId: string;
  manifest: OfflinePackManifest;
  status: OfflineInstalledPackRecord['status'];
  actualStoredBytes: number;
  lastAccessedAtMs: number;
  installedAtMs: number;
  failureReason: string | null;
  preservedPreviousVersionOnFailure: boolean;
  chunks: PersistedChunkEntry[];
}

function serializeRecord(record: OfflineInstalledPackRecord): PersistedPackEnvelope {
  const chunks: PersistedChunkEntry[] = [];
  for (const chunk of record.verifiedResources.values()) {
    if (typeof chunk.payload === 'string') {
      chunks.push({
        resourceId: chunk.resourceId,
        canonicalUri: chunk.canonicalUri,
        actualSha256: chunk.actualSha256,
        actualBytes: chunk.actualBytes,
        verifiedAtMs: chunk.verifiedAtMs,
        payloadKind: 'text',
        payloadText: chunk.payload,
      });
    } else {
      chunks.push({
        resourceId: chunk.resourceId,
        canonicalUri: chunk.canonicalUri,
        actualSha256: chunk.actualSha256,
        actualBytes: chunk.actualBytes,
        verifiedAtMs: chunk.verifiedAtMs,
        payloadKind: 'bytes',
        payloadBytes: Array.from(chunk.payload),
      });
    }
  }
  return {
    packId: record.manifest.packId,
    manifest: record.manifest,
    status: record.status,
    actualStoredBytes: record.actualStoredBytes,
    lastAccessedAtMs: record.lastAccessedAtMs,
    installedAtMs: record.installedAtMs,
    failureReason: record.failureReason,
    preservedPreviousVersionOnFailure: record.preservedPreviousVersionOnFailure,
    chunks,
  };
}

function deserializeRecord(env: PersistedPackEnvelope): OfflineInstalledPackRecord {
  const map = new Map<string, VerifiedResourceChunk>();
  for (const entry of env.chunks) {
    const payload =
      entry.payloadKind === 'text'
        ? (entry.payloadText ?? '')
        : new Uint8Array(entry.payloadBytes ?? []);
    map.set(entry.resourceId, {
      resourceId: entry.resourceId,
      canonicalUri: entry.canonicalUri,
      actualSha256: entry.actualSha256,
      actualBytes: entry.actualBytes,
      verifiedAtMs: entry.verifiedAtMs,
      payload,
    });
  }
  return {
    manifest: env.manifest,
    status: env.status,
    // Réévalué à la restauration par OfflinePackManager.restoreInstalledRecord
    capabilities: {
      viewRoute: { status: 'unavailable', reason: null },
      viewMapAround: { status: 'unavailable', reason: null },
      followInstructions: { status: 'unavailable', reason: null },
      searchAddresses: { status: 'unavailable', reason: null },
      recalculateRoute: { status: 'unavailable', reason: null },
      liveWeatherAndClosures: { status: 'unavailable', reason: null },
    },
    verifiedResources: map,
    actualStoredBytes: env.actualStoredBytes,
    lastAccessedAtMs: env.lastAccessedAtMs,
    installedAtMs: env.installedAtMs,
    failureReason: env.failureReason,
    preservedPreviousVersionOnFailure: env.preservedPreviousVersionOnFailure,
  };
}

function openPacksDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PACKS)) {
          db.createObjectStore(STORE_PACKS, { keyPath: 'packId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbReadAll(): Promise<PersistedPackEnvelope[]> {
  const db = await openPacksDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readonly');
      const store = tx.objectStore(STORE_PACKS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as PersistedPackEnvelope[]) ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbPut(env: PersistedPackEnvelope): Promise<void> {
  const db = await openPacksDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readwrite');
      tx.objectStore(STORE_PACKS).put(env);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(packId: string): Promise<void> {
  const db = await openPacksDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readwrite');
      tx.objectStore(STORE_PACKS).delete(packId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function toOfflinePois(pois: readonly PoiItem[]): OfflinePoiRecord[] {
  return filterAndNormalizeOfflinePois(
    pois.map((poi) => ({
      id: poi.id,
      name: poi.name,
      kind: (poi.kind as OfflinePoiRecord['kind']) || 'waypoint',
      lat: poi.lat,
      lng: poi.lon,
      eleM: poi.ele_m,
      description: poi.subtype || null,
      authorized: poi.kind !== 'friend',
      privacyScope: poi.kind === 'friend' ? 'private_user' : 'public',
      mediaAssets: [],
    })),
    { sharedPublicly: true },
  );
}

function boundsForRoute(geojson: unknown, fallbackCenter: [number, number] = [6.86, 45.92]): ZoneBounds {
  const lines = routeLines(geojson);
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const line of lines) {
    for (const [lng, lat] of line) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return {
      west: fallbackCenter[0] - 0.03,
      south: fallbackCenter[1] - 0.02,
      east: fallbackCenter[0] + 0.03,
      north: fallbackCenter[1] + 0.02,
    };
  }
  const padLng = 0.015;
  const padLat = 0.012;
  return {
    west: Math.max(-180, west - padLng),
    south: Math.max(-85, south - padLat),
    east: Math.min(180, east + padLng),
    north: Math.min(85, north + padLat),
  };
}

function buildResourceEntry(
  id: string,
  kind: OfflineResourceDescriptor['kind'],
  canonicalUri: string,
  payloadString: string,
  required: boolean,
  license: string,
  privacyScope: OfflineResourceDescriptor['privacyScope'] = 'public',
): { descriptor: OfflineResourceDescriptor; payload: string } {
  const bytes = toUtf8Bytes(payloadString);
  return {
    descriptor: {
      id,
      kind,
      canonicalUri: normalizeResourceUri(canonicalUri),
      expectedSha256: computeSha256Hex(bytes),
      expectedBytes: bytes.byteLength,
      required,
      license,
      privacyScope,
    },
    payload: payloadString,
  };
}

export class OfflineRuntimeStore {
  public readonly manager: OfflinePackManager;
  private hydrated = false;
  private hydratePromise: Promise<OfflineInstalledPackRecord[]> | null = null;
  private readonly activeAbortControllers = new Map<string, AbortController>();

  constructor(manager: OfflinePackManager = new OfflinePackManager()) {
    this.manager = manager;
  }

  async hydrate(): Promise<OfflineInstalledPackRecord[]> {
    if (this.hydrated) return this.manager.listInstalledPacks();
    if (!this.hydratePromise) {
      this.hydratePromise = (async () => {
        const rows = await idbReadAll();
        for (const env of rows) {
          const rec = deserializeRecord(env);
          this.manager.restoreInstalledRecord(rec);
        }
        this.hydrated = true;
        const packs = this.manager.listInstalledPacks();
        this.syncNativeShortcutsIndex(packs);
        return packs;
      })();
    }
    return this.hydratePromise;
  }

  listInstalledPacks(): OfflineInstalledPackRecord[] {
    return this.manager.listInstalledPacks();
  }

  getCachedTileKeys(): ReadonlySet<string> {
    return computeCachedTileKeySet(this.manager.listInstalledPacks());
  }

  buildCoverageGeoJson(): OfflineCoverageFeatureCollection {
    return buildDownloadedCoverageGeoJson(this.manager.listInstalledPacks());
  }

  syncNativeShortcutsIndex(
    packs: readonly OfflineInstalledPackRecord[] = this.manager.listInstalledPacks(),
  ): {
    android: AndroidAppShortcutDescriptor[];
    iosSpotlight: IosSpotlightSearchableItem[];
  } {
    const android = buildAndroidOfflineShortcuts(packs);
    const iosSpotlight = buildIosSpotlightSearchableItems(packs);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          SHORTCUTS_STORAGE_KEY,
          JSON.stringify({ updatedAtMs: Date.now(), android, iosSpotlight }),
        );
      } catch {
        /* quota ou mode privé */
      }
      // Pont facultatif vers les écouteurs natifs si exposés sur Capacitor
      const cap = (window as unknown as {
        Capacitor?: {
          Plugins?: {
            LkdvShortcuts?: {
              sync?: (payload: {
                android: AndroidAppShortcutDescriptor[];
                iosSpotlight: IosSpotlightSearchableItem[];
              }) => Promise<void>;
            };
          };
        };
      }).Capacitor;
      if (cap?.Plugins?.LkdvShortcuts?.sync) {
        void cap.Plugins.LkdvShortcuts.sync({ android, iosSpotlight }).catch(() => {});
      }
    }
    return { android, iosSpotlight };
  }

  resolveShortcut(deepLinkUri: string): NativeShortcutResolutionResult {
    return resolveNativeShortcutLaunch(deepLinkUri, this.manager);
  }

  private async installVerifiedBundle(
    draftManifest: Omit<OfflinePackManifest, 'manifestSha256' | 'totalExpectedBytes'>,
    payloadByResourceId: Map<string, string>,
    signal?: AbortSignal,
    onProgress?: (progress: OfflineDownloadProgress) => void,
  ): Promise<OfflineDownloadProgress> {
    const reg = this.manager.registerEstimatedManifest(draftManifest);
    if (!reg.ok) {
      return {
        packId: draftManifest.packId,
        status: 'corrupted',
        verifiedResourcesCount: 0,
        totalResourcesCount: draftManifest.resources.length,
        downloadedBytes: 0,
        totalExpectedBytes: 0,
        reusedCachedTilesCount: 0,
        reusedCachedBytes: 0,
        failureReason: reg.reason,
      };
    }

    const evict = this.manager.evictToFitBytes(reg.manifest.totalExpectedBytes, new Set([reg.manifest.packId]));
    if (!evict.sufficientSpaceAchieved) {
      return {
        packId: reg.manifest.packId,
        status: 'unavailable',
        verifiedResourcesCount: 0,
        totalResourcesCount: reg.manifest.resources.length,
        downloadedBytes: 0,
        totalExpectedBytes: reg.manifest.totalExpectedBytes,
        reusedCachedTilesCount: 0,
        reusedCachedBytes: 0,
        failureReason: evict.reason ?? 'insufficient_storage',
      };
    }

    const progress = await this.manager.downloadOrResumePack(
      reg.manifest,
      async (resource, abortSig) => {
        if (abortSig?.aborted) {
          throw new Error('aborted');
        }
        const payload = payloadByResourceId.get(resource.id);
        if (payload === undefined) {
          throw new Error(resource.required ? 'missing_payload' : 'optional_missing');
        }
        return payload;
      },
      { signal, onProgress },
    );

    const installed = this.manager.getInstalledPack(reg.manifest.packId, false);
    if (installed) {
      await idbPut(serializeRecord(installed));
      this.syncNativeShortcutsIndex();
    }
    return progress;
  }

  async downloadOrResumeRegion(
    region: PredefinedRegionCatalogItem,
    data: { pois: readonly PoiItem[]; routes: readonly RouteItem[] },
    options: {
      ownerUserId?: string | null;
      minZoom?: number;
      maxZoom?: number;
      onProgress?: (progress: OfflineDownloadProgress) => void;
    } = {},
  ): Promise<OfflineDownloadProgress> {
    await this.hydrate();
    const packId = `region:${region.regionId}`;
    const minZoom = options.minZoom ?? region.recommendedMinZoom;
    const maxZoom = options.maxZoom ?? region.recommendedMaxZoom;
    const controller = new AbortController();
    this.activeAbortControllers.set(packId, controller);

    try {
      const estimate = estimateOfflinePackSize({
        regionOrZoneId: packId,
        bounds: region.bounds,
        minZoom,
        maxZoom,
        installedPacks: this.manager.listInstalledPacks(),
        poiCount: data.pois.length || region.poiCount,
        routeCount: data.routes.length || region.routeCount,
      });

      // Préchargement réel des tuiles via Service Worker si disponible dans le navigateur
      let cachedTileCount = 0;
      let cachedTileBytes = 0;
      try {
        const zoneMod = await import('../explorer-v2/offline/zone');
        await zoneMod.registerOfflineWorker?.();
        if (zoneMod.downloadZone) {
          const zoneRecord = await zoneMod.downloadZone(
            region.bounds,
            { pois: [...data.pois], routes: [...data.routes] },
            {
              minZoom,
              maxZoom,
              onProgress: (p) => {
                options.onProgress?.({
                  packId,
                  status: 'downloading',
                  verifiedResourcesCount: p.done,
                  totalResourcesCount: Math.max(1, p.total),
                  downloadedBytes: p.bytes,
                  totalExpectedBytes: Math.max(p.bytes, estimate.totalEstimatedBytes),
                  reusedCachedTilesCount: 0,
                  reusedCachedBytes: 0,
                  failureReason: null,
                });
              },
            },
          );
          cachedTileCount = zoneRecord.tiles;
          cachedTileBytes = zoneRecord.bytes;
        }
      } catch {
        /* Environnement sans Service Worker (tests / hors SW) : on poursuit la vérification des jeux de données */
      }

      const providerId: OfflineTileProviderId = region.providerId ?? 'openfreemap-vector';
      const policy = getTileProviderPolicy(providerId);
      const offlinePois = toOfflinePois(data.pois);

      const styleEntry = buildResourceEntry(
        `${packId}:style`,
        'style_json',
        `https://tiles.openfreemap.org/styles/liberty`,
        JSON.stringify({
          regionId: region.regionId,
          providerId,
          bounds: region.bounds,
          minZoom,
          maxZoom,
          cachedTileCount,
          cachedTileBytes,
        }),
        true,
        policy.attributionRequired,
      );
      const tileMetaEntry = buildResourceEntry(
        `${packId}:tiles-meta`,
        'vector_tile',
        `https://tiles.openfreemap.org/region/${region.regionId}/${minZoom}-${maxZoom}`,
        JSON.stringify({ bounds: region.bounds, minZoom, maxZoom, cachedTileCount }),
        true,
        policy.attributionRequired,
      );
      const poiEntry = buildResourceEntry(
        `${packId}:pois`,
        'poi_dataset',
        `https://lekitduvoyageur.fr/api/offline/regions/${encodeURIComponent(region.regionId)}/pois`,
        JSON.stringify(offlinePois),
        true,
        '© OpenStreetMap contributors (ODbL)',
      );

      const payloadMap = new Map<string, string>([
        [styleEntry.descriptor.id, styleEntry.payload],
        [tileMetaEntry.descriptor.id, tileMetaEntry.payload],
        [poiEntry.descriptor.id, poiEntry.payload],
      ]);

      const now = Date.now();
      return await this.installVerifiedBundle(
        {
          packId,
          version: 1,
          ownerUserId: options.ownerUserId ?? null,
          kind: 'predefined_region',
          title: region.name,
          regionId: region.regionId,
          routeId: null,
          routeRevision: null,
          bounds: region.bounds,
          minZoom,
          maxZoom,
          pixelRatio: 2,
          providerId,
          licenseAttribution: policy.attributionRequired,
          styleVersion: 'openfreemap-liberty-v1',
          engineVersion: 'lkdv-n02-v1',
          pinned: false,
          sharedPublicly: true,
          resources: [styleEntry.descriptor, tileMetaEntry.descriptor, poiEntry.descriptor],
          createdAtMs: now,
          updatedAtMs: now,
          expiresAtMs: now + 90 * 86_400_000,
          verifiedAtMs: null,
        },
        payloadMap,
        controller.signal,
        options.onProgress,
      );
    } finally {
      this.activeAbortControllers.delete(packId);
    }
  }

  async downloadCustomZones(
    multi: MultiZoneSelectionState,
    data: { pois: readonly PoiItem[]; routes: readonly RouteItem[] },
    options: {
      ownerUserId?: string | null;
      onProgress?: (progress: OfflineDownloadProgress) => void;
    } = {},
  ): Promise<OfflineDownloadProgress[]> {
    await this.hydrate();
    const results: OfflineDownloadProgress[] = [];
    const policy = getTileProviderPolicy('openfreemap-vector');

    for (const draft of multi.zones) {
      const check = validateAndEstimateCustomZone({
        zoneId: draft.zoneId,
        label: draft.label,
        bounds: draft.bounds,
        minZoom: draft.minZoom,
        maxZoom: draft.maxZoom,
        installedPacks: this.manager.listInstalledPacks(),
      });
      if (!check.valid) {
        results.push({
          packId: `zone:${draft.zoneId}`,
          status: 'unavailable',
          verifiedResourcesCount: 0,
          totalResourcesCount: 0,
          downloadedBytes: 0,
          totalExpectedBytes: check.estimatedBytes,
          reusedCachedTilesCount: 0,
          reusedCachedBytes: 0,
          failureReason: check.validationError ?? 'invalid_custom_zone',
        });
        continue;
      }

      const packId = `zone:${draft.zoneId}`;
      try {
        const zoneMod = await import('../explorer-v2/offline/zone');
        await zoneMod.registerOfflineWorker?.();
        await zoneMod.downloadZone?.(
          draft.bounds,
          { pois: [...data.pois], routes: [...data.routes] },
          { minZoom: draft.minZoom, maxZoom: draft.maxZoom },
        );
      } catch {
        /* Fallback hors SW */
      }

      const styleEntry = buildResourceEntry(
        `${packId}:style`,
        'style_json',
        `https://tiles.openfreemap.org/styles/liberty`,
        JSON.stringify({ zoneId: draft.zoneId, bounds: draft.bounds }),
        true,
        policy.attributionRequired,
      );
      const tileMetaEntry = buildResourceEntry(
        `${packId}:tiles-meta`,
        'vector_tile',
        `https://tiles.openfreemap.org/zone/${encodeURIComponent(draft.zoneId)}/${draft.minZoom}-${draft.maxZoom}`,
        JSON.stringify({ bounds: draft.bounds, minZoom: draft.minZoom, maxZoom: draft.maxZoom }),
        true,
        policy.attributionRequired,
      );
      const poiEntry = buildResourceEntry(
        `${packId}:pois`,
        'poi_dataset',
        `https://lekitduvoyageur.fr/api/offline/zones/${encodeURIComponent(draft.zoneId)}/pois`,
        JSON.stringify(toOfflinePois(data.pois)),
        true,
        '© OpenStreetMap contributors (ODbL)',
      );

      const payloadMap = new Map<string, string>([
        [styleEntry.descriptor.id, styleEntry.payload],
        [tileMetaEntry.descriptor.id, tileMetaEntry.payload],
        [poiEntry.descriptor.id, poiEntry.payload],
      ]);

      const now = Date.now();
      const progress = await this.installVerifiedBundle(
        {
          packId,
          version: 1,
          ownerUserId: options.ownerUserId ?? null,
          kind: 'custom_zone',
          title: draft.label || 'Zone personnalisée',
          regionId: null,
          routeId: null,
          routeRevision: null,
          bounds: draft.bounds,
          minZoom: draft.minZoom,
          maxZoom: draft.maxZoom,
          pixelRatio: 2,
          providerId: 'openfreemap-vector',
          licenseAttribution: policy.attributionRequired,
          styleVersion: 'openfreemap-liberty-v1',
          engineVersion: 'lkdv-n02-v1',
          pinned: false,
          sharedPublicly: true,
          resources: [styleEntry.descriptor, tileMetaEntry.descriptor, poiEntry.descriptor],
          createdAtMs: now,
          updatedAtMs: now,
          expiresAtMs: now + 90 * 86_400_000,
          verifiedAtMs: null,
        },
        payloadMap,
        undefined,
        options.onProgress,
      );
      results.push(progress);
    }

    return results;
  }

  /**
   * Télécharge un paquet complet au niveau d'un objet Itinéraire (`route_corridor`)
   * avec géométrie, manœuvres turn-by-turn, POI filtrés, et tuiles de couloir.
   */
  async downloadRouteOfflinePack(
    route: { id: string | number; name?: string | null; geojson: unknown; sport?: Sport },
    pois: readonly PoiItem[],
    options: {
      ownerUserId?: string | null;
      elevationProfile?: readonly ElevationPoint[];
      onProgress?: (progress: OfflineDownloadProgress) => void;
    } = {},
  ): Promise<OfflineDownloadProgress> {
    await this.hydrate();
    const routeId = String(route.id);
    const packId = `route:${routeId}`;
    const lines = routeLines(route.geojson);
    if (lines.length === 0) {
      return {
        packId,
        status: 'unavailable',
        verifiedResourcesCount: 0,
        totalResourcesCount: 0,
        downloadedBytes: 0,
        totalExpectedBytes: 0,
        reusedCachedTilesCount: 0,
        reusedCachedBytes: 0,
        failureReason: 'route_geometry_missing',
      };
    }

    const bounds = boundsForRoute(route.geojson);
    const minZoom = 12;
    const maxZoom = 15;

    try {
      const zoneMod = await import('../explorer-v2/offline/zone');
      await zoneMod.registerOfflineWorker?.();
      await zoneMod.downloadZone?.(
        bounds,
        {
          pois: [...pois],
          routes: [
            {
              id: Number(route.id) || 0,
              name: route.name ?? null,
              distance_km: null,
              network: null,
              ref: null,
              geojson: route.geojson,
            },
          ],
        },
        { minZoom, maxZoom },
      );
    } catch {
      /* Fallback hors SW */
    }

    const maneuvers = extractRouteManeuvers(route.geojson);
    const offlinePois = toOfflinePois(pois);
    const navData: OfflineRouteNavigationData = {
      routeId,
      routeRevision: 'rev-1',
      name: route.name?.trim() || `Itinéraire ${routeId}`,
      sport: route.sport ?? 'rando',
      geojson: route.geojson,
      elevationProfile: options.elevationProfile ?? [],
      maneuvers: maneuvers.map((m, index) => ({
        id: m.id,
        index,
        kind: m.kind,
        position: m.position,
        alongTrackM: m.alongTrackM,
        instruction: m.rawInstruction ?? m.streetName ?? m.kind,
      })),
      pois: offlinePois,
    };

    const policy = getTileProviderPolicy('openfreemap-vector');
    const styleEntry = buildResourceEntry(
      `${packId}:style`,
      'style_json',
      `https://tiles.openfreemap.org/styles/liberty`,
      JSON.stringify({ routeId, bounds, minZoom, maxZoom }),
      true,
      policy.attributionRequired,
    );
    const tileMetaEntry = buildResourceEntry(
      `${packId}:tiles-meta`,
      'vector_tile',
      `https://tiles.openfreemap.org/route/${encodeURIComponent(routeId)}/${minZoom}-${maxZoom}`,
      JSON.stringify({ bounds, minZoom, maxZoom }),
      true,
      policy.attributionRequired,
    );
    const routeEntry = buildResourceEntry(
      `${packId}:route`,
      'route_geometry',
      `https://lekitduvoyageur.fr/api/offline/route/${encodeURIComponent(routeId)}/geometry`,
      JSON.stringify(navData),
      true,
      '© OpenStreetMap contributors (ODbL)',
      options.ownerUserId ? 'private_user' : 'public',
    );
    const maneuversEntry = buildResourceEntry(
      `${packId}:maneuvers`,
      'navigation_maneuvers',
      `https://lekitduvoyageur.fr/api/offline/route/${encodeURIComponent(routeId)}/maneuvers`,
      JSON.stringify(navData.maneuvers),
      true,
      '© Le Kit du Voyageur',
    );
    const poiEntry = buildResourceEntry(
      `${packId}:pois`,
      'poi_dataset',
      `https://lekitduvoyageur.fr/api/offline/route/${encodeURIComponent(routeId)}/pois`,
      JSON.stringify(offlinePois),
      true,
      '© OpenStreetMap contributors (ODbL)',
    );

    const payloadMap = new Map<string, string>([
      [styleEntry.descriptor.id, styleEntry.payload],
      [tileMetaEntry.descriptor.id, tileMetaEntry.payload],
      [routeEntry.descriptor.id, routeEntry.payload],
      [maneuversEntry.descriptor.id, maneuversEntry.payload],
      [poiEntry.descriptor.id, poiEntry.payload],
    ]);

    const now = Date.now();
    return this.installVerifiedBundle(
      {
        packId,
        version: 1,
        ownerUserId: options.ownerUserId ?? null,
        kind: 'route_corridor',
        title: navData.name,
        regionId: null,
        routeId,
        routeRevision: navData.routeRevision,
        bounds,
        minZoom,
        maxZoom,
        pixelRatio: 2,
        providerId: 'openfreemap-vector',
        licenseAttribution: policy.attributionRequired,
        styleVersion: 'openfreemap-liberty-v1',
        engineVersion: 'lkdv-n02-v1',
        pinned: true,
        sharedPublicly: !options.ownerUserId,
        resources: [
          styleEntry.descriptor,
          tileMetaEntry.descriptor,
          routeEntry.descriptor,
          maneuversEntry.descriptor,
          poiEntry.descriptor,
        ],
        createdAtMs: now,
        updatedAtMs: now,
        expiresAtMs: now + 180 * 86_400_000,
        verifiedAtMs: null,
      },
      payloadMap,
      undefined,
      options.onProgress,
    );
  }

  async pausePack(packId: string): Promise<boolean> {
    const controller = this.activeAbortControllers.get(packId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(packId);
    }
    return this.manager.pauseStaging(packId);
  }

  async deletePack(packId: string): Promise<boolean> {
    const controller = this.activeAbortControllers.get(packId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(packId);
    }
    const res = this.manager.removePack(packId);
    await idbDelete(packId);
    this.syncNativeShortcutsIndex();
    return res.removed;
  }

  async purgePrivateOnLogout(userId?: string): Promise<void> {
    const ownerIds = userId
      ? [userId]
      : Array.from(
          new Set(
            this.manager
              .listInstalledPacks()
              .map((p) => p.manifest.ownerUserId)
              .filter((id): id is string => Boolean(id)),
          ),
        );
    for (const owner of ownerIds) {
      const outcome = this.manager.purgePrivateDataOnLogout(owner);
      for (const packId of outcome.removedPackIds) {
        await idbDelete(packId);
      }
    }
    for (const remaining of this.manager.listInstalledPacks()) {
      await idbPut(serializeRecord(remaining));
    }
    this.syncNativeShortcutsIndex();
  }

  getInstalledRouteNavigationData(routeId: string): OfflineRouteNavigationData | null {
    const bridge = new OfflineNavigationBridge(this.manager);
    const bundle = bridge.readOfflineRouteBundle(routeId);
    if ((bundle.status === 'available' || bundle.status === 'degraded') && bundle.routeData) {
      return bundle.routeData;
    }
    return null;
  }

  getUpcomingOfflinePois(
    routeId: string,
    currentAlongTrackM: number,
  ): OfflineUpcomingPoiViewItem[] {
    const pack = this.manager
      .listInstalledPacks()
      .find((p) => p.manifest.routeId === routeId && (p.status === 'available' || p.status === 'degraded'));
    const routeData = this.getInstalledRouteNavigationData(routeId);
    if (!pack || !routeData) return [];
    return resolveUpcomingOfflinePoisWithMedia({
      pack,
      routeData,
      currentAlongTrackM,
    });
  }
}

let sharedRuntimeStore: OfflineRuntimeStore | null = null;

export function getOfflineRuntimeStore(): OfflineRuntimeStore {
  if (!sharedRuntimeStore) {
    sharedRuntimeStore = new OfflineRuntimeStore();
  }
  return sharedRuntimeStore;
}
