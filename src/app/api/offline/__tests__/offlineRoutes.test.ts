import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  computeManifestSha256,
  computeSha256Hex,
  toUtf8Bytes,
  type OfflinePackManifest,
  type OfflineResourceDescriptor,
} from '@/features/offline';
import { GET as getRegions } from '../regions/route';
import { POST as postEstimate } from '../estimate/route';
import { POST as postManifestValidation } from '../manifest/validate/route';
import { POST as postCoverage } from '../coverage/route';
import { POST as postShortcuts } from '../shortcuts/route';
import { POST as postPois } from '../pois/route';

function request(path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/offline/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function resource(
  id: string,
  kind: OfflineResourceDescriptor['kind'],
  content: string,
  options: {
    tile?: { z: number; x: number; y: number };
    required?: boolean;
    providerScoped?: boolean;
  } = {}
): OfflineResourceDescriptor {
  const payload = toUtf8Bytes(content);
  return {
    id,
    kind,
    canonicalUri: `https://tiles.openfreemap.org/${kind}/${id}`,
    tile: options.tile,
    expectedSha256: computeSha256Hex(payload),
    expectedBytes: payload.byteLength,
    required: options.required ?? true,
    license: '© OpenFreeMap © OpenStreetMap contributors',
    privacyScope: 'public',
  };
}

function manifest(
  overrides: Partial<OfflinePackManifest> & { packId: string } = { packId: 'pack-test' }
): OfflinePackManifest {
  const resources = overrides.resources ?? [
    resource('style', 'style_json', '{"version":8}'),
    resource('tile-10-527-374', 'vector_tile', 'MVT_PAYLOAD', {
      tile: { z: 10, x: 527, y: 374 },
    }),
  ];
  const totalExpectedBytes = resources.reduce((total, item) => total + item.expectedBytes, 0);
  const base: Omit<OfflinePackManifest, 'manifestSha256'> = {
    packId: overrides.packId,
    version: overrides.version ?? 1,
    ownerUserId: null,
    kind: overrides.kind ?? 'predefined_region',
    title: overrides.title ?? 'Paquet de test',
    regionId: overrides.regionId ?? 'fr-calanques-marseille',
    routeId: overrides.routeId ?? null,
    routeRevision: null,
    bounds: overrides.bounds ?? { west: 5.35, south: 43.18, east: 5.42, north: 43.22 },
    minZoom: overrides.minZoom ?? 10,
    maxZoom: overrides.maxZoom ?? 12,
    pixelRatio: 2,
    providerId: overrides.providerId ?? 'openfreemap-vector',
    licenseAttribution:
      overrides.licenseAttribution ?? '© OpenFreeMap © OpenStreetMap contributors',
    styleVersion: 'positron-2026.11',
    engineVersion: 'maplibre-5.0',
    pinned: true,
    sharedPublicly: overrides.sharedPublicly ?? false,
    resources,
    totalExpectedBytes,
    createdAtMs: 1_700_000_000_000,
    updatedAtMs: 1_700_000_000_000,
    expiresAtMs: null,
    verifiedAtMs: null,
  };
  return {
    ...base,
    manifestSha256: overrides.manifestSha256 ?? computeManifestSha256(base),
  };
}

const PACK_SUMMARY = {
  packId: 'pack-calanques',
  title: 'Calanques hors ligne',
  kind: 'predefined_region' as const,
  status: 'available' as const,
  bounds: { west: 5.35, south: 43.18, east: 5.42, north: 43.22 },
  minZoom: 10,
  maxZoom: 12,
  storedBytes: 4096,
  verifiedAtMs: 1_700_000_100_000,
  expiresAtMs: null,
  lastAccessedAtMs: 1_700_000_200_000,
  regionId: 'fr-calanques-marseille',
};

describe('API /api/offline/regions', () => {
  it('rend le catalogue réel avec estimations et politique de licence', async () => {
    const response = await getRegions(request('regions?country=FR&includeEstimates=1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBeGreaterThanOrEqual(3);
    const calanques = body.regions.find(
      (region: { regionId: string }) => region.regionId === 'fr-calanques-marseille'
    );
    expect(calanques).toBeTruthy();
    expect(calanques.estimate.totalTileCount).toBeGreaterThan(0);
    expect(calanques.providerPolicy.allowedForOfflinePack).toBe(true);
    expect(body.offlineDownloadAllowedProviders).not.toContain('osm-public-raster');
  });

  it('refuse un code pays invalide', async () => {
    const response = await getRegions(request('regions?country=France'));
    expect(response.status).toBe(400);
  });
});

describe('API /api/offline/estimate', () => {
  it('estime une région prédéfinie', async () => {
    const response = await postEstimate(
      request('estimate', { kind: 'predefined_region', regionId: 'fr-calanques-marseille' })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.region.regionId).toBe('fr-calanques-marseille');
    expect(body.estimate.totalEstimatedBytes).toBeGreaterThan(0);
  });

  it('rend une erreur métier inverted_bounds pour une emprise libre', async () => {
    const response = await postEstimate(
      request('estimate', {
        kind: 'custom_zone',
        zone: {
          bounds: { west: 7, south: 45, east: 6, north: 46 },
          minZoom: 10,
          maxZoom: 12,
        },
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.draft.valid).toBe(false);
    expect(body.draft.validationError).toBe('inverted_bounds');
    expect(body.estimate).toBeNull();
  });

  it('déduplique plusieurs zones et renvoie leurs limites GeoJSON', async () => {
    const response = await postEstimate(
      request('estimate', {
        kind: 'multi_zone',
        zones: [
          {
            zoneId: 'z-1',
            label: 'Zone 1',
            bounds: { west: 5.35, south: 43.18, east: 5.4, north: 43.22 },
            minZoom: 10,
            maxZoom: 12,
          },
          {
            zoneId: 'z-2',
            label: 'Zone 2',
            bounds: { west: 5.38, south: 43.18, east: 5.43, north: 43.22 },
            minZoom: 10,
            maxZoom: 12,
          },
        ],
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.drafts).toHaveLength(2);
    expect(body.multi.visibleLimitsGeoJson.features).toHaveLength(2);
    expect(body.multi.combinedNetTileCount).toBeGreaterThan(0);
  });

  it('plafonne le zoom pour empêcher une énumération de tuiles démesurée', async () => {
    const response = await postEstimate(
      request('estimate', {
        kind: 'custom_zone',
        zone: {
          bounds: { west: 5.35, south: 43.18, east: 5.4, north: 43.22 },
          minZoom: 10,
          maxZoom: 22,
        },
      })
    );
    expect(response.status).toBe(400);
  });

  it('renvoie 404 pour une région inconnue et 400 pour des zooms inversés', async () => {
    const missing = await postEstimate(
      request('estimate', { kind: 'predefined_region', regionId: 'inconnue' })
    );
    expect(missing.status).toBe(404);

    const badZoom = await postEstimate(
      request('estimate', {
        kind: 'predefined_region',
        regionId: 'fr-calanques-marseille',
        minZoom: 14,
        maxZoom: 10,
      })
    );
    expect(badZoom.status).toBe(400);
  });
});

describe('API /api/offline/manifest/validate', () => {
  it('valide un manifeste licencié et évalue ses capacités avec les charges', async () => {
    const pack = manifest();
    const stylePayload = '{"version":8}';
    const tilePayload = 'MVT_PAYLOAD';
    const response = await postManifestValidation(
      request('manifest/validate', {
        manifest: pack,
        verifiedResources: [
          {
            resourceId: 'style',
            canonicalUri: 'https://tiles.openfreemap.org/style_json/style',
            actualSha256: computeSha256Hex(stylePayload),
            actualBytes: toUtf8Bytes(stylePayload).byteLength,
            verifiedAtMs: 1_700_000_100_000,
            payload: stylePayload,
          },
          {
            resourceId: 'tile-10-527-374',
            canonicalUri: 'https://tiles.openfreemap.org/vector_tile/tile-10-527-374',
            actualSha256: computeSha256Hex(tilePayload),
            actualBytes: toUtf8Bytes(tilePayload).byteLength,
            verifiedAtMs: 1_700_000_100_000,
            payload: tilePayload,
          },
        ],
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.valid).toBe(true);
    expect(body.validation.reason).toBeNull();
    expect(body.providerPolicy.allowedForOfflinePack).toBe(true);
    expect(body.evaluation.status).toBe('available');
    expect(body.evaluation.capabilities.viewMapAround.status).toBe('available');
  });

  it('refuse le fournisseur OSM public et une somme de contrôle altérée', async () => {
    const forbidden = await postManifestValidation(
      request('manifest/validate', {
        manifest: manifest({ packId: 'osm', providerId: 'osm-public-raster' }),
      })
    );
    expect(forbidden.status).toBe(200);
    const forbiddenBody = await forbidden.json();
    expect(forbiddenBody.valid).toBe(false);
    expect(forbiddenBody.validation.reason).toBe('unlicensed_or_forbidden_provider');

    const tampered = await postManifestValidation(
      request('manifest/validate', {
        manifest: manifest({ packId: 'tampered', manifestSha256: '0'.repeat(64) }),
      })
    );
    const tamperedBody = await tampered.json();
    expect(tamperedBody.valid).toBe(false);
    expect(tamperedBody.validation.reason).toBe('manifest_checksum_mismatch');
  });

  it('refuse un corps sans manifeste', async () => {
    const response = await postManifestValidation(request('manifest/validate', {}));
    expect(response.status).toBe(400);
  });
});

describe('API /api/offline/coverage', () => {
  it('rend le GeoJSON et signale le zoom au-delà du paquet', async () => {
    const response = await postCoverage(
      request('coverage', {
        packs: [PACK_SUMMARY],
        viewportBounds: { west: 5.36, south: 43.19, east: 5.4, north: 43.21 },
        requestedZoom: 14,
        nowMs: 1_700_000_300_000,
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.coverage.features).toHaveLength(1);
    expect(body.coverage.features[0].id).toBe('pack-calanques');
    expect(body.viewport.status).toBe('zoom_exceeds_pack_limit');
    expect(body.viewport.visibleLimitNotice).toContain('zoom max hors ligne : 12');
    expect(body.coveringPackIds).toEqual(['pack-calanques']);
  });

  it('refuse une emprise de vue inversée', async () => {
    const response = await postCoverage(
      request('coverage', {
        packs: [PACK_SUMMARY],
        viewportBounds: { west: 6, south: 43, east: 5, north: 44 },
        requestedZoom: 11,
      })
    );
    expect(response.status).toBe(400);
  });
});

describe('API /api/offline/shortcuts', () => {
  it('rend les raccourcis Android, l’index Spotlight et résout un deep link hors ligne', async () => {
    const routePack = {
      ...PACK_SUMMARY,
      packId: 'pack-tmb',
      title: 'Tour du Mont-Blanc Étape 1',
      kind: 'route_corridor' as const,
      routeId: 'tmb-etape-1',
      regionId: 'fr-chamonix-mont-blanc',
      bounds: { west: 6.75, south: 45.82, east: 7.05, north: 46.02 },
    };
    const response = await postShortcuts(
      request('shortcuts', {
        packs: [routePack],
        query: 'mont-blanc',
        deepLinkUri: 'lkdv://shortcut/route/tmb-etape-1',
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.androidShortcuts.map((item: { actionKind: string }) => item.actionKind)).toEqual([
      'plan_route',
      'record_activity',
      'open_offline_downloads',
      'open_downloaded_route',
    ]);
    expect(body.iosSpotlightItems).toHaveLength(4);
    expect(body.queryHits).toHaveLength(1);
    expect(body.queryHits[0].routeId).toBe('tmb-etape-1');
    expect(body.resolution.status).toBe('resolved');
    expect(body.resolution.targetPackId).toBe('pack-tmb');
    expect(body.addsMainNavigationEntry).toBe(false);
    expect(body.performsServerWrite).toBe(false);
  });

  it('échoue proprement quand le paquet a été supprimé', async () => {
    const response = await postShortcuts(
      request('shortcuts', {
        packs: [],
        deepLinkUri: 'lkdv://shortcut/route/tmb-etape-1',
      })
    );
    const body = await response.json();
    expect(body.resolution.status).toBe('unavailable');
    expect(body.resolution.reason).toBe('pack_not_available_offline');
  });
});

describe('API /api/offline/pois', () => {
  it('retire les POI privés d’un paquet public et normalise les URIs de médias', async () => {
    const response = await postPois(
      request('pois', {
        sharedPublicly: true,
        pois: [
          {
            id: 'poi-refuge',
            name: 'Refuge d’En Vau',
            kind: 'refuge',
            lat: 43.202,
            lng: 5.495,
            authorized: true,
            privacyScope: 'public',
            mediaAssets: [
              {
                mediaId: 'media-refuge',
                poiId: 'poi-refuge',
                canonicalUri: 'https://cdn.lkdv.local/media/refuge.webp?token=temp999',
                mimeType: 'image/webp',
                width: 320,
                height: 240,
                bytes: 1024,
                sha256: 'a'.repeat(64),
                license: 'CC-BY-SA-4.0',
                caption: 'Vue sur la calanque',
                privacyScope: 'public',
              },
            ],
          },
          {
            id: 'poi-private',
            name: 'Maison privée',
            kind: 'bivouac',
            lat: 43.2,
            lng: 5.49,
            authorized: true,
            privacyScope: 'private_user',
            mediaAssets: [],
          },
        ],
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.keptPoiCount).toBe(1);
    expect(body.droppedPoiCount).toBe(1);
    expect(body.droppedMediaCount).toBe(0);
    expect(body.pois[0].id).toBe('poi-refuge');
    expect(body.pois[0].mediaAssets[0].canonicalUri).toBe(
      'https://cdn.lkdv.local/media/refuge.webp'
    );
  });

  it('refuse un corps invalide', async () => {
    const response = await postPois(request('pois', { sharedPublicly: 'yes', pois: [] }));
    expect(response.status).toBe(400);
  });
});
