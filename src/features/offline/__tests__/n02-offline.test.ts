import { describe, expect, it } from 'vitest';
import {
  AVG_DEM_TILE_BYTES,
  AVG_VECTOR_TILE_BYTES,
  GLYPH_RANGES_BASE_BYTES,
  OfflineNavigationBridge,
  OfflinePackManager,
  STYLE_AND_SPRITES_BASE_BYTES,
  buildAndroidOfflineShortcuts,
  buildDownloadedCoverageGeoJson,
  buildIosSpotlightSearchableItems,
  closeOfflineSubDrawerAndRestoreParent,
  computeManifestSha256,
  computeSha256Hex,
  enumerateTilesForBounds,
  estimateOfflinePackSize,
  evaluateMultiZoneSelection,
  evaluateOfflineClosures,
  evaluateViewportOfflineCoverage,
  filterAndNormalizeOfflinePois,
  getPredefinedRegionById,
  getTileProviderPolicy,
  isProviderAllowedForOfflinePack,
  listPredefinedRegions,
  normalizeResourceUri,
  openOfflineSubDrawer,
  queryIosSpotlightOfflineIndex,
  resolveNativeShortcutLaunch,
  resolveUpcomingOfflinePoisWithMedia,
  toUtf8Bytes,
  validateAndEstimateCustomZone,
  validatePackManifest,
  type OfflinePackManifest,
  type OfflinePoiRecord,
  type OfflineResourceDescriptor,
  type OfflineRouteNavigationData,
  type ZoneBounds,
} from '../index';

function makeResource(
  id: string,
  kind: OfflineResourceDescriptor['kind'],
  uri: string,
  content: string | Uint8Array,
  options: {
    required?: boolean;
    license?: string;
    privacyScope?: 'public' | 'private_user';
    tile?: { z: number; x: number; y: number };
  } = {},
): { descriptor: OfflineResourceDescriptor; payload: Uint8Array } {
  const payload = toUtf8Bytes(content);
  return {
    descriptor: {
      id,
      kind,
      canonicalUri: normalizeResourceUri(uri),
      tile: options.tile,
      expectedSha256: computeSha256Hex(payload),
      expectedBytes: payload.byteLength,
      required: options.required ?? true,
      license: options.license ?? '© OpenFreeMap © OpenStreetMap contributors',
      privacyScope: options.privacyScope ?? 'public',
    },
    payload,
  };
}

function buildTestManifest(params: {
  packId: string;
  version?: number;
  title?: string;
  bounds?: ZoneBounds;
  minZoom?: number;
  maxZoom?: number;
  pinned?: boolean;
  sharedPublicly?: boolean;
  ownerUserId?: string | null;
  kind?: OfflinePackManifest['kind'];
  regionId?: string | null;
  routeId?: string | null;
  expiresAtMs?: number | null;
  resources: OfflineResourceDescriptor[];
}): OfflinePackManifest {
  const totalExpectedBytes = params.resources.reduce((sum, r) => sum + r.expectedBytes, 0);
  const base: Omit<OfflinePackManifest, 'manifestSha256'> = {
    packId: params.packId,
    version: params.version ?? 1,
    ownerUserId: params.ownerUserId ?? null,
    kind: params.kind ?? 'predefined_region',
    title: params.title ?? `Pack ${params.packId}`,
    regionId: params.regionId ?? 'fr-calanques-marseille',
    routeId: params.routeId ?? null,
    routeRevision: params.routeId ? 'rev-1' : null,
    bounds: params.bounds ?? { west: 5.35, south: 43.18, east: 5.42, north: 43.22 },
    minZoom: params.minZoom ?? 10,
    maxZoom: params.maxZoom ?? 12,
    pixelRatio: 2,
    providerId: 'openfreemap-vector',
    licenseAttribution: '© OpenFreeMap © OpenStreetMap contributors',
    styleVersion: 'positron-2026.11',
    engineVersion: 'maplibre-5.0',
    pinned: params.pinned ?? true,
    sharedPublicly: params.sharedPublicly ?? false,
    resources: params.resources,
    totalExpectedBytes,
    createdAtMs: 1_700_000_000_000,
    updatedAtMs: 1_700_000_000_000,
    expiresAtMs: params.expiresAtMs ?? null,
    verifiedAtMs: null,
  };

  return {
    ...base,
    manifestSha256: computeManifestSha256(base),
  };
}

describe('Lot N02 — Paquets hors ligne, cartes offline, intégrité, guidage et raccourcis (K4.14..K4.17, K4.19)', () => {
  describe('K4.14 & Recherche 04 · Fournisseurs licenciés, normalisation URI et manifeste SHA-256', () => {
    it('refuse fail-closed les tuiles raster publiques OSM et documente les spécificités iOS PMTiles / Android', () => {
      expect(isProviderAllowedForOfflinePack('osm-public-raster')).toBe(false);
      const osmPolicy = getTileProviderPolicy('osm-public-raster');
      expect(osmPolicy.allowedForOfflinePack).toBe(false);
      expect(osmPolicy.rejectionReason).toContain('OSMF');

      const pmtilesPolicy = getTileProviderPolicy('protomaps-pmtiles');
      expect(pmtilesPolicy.allowedForOfflinePack).toBe(true);
      expect(pmtilesPolicy.participatesInIosNativeOfflinePackApi).toBe(false);
      expect(pmtilesPolicy.supportedTargets).toContain('ios-local-pmtiles');

      const ofmPolicy = getTileProviderPolicy('openfreemap-vector');
      expect(ofmPolicy.allowedForOfflinePack).toBe(true);
      expect(ofmPolicy.requiresExplicitDownloadStartOnAndroid).toBe(true);
    });

    it('nettoie les jetons temporaires des URIs de ressources et valide le checksum SHA-256 du manifeste', () => {
      const rawUrl =
        'https://tiles.openfreemap.org/planet/12/2109/1496.pbf?token=eyJhbGci&X-Amz-Signature=deadbeef&layer=base';
      const cleaned = normalizeResourceUri(rawUrl);
      expect(cleaned).toBe('https://tiles.openfreemap.org/planet/12/2109/1496.pbf?layer=base');

      const styleRes = makeResource('style-1', 'style_json', 'https://tiles.openfreemap.org/styles/positron', '{"version":8}');
      const tileRes = makeResource(
        'tile-1',
        'vector_tile',
        'https://tiles.openfreemap.org/planet/10/527/374.pbf',
        'MVT_PAYLOAD_10_527_374',
        { tile: { z: 10, x: 527, y: 374 } },
      );

      const manifest = buildTestManifest({
        packId: 'pack-chamonix',
        resources: [styleRes.descriptor, tileRes.descriptor],
      });

      expect(validatePackManifest(manifest)).toEqual({ valid: true, reason: null });

      // Altération de la somme de contrôle du manifeste
      const tampered: OfflinePackManifest = {
        ...manifest,
        manifestSha256: '0'.repeat(64),
      };
      expect(validatePackManifest(tampered)).toEqual({
        valid: false,
        reason: 'manifest_checksum_mismatch',
      });

      // Interdiction de ressource privée dans un paquet partagé publiquement
      const privatePhoto = makeResource(
        'photo-priv',
        'media_preview',
        'https://cdn.lkdv.local/private/u1.webp?token=secret123',
        'WEBP_PRIVATE_DATA',
        { privacyScope: 'private_user' },
      );
      const illegalPublicManifest = buildTestManifest({
        packId: 'pack-public-illegal',
        sharedPublicly: true,
        resources: [styleRes.descriptor, privatePhoto.descriptor],
      });
      expect(validatePackManifest(illegalPublicManifest)).toEqual({
        valid: false,
        reason: 'private_resource_in_public_pack',
      });
    });
  });

  describe('Invariants d’intégrité · Staging, Swap atomique, Reprise sur coupure & Fail-Closed sur corruption', () => {
    it('rejette un paquet corrompu (SHA-256 ou taille tronquée) sans jamais le marquer disponible', async () => {
      const manager = new OfflinePackManager();
      const styleRes = makeResource('style', 'style_json', 'https://tiles.openfreemap.org/styles/positron', '{"version":8}');
      const tileRes = makeResource(
        'tile-10-527-374',
        'vector_tile',
        'https://tiles.openfreemap.org/planet/10/527/374.pbf',
        'VALID_TILE_BINARY_DATA_123456',
        { tile: { z: 10, x: 527, y: 374 } },
      );

      const manifest = buildTestManifest({
        packId: 'pack-corrupt-test',
        resources: [styleRes.descriptor, tileRes.descriptor],
      });

      const progress = await manager.downloadOrResumePack(manifest, async (res) => {
        if (res.id === 'style') return styleRes.payload;
        // Renvoie un payload altéré de même longueur mais au contenu différent (SHA-256 invalide)
        return toUtf8Bytes('CORRUPTED_BINARY_DATA_9999999');
      });

      expect(progress.status).toBe('corrupted');
      expect(progress.failureReason).toContain('sha256_mismatch');
      expect(manager.getPackStatus('pack-corrupt-test')).toBe('corrupted');
      expect(manager.getInstalledPack('pack-corrupt-test')).toBeNull();
    });

    it('préserve la dernière version valide (swap atomique) lorsqu’une mise à jour échoue ou est corrompue', async () => {
      const manager = new OfflinePackManager();
      const styleV1 = makeResource('style', 'style_json', 'https://tiles.openfreemap.org/styles/positron', '{"v":1}');
      const tileV1 = makeResource(
        'tile-1',
        'vector_tile',
        'https://tiles.openfreemap.org/planet/10/527/374.pbf',
        'TILE_V1_VALID',
        { tile: { z: 10, x: 527, y: 374 } },
      );

      const manifestV1 = buildTestManifest({
        packId: 'pack-atomic',
        version: 1,
        resources: [styleV1.descriptor, tileV1.descriptor],
      });

      const resV1 = await manager.downloadOrResumePack(manifestV1, async (r) =>
        r.id === 'style' ? styleV1.payload : tileV1.payload,
      );
      expect(resV1.status).toBe('available');
      expect(manager.getInstalledPack('pack-atomic')?.manifest.version).toBe(1);

      // Tentative de remplacement par une v2 dont la tuile est tronquée
      const styleV2 = makeResource('style', 'style_json', 'https://tiles.openfreemap.org/styles/positron', '{"v":2}');
      const tileV2 = makeResource(
        'tile-1',
        'vector_tile',
        'https://tiles.openfreemap.org/planet/10/527/374.pbf',
        'TILE_V2_COMPLETE_EXPECTED_PAYLOAD',
        { tile: { z: 10, x: 527, y: 374 } },
      );
      const manifestV2 = buildTestManifest({
        packId: 'pack-atomic',
        version: 2,
        resources: [styleV2.descriptor, tileV2.descriptor],
      });

      const resV2 = await manager.downloadOrResumePack(manifestV2, async (r) =>
        r.id === 'style' ? styleV2.payload : toUtf8Bytes('TRUNCATED'),
      );

      expect(resV2.status).toBe('corrupted');
      expect(resV2.failureReason).toContain('byte_length_mismatch');

      // Le paquet actif est toujours la version 1 intacte et disponible !
      const preserved = manager.getInstalledPack('pack-atomic');
      expect(preserved).not.toBeNull();
      expect(preserved?.status).toBe('available');
      expect(preserved?.manifest.version).toBe(1);
      expect(preserved?.preservedPreviousVersionOnFailure).toBe(true);
    });

    it('reprend un téléchargement interrompu sans retélécharger les ressources déjà vérifiées et libère l’espace à la suppression', async () => {
      const manager = new OfflinePackManager();
      const styleRes = makeResource('style', 'style_json', 'https://tiles.openfreemap.org/styles/positron', '{"v":8}');
      const tile1 = makeResource(
        'tile-1',
        'vector_tile',
        'https://tiles.openfreemap.org/planet/10/527/374.pbf',
        'TILE_PAYLOAD_ONE',
        { tile: { z: 10, x: 527, y: 374 } },
      );
      const tile2 = makeResource(
        'tile-2',
        'vector_tile',
        'https://tiles.openfreemap.org/planet/10/528/374.pbf',
        'TILE_PAYLOAD_TWO',
        { tile: { z: 10, x: 528, y: 374 } },
      );

      const manifest = buildTestManifest({
        packId: 'pack-resume',
        resources: [styleRes.descriptor, tile1.descriptor, tile2.descriptor],
      });

      const fetchedIdsPass1: string[] = [];
      const pass1 = await manager.downloadOrResumePack(manifest, async (res) => {
        fetchedIdsPass1.push(res.id);
        if (res.id === 'style') return styleRes.payload;
        if (res.id === 'tile-1') return tile1.payload;
        throw new Error('network_cut_airplane_transition');
      });

      // Interrompu avant la fin : jamais marqué 'available' prématurément
      expect(pass1.status).toBe('paused');
      expect(pass1.verifiedResourcesCount).toBe(2);
      expect(manager.getPackStatus('pack-resume')).toBe('paused');
      expect(manager.getInstalledPack('pack-resume')).toBeNull();

      // Reprise : seule la ressource 'tile-2' manquante doit être téléchargée
      const fetchedIdsPass2: string[] = [];
      const pass2 = await manager.downloadOrResumePack(manifest, async (res) => {
        fetchedIdsPass2.push(res.id);
        return tile2.payload;
      });

      expect(fetchedIdsPass2).toEqual(['tile-2']);
      expect(pass2.status).toBe('available');
      expect(manager.getPackStatus('pack-resume')).toBe('available');

      const usageBeforeDelete = manager.getStorageUsage();
      expect(usageBeforeDelete.totalUsedBytes).toBe(manifest.totalExpectedBytes);
      expect(usageBeforeDelete.recordedActivitySessionsProtected).toBe(true);

      // Suppression du paquet : libère exactement l'espace annoncé
      const removal = manager.removePack('pack-resume');
      expect(removal.removed).toBe(true);
      expect(removal.freedBytes).toBe(manifest.totalExpectedBytes);
      expect(removal.storageSummary.totalUsedBytes).toBe(0);
      expect(manager.getPackStatus('pack-resume')).toBe('unavailable');
    });

    it('identifie la disponibilité dégradée si le style et les tuiles sont présents mais les glyphes manquent', async () => {
      const manager = new OfflinePackManager();
      const styleRes = makeResource('style', 'style_json', 'https://tiles.openfreemap.org/styles/positron', '{"v":8}');
      const tileRes = makeResource(
        'tile-1',
        'vector_tile',
        'https://tiles.openfreemap.org/planet/10/527/374.pbf',
        'TILE_PAYLOAD_OK',
        { tile: { z: 10, x: 527, y: 374 } },
      );
      const glyphRes = makeResource(
        'glyph-0-255',
        'glyph_range',
        'https://tiles.openfreemap.org/fonts/Noto/0-255.pbf',
        'GLYPH_PBF_DATA',
        { required: false },
      );

      const manifest = buildTestManifest({
        packId: 'pack-degraded-glyphs',
        resources: [styleRes.descriptor, tileRes.descriptor, glyphRes.descriptor],
      });

      const progress = await manager.downloadOrResumePack(manifest, async (res) => {
        if (res.id === 'style') return styleRes.payload;
        if (res.id === 'tile-1') return tileRes.payload;
        throw new Error('optional_missing_404');
      });

      expect(progress.status).toBe('degraded');
      const installed = manager.getInstalledPack('pack-degraded-glyphs');
      expect(installed?.status).toBe('degraded');
      expect(installed?.capabilities.viewMapAround.status).toBe('degraded');
      expect(installed?.capabilities.viewMapAround.reason).toContain('police/glyphes manquants');
    });
  });

  describe('Quotas, éviction LRU et politique de déconnexion (logout)', () => {
    it('purge d’abord le cache ambiant puis évicte les paquets non épinglés en LRU tout en protégeant les paquets épinglés', async () => {
      const manager = new OfflinePackManager({
        maxTotalBytes: 1_000,
        maxAmbientCacheBytes: 300,
        minFreeHeadroomBytes: 50,
      });
      manager.setAmbientCacheBytes(200);

      const resPinned = makeResource('r-pin', 'vector_tile', 'https://tiles.openfreemap.org/p/1.pbf', 'A'.repeat(300));
      const resUnpinnedOld = makeResource('r-old', 'vector_tile', 'https://tiles.openfreemap.org/p/2.pbf', 'B'.repeat(250));
      const resUnpinnedNew = makeResource('r-new', 'vector_tile', 'https://tiles.openfreemap.org/p/3.pbf', 'C'.repeat(250));

      const manifestPinned = buildTestManifest({
        packId: 'pinned-pack',
        pinned: true,
        resources: [resPinned.descriptor],
      });
      const manifestOld = buildTestManifest({
        packId: 'unpinned-old',
        pinned: false,
        resources: [resUnpinnedOld.descriptor],
      });
      const manifestNew = buildTestManifest({
        packId: 'unpinned-new',
        pinned: false,
        resources: [resUnpinnedNew.descriptor],
      });

      await manager.downloadOrResumePack(manifestPinned, async () => resPinned.payload, { nowMs: 1_000 });
      await manager.downloadOrResumePack(manifestOld, async () => resUnpinnedOld.payload, { nowMs: 2_000 });
      await manager.downloadOrResumePack(manifestNew, async () => resUnpinnedNew.payload, { nowMs: 3_000 });

      // Téléchargement d'un nouveau paquet de 350 octets : doit purger le cache ambiant et évincer 'unpinned-old'
      const resIncoming = makeResource('r-inc', 'vector_tile', 'https://tiles.openfreemap.org/p/4.pbf', 'D'.repeat(350));
      const manifestIncoming = buildTestManifest({
        packId: 'incoming-pack',
        pinned: true,
        resources: [resIncoming.descriptor],
      });

      const incomingProgress = await manager.downloadOrResumePack(
        manifestIncoming,
        async () => resIncoming.payload,
        { nowMs: 4_000 },
      );

      expect(incomingProgress.status).toBe('available');
      expect(manager.getAmbientCacheBytes()).toBe(0);
      expect(manager.getInstalledPack('pinned-pack')).not.toBeNull();
      expect(manager.getInstalledPack('unpinned-old')).toBeNull();
      expect(manager.getInstalledPack('unpinned-new')).not.toBeNull();
    });

    it('purge les données personnelles au logout sans supprimer les paquets régionaux publics', async () => {
      const manager = new OfflinePackManager();
      const publicTile = makeResource('pub-tile', 'vector_tile', 'https://tiles.openfreemap.org/p/10.pbf', 'PUBLIC_MAP_DATA');
      const privateMedia = makeResource(
        'priv-photo',
        'media_preview',
        'https://cdn.lkdv.local/user/42/photo.webp',
        'PRIVATE_USER_PHOTO',
        { privacyScope: 'private_user', required: false },
      );

      const regionManifest = buildTestManifest({
        packId: 'region-with-private-media',
        kind: 'predefined_region',
        ownerUserId: null,
        sharedPublicly: false,
        resources: [publicTile.descriptor, privateMedia.descriptor],
      });

      const routeManifest = buildTestManifest({
        packId: 'user-personal-route',
        kind: 'route_corridor',
        ownerUserId: 'user-42',
        routeId: 'route-secret',
        resources: [publicTile.descriptor],
      });

      await manager.downloadOrResumePack(regionManifest, async (r) =>
        r.id === 'pub-tile' ? publicTile.payload : privateMedia.payload,
      );
      await manager.downloadOrResumePack(routeManifest, async () => publicTile.payload);

      const logoutOutcome = manager.purgePrivateDataOnLogout('user-42');
      expect(logoutOutcome.removedPackIds).toContain('user-personal-route');
      expect(logoutOutcome.strippedPrivateResourceCount).toBe(1);
      expect(manager.getInstalledPack('user-personal-route')).toBeNull();

      const survivingRegion = manager.getInstalledPack('region-with-private-media');
      expect(survivingRegion).not.toBeNull();
      expect(survivingRegion?.verifiedResources.has('priv-photo')).toBe(false);
      expect(survivingRegion?.verifiedResources.has('pub-tile')).toBe(true);
    });
  });

  describe('K4.14, K4.15 & K4.16 · Régions prédéfinies, zones personnalisées multiples, couverture GeoJSON et déduplication', () => {
    it('estime les régions prédéfinies avec ressources annexes et restaure le contexte du drawer parent (K4.14)', () => {
      const frRegions = listPredefinedRegions('FR');
      expect(frRegions.length).toBeGreaterThanOrEqual(3);
      const calanques = getPredefinedRegionById('fr-calanques-marseille');
      expect(calanques).not.toBeNull();

      const estimate = estimateOfflinePackSize({
        regionOrZoneId: calanques!.regionId,
        bounds: calanques!.bounds,
        minZoom: 10,
        maxZoom: 12,
        poiCount: calanques!.poiCount,
        routeCount: calanques!.routeCount,
        mediaPreviewCount: 10,
      });

      expect(estimate.totalTileCount).toBeGreaterThan(0);
      expect(estimate.styleAndGlyphsBytes).toBe(STYLE_AND_SPRITES_BASE_BYTES + GLYPH_RANGES_BASE_BYTES);
      expect(estimate.poisAndRoutesBytes).toBeGreaterThan(0);
      expect(estimate.mediaPreviewsBytes).toBe(10 * 48 * 1024);
      expect(estimate.totalEstimatedBytes).toBe(
        estimate.vectorTilesBytes +
          estimate.demTilesBytes +
          estimate.styleAndGlyphsBytes +
          estimate.poisAndRoutesBytes +
          estimate.mediaPreviewsBytes,
      );

      // Ouverture et retour au contexte du drawer parent
      const subState = openOfflineSubDrawer('predefined_regions', {
        parentSheet: 'offline',
        parentDetent: 'mid',
        parentTab: 2,
        selectedRegionId: 'fr-calanques-marseille',
      });
      expect(subState.activeSubView).toBe('predefined_regions');
      const restored = closeOfflineSubDrawerAndRestoreParent(subState);
      expect(restored).toEqual({
        parentSheet: 'offline',
        parentDetent: 'mid',
        parentTab: 2,
        selectedRegionId: 'fr-calanques-marseille',
      });
    });

    it('valide les emprises libres, gère les zones multiples et déduplique les tuiles chevauchantes (K4.15 & K4.16)', async () => {
      const inverted = validateAndEstimateCustomZone({
        zoneId: 'z-inv',
        label: 'Inversée',
        bounds: { west: 6.0, south: 45.0, east: 5.0, north: 46.0 },
      });
      expect(inverted.valid).toBe(false);
      expect(inverted.validationError).toBe('inverted_bounds');

      const tooManyTiles = validateAndEstimateCustomZone({
        zoneId: 'z-huge',
        label: 'Trop grande',
        bounds: { west: 5.0, south: 45.0, east: 5.4, north: 45.4 },
        minZoom: 10,
        maxZoom: 15,
        maxTilesLimit: 20,
      });
      expect(tooManyTiles.valid).toBe(false);
      expect(tooManyTiles.validationError).toBe('exceeds_max_tiles_limit');

      const z1 = validateAndEstimateCustomZone({
        zoneId: 'z-1',
        label: 'Zone Est',
        bounds: { west: 5.35, south: 43.18, east: 5.4, north: 43.22 },
        minZoom: 10,
        maxZoom: 12,
      });
      const z2Overlapping = validateAndEstimateCustomZone({
        zoneId: 'z-2',
        label: 'Zone Chevauchante',
        bounds: { west: 5.38, south: 43.18, east: 5.43, north: 43.22 },
        minZoom: 10,
        maxZoom: 12,
      });

      expect(z1.valid).toBe(true);
      expect(z2Overlapping.valid).toBe(true);

      const multi = evaluateMultiZoneSelection([z1, z2Overlapping]);
      expect(multi.visibleLimitsGeoJson.features).toHaveLength(2);
      // Le total dédupliqué est strictement inférieur à la somme brute des deux zones qui se chevauchent
      expect(multi.combinedNetTileCount).toBeLessThan(z1.estimatedTiles + z2Overlapping.estimatedTiles);

      // Vérifie que la couverture téléchargée et le plafond de zoom fonctionnent (K4.16)
      const manager = new OfflinePackManager();
      const tiles = enumerateTilesForBounds(z1.bounds, 10, 11);
      const resources = tiles.map((t) =>
        makeResource(
          `tile-${t.z}-${t.x}-${t.y}`,
          'vector_tile',
          `https://tiles.openfreemap.org/planet/${t.z}/${t.x}/${t.y}.pbf`,
          `TILE_${t.z}_${t.x}_${t.y}`,
          { tile: t },
        ),
      );
      const styleRes = makeResource('style', 'style_json', 'https://tiles.openfreemap.org/styles/positron', '{"v":8}');
      const manifest = buildTestManifest({
        packId: 'pack-z1',
        bounds: z1.bounds,
        minZoom: 10,
        maxZoom: 11,
        resources: [styleRes.descriptor, ...resources.map((r) => r.descriptor)],
      });

      const payloadMap = new Map(resources.map((r) => [r.descriptor.id, r.payload]));
      payloadMap.set('style', styleRes.payload);

      await manager.downloadOrResumePack(manifest, async (r) => payloadMap.get(r.id)!);

      const coverageGeoJson = buildDownloadedCoverageGeoJson(manager.listInstalledPacks());
      expect(coverageGeoJson.features).toHaveLength(1);
      expect(coverageGeoJson.features[0].properties.packId).toBe('pack-z1');

      // Évaluation du zoom au-delà du paquet -> limite visible explicite (sans carte blanche silencieuse)
      const zoomEval = evaluateViewportOfflineCoverage(z1.bounds, 14, manager.listInstalledPacks());
      expect(zoomEval.status).toBe('zoom_exceeds_pack_limit');
      expect(zoomEval.visibleLimitNotice).toContain('au-delà de la limite téléchargée');

      // Estimation d'une nouvelle zone identique : 0 tuile nette à télécharger grâce au cache !
      const reEstimate = estimateOfflinePackSize({
        regionOrZoneId: 'z-1-bis',
        bounds: z1.bounds,
        minZoom: 10,
        maxZoom: 11,
        installedPacks: manager.listInstalledPacks(),
      });
      expect(reEstimate.alreadyCachedTileCount).toBe(reEstimate.totalTileCount);
      expect(reEstimate.netTilesToDownload).toBe(0);
      expect(reEstimate.vectorTilesBytes).toBe(reEstimate.totalTileCount * AVG_VECTOR_TILE_BYTES);
      expect(reEstimate.demTilesBytes).toBe(reEstimate.totalTileCount * AVG_DEM_TILE_BYTES);
    });
  });

  describe('K4.17 & Pont N01/N02 · Photos/POI à venir, lecture de tuiles et recalcul hors ligne', () => {
    it('filtre les POI/photos selon la licence et la confidentialité, et résout les POI à venir avec aperçus vérifiés (K4.17)', async () => {
      const manager = new OfflinePackManager();
      const photo1Payload = toUtf8Bytes('WEBP_REFUGE_PHOTO_VERIFIED');
      const photo1Sha = computeSha256Hex(photo1Payload);

      const rawPois: OfflinePoiRecord[] = [
        {
          id: 'poi-refuge',
          name: 'Refuge d’En Vau',
          kind: 'refuge',
          lng: 5.495,
          lat: 43.202,
          eleM: 120,
          authorized: true,
          privacyScope: 'public',
          mediaAssets: [
            {
              mediaId: 'media-refuge-1',
              poiId: 'poi-refuge',
              canonicalUri: 'https://cdn.lkdv.local/media/refuge1.webp?token=temp999',
              mimeType: 'image/webp',
              width: 320,
              height: 240,
              bytes: photo1Payload.byteLength,
              sha256: photo1Sha,
              license: 'CC-BY-SA-4.0',
              caption: 'Vue sur la calanque',
              privacyScope: 'public',
            },
          ],
        },
        {
          id: 'poi-private-home',
          name: 'Maison privée',
          kind: 'bivouac',
          lng: 5.492,
          lat: 43.201,
          authorized: true,
          privacyScope: 'private_user',
          mediaAssets: [],
        },
      ];

      const filteredForPublic = filterAndNormalizeOfflinePois(rawPois, { sharedPublicly: true });
      expect(filteredForPublic).toHaveLength(1);
      expect(filteredForPublic[0].id).toBe('poi-refuge');
      expect(filteredForPublic[0].mediaAssets[0].canonicalUri).toBe(
        'https://cdn.lkdv.local/media/refuge1.webp',
      );

      const routeData: OfflineRouteNavigationData = {
        routeId: 'route-calanques-1',
        routeRevision: 'rev-2026',
        name: 'Traversée d’En Vau',
        sport: 'rando',
        geojson: {
          type: 'LineString',
          coordinates: [
            [5.485, 43.202],
            [5.495, 43.202],
            [5.505, 43.202],
          ],
        },
        elevationProfile: [
          { d: 0, ele: 50 },
          { d: 800, ele: 120 },
          { d: 1600, ele: 10 },
        ],
        maneuvers: [
          {
            id: 'm-1',
            index: 0,
            kind: 'depart',
            position: [5.485, 43.202],
            alongTrackM: 0,
            instruction: 'Départ sur le sentier côtier',
          },
        ],
        pois: filteredForPublic,
        closures: [
          {
            id: 'closure-fire-risk',
            title: 'Massif fermé (risque incendie)',
            position: [5.495, 43.202],
            recordedAtMs: Date.parse('2026-08-01T08:00:00Z'),
            expiresAtMs: Date.parse('2026-08-02T20:00:00Z'),
          },
        ],
      };

      const styleRes = makeResource('style', 'style_json', 'https://tiles.openfreemap.org/styles/positron', '{"v":8}');
      const routeRes = makeResource(
        'route-bundle',
        'route_geometry',
        'https://offline.lkdv.local/routes/route-calanques-1.json',
        JSON.stringify(routeData),
      );
      const mediaRes = makeResource(
        'media-refuge-1',
        'media_preview',
        'https://cdn.lkdv.local/media/refuge1.webp',
        photo1Payload,
        { license: 'CC-BY-SA-4.0' },
      );

      const manifest = buildTestManifest({
        packId: 'pack-route-calanques',
        kind: 'route_corridor',
        routeId: 'route-calanques-1',
        bounds: { west: 5.48, south: 43.19, east: 5.51, north: 43.21 },
        resources: [styleRes.descriptor, routeRes.descriptor, mediaRes.descriptor],
      });

      await manager.downloadOrResumePack(manifest, async (r) => {
        if (r.id === 'style') return styleRes.payload;
        if (r.id === 'route-bundle') return routeRes.payload;
        return mediaRes.payload;
      });

      const installedPack = manager.getInstalledPack('pack-route-calanques')!;
      const upcoming = resolveUpcomingOfflinePoisWithMedia({
        pack: installedPack,
        routeData,
        currentAlongTrackM: 100,
        sport: 'rando',
      });

      expect(upcoming).toHaveLength(1);
      expect(upcoming[0].poi.name).toBe('Refuge d’En Vau');
      expect(upcoming[0].distanceRemainingM).toBeGreaterThan(500);
      expect(upcoming[0].verifiedMediaPreviews).toHaveLength(1);
      expect(upcoming[0].verifiedMediaPreviews[0].caption).toBe('Vue sur la calanque');

      // Fermeture expirée hors ligne : conserver date et incertitude sans affirmer la réouverture
      const closureEval = evaluateOfflineClosures(
        routeData.closures!,
        Date.parse('2026-08-05T12:00:00Z'),
      );
      expect(closureEval[0].freshness).toBe('uncertain_expired');
      expect(closureEval[0].warningLabel).toContain('réouverture non confirmée');
    });

    it('expose un pont de lecture fail-closed pour les tuiles et le graphe de recalcul hors ligne', async () => {
      const manager = new OfflinePackManager();
      const bridge = new OfflineNavigationBridge(manager);

      // Aucune tuile inventée si aucun paquet n'est installé
      const missingTileRead = bridge.readOfflineTile({ z: 12, x: 2109, y: 1496 }, 'vector');
      expect(missingTileRead.status).toBe('unavailable');
      expect(missingTileRead.reason).toBe('no_covering_pack');
      expect(missingTileRead.payload).toBeNull();

      // Installation d'un paquet avec une tuile vectorielle et une tuile de graphe
      const bounds: ZoneBounds = { west: 5.35, south: 43.18, east: 5.55, north: 43.26 };
      const sampleTile = enumerateTilesForBounds(bounds, 11, 11)[0];
      const styleRes = makeResource('style', 'style_json', 'https://tiles.openfreemap.org/styles/positron', '{"v":8}');
      const vecTileRes = makeResource(
        'vec-tile',
        'vector_tile',
        `https://tiles.openfreemap.org/planet/${sampleTile.z}/${sampleTile.x}/${sampleTile.y}.pbf`,
        'VERIFIED_MVT_BYTES',
        { tile: sampleTile },
      );
      const graphTileRes = makeResource(
        'graph-tile',
        'routing_graph_tile',
        `https://offline.lkdv.local/graph/${sampleTile.z}/${sampleTile.x}/${sampleTile.y}.gph`,
        'VALHALLA_TILE_BINARY',
        { tile: sampleTile },
      );

      const manifest = buildTestManifest({
        packId: 'pack-with-graph',
        bounds,
        minZoom: 10,
        maxZoom: 12,
        resources: [styleRes.descriptor, vecTileRes.descriptor, graphTileRes.descriptor],
      });

      await manager.downloadOrResumePack(manifest, async (r) => {
        if (r.id === 'style') return styleRes.payload;
        if (r.id === 'vec-tile') return vecTileRes.payload;
        return graphTileRes.payload;
      });

      // Lecture réussie de la tuile installée
      const okTileRead = bridge.readOfflineTile(sampleTile, 'vector');
      expect(okTileRead.status).toBe('available');
      expect(okTileRead.packId).toBe('pack-with-graph');
      expect(new TextDecoder().decode(okTileRead.payload as Uint8Array)).toBe('VERIFIED_MVT_BYTES');

      // Lecture à un zoom hors plage (z=16) -> zoom_out_of_range
      const outOfZoomTile = enumerateTilesForBounds(bounds, 16, 16)[0];
      const zoomOutRead = bridge.readOfflineTile(outOfZoomTile, 'vector');
      expect(zoomOutRead.status).toBe('unavailable');
      expect(zoomOutRead.reason).toBe('zoom_out_of_range');

      // Sans moteur de routage local branché, l'adaptateur de recalcul échoue proprement (mode retour vers la trace)
      const rerouteAdapter = bridge.createOfflineRerouteAdapter();
      const noEngineResult = await rerouteAdapter(
        { lat: 43.2, lng: 5.4 },
        { lat: 43.21, lng: 5.42 },
        'rando',
      );
      expect(noEngineResult).toEqual({ leg: null, reason: 'provider_unavailable' });

      // Avec un moteur de graphe local branché et compatible, calcule le détour hors réseau
      bridge.setLocalRoutingEngine({
        supportsSport: (s) => s === 'rando' || s === 'trail',
        computeDetour: async ({ from, to, graphTiles }) => {
          expect(graphTiles).toHaveLength(1);
          return {
            distanceM: 420,
            durationS: 310,
            geometry: [
              [from.lng, from.lat],
              [to.lng, to.lat],
            ],
          };
        },
      });

      const localRerouteResult = await rerouteAdapter(
        { lat: 43.2, lng: 5.4 },
        { lat: 43.21, lng: 5.42 },
        'rando',
      );
      expect(localRerouteResult.reason).toBeNull();
      expect(localRerouteResult.leg?.provider).toBe('offline-local-graph');
      expect(localRerouteResult.leg?.distanceM).toBe(420);
    });
  });

  describe('K4.19 · Raccourcis Android (App Shortcuts) et recherche Spotlight iOS hors ligne', () => {
    it('indexe uniquement les paquets vérifiés et résout les raccourcis sans entrée de navigation ni écriture serveur', async () => {
      const manager = new OfflinePackManager();
      const styleRes = makeResource('style', 'style_json', 'https://tiles.openfreemap.org/styles/positron', '{"v":8}');
      const tileRes = makeResource(
        'tile-1',
        'vector_tile',
        'https://tiles.openfreemap.org/planet/10/527/374.pbf',
        'TILE_DATA',
        { tile: { z: 10, x: 527, y: 374 } },
      );

      const routeManifest = buildTestManifest({
        packId: 'pack-tour-mont-blanc',
        title: 'Tour du Mont-Blanc Étape 1',
        kind: 'route_corridor',
        routeId: 'tmb-etape-1',
        regionId: 'fr-chamonix-mont-blanc',
        resources: [styleRes.descriptor, tileRes.descriptor],
      });

      await manager.downloadOrResumePack(routeManifest, async (r) =>
        r.id === 'style' ? styleRes.payload : tileRes.payload,
      );

      const androidShortcuts = buildAndroidOfflineShortcuts(manager.listInstalledPacks());
      expect(androidShortcuts.map((s) => s.actionKind)).toEqual([
        'plan_route',
        'record_activity',
        'open_offline_downloads',
        'open_downloaded_route',
      ]);

      const spotlightItems = buildIosSpotlightSearchableItems(manager.listInstalledPacks());
      expect(spotlightItems).toHaveLength(4);
      const hits = queryIosSpotlightOfflineIndex('mont-blanc', manager.listInstalledPacks());
      expect(hits).toHaveLength(1);
      expect(hits[0].routeId).toBe('tmb-etape-1');

      // Résolution d'un raccourci vers le parcours téléchargé en mode avion
      const resolvedRoute = resolveNativeShortcutLaunch(
        'lkdv://shortcut/route/tmb-etape-1',
        manager,
        { platform: 'ios' },
      );
      expect(resolvedRoute.status).toBe('resolved');
      expect(resolvedRoute.actionKind).toBe('open_downloaded_route');
      expect(resolvedRoute.targetRouteId).toBe('tmb-etape-1');
      expect(resolvedRoute.addsMainNavigationEntry).toBe(false);
      expect(resolvedRoute.performsServerWrite).toBe(false);

      // Suppression du paquet -> le raccourci échoue proprement (pack_not_available_offline)
      manager.removePack('pack-tour-mont-blanc');
      const afterRemove = resolveNativeShortcutLaunch(
        'lkdv://shortcut/route/tmb-etape-1',
        manager,
        { platform: 'ios' },
      );
      expect(afterRemove.status).toBe('unavailable');
      expect(afterRemove.reason).toBe('pack_not_available_offline');
      expect(afterRemove.performsServerWrite).toBe(false);
    });
  });
});
