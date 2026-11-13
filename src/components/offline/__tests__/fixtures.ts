import {
  computeManifestSha256,
  computeSha256Hex,
  toUtf8Bytes,
  type OfflineCapabilityMatrix,
  type OfflineInstalledPackRecord,
  type OfflineMediaAsset,
  type OfflinePackManifest,
  type OfflinePoiRecord,
  type OfflineResourceDescriptor,
  type OfflineUpcomingPoiViewItem,
  type ZoneBounds,
} from '@/features/offline';

export const CALANQUES_BOUNDS: ZoneBounds = {
  west: 5.35,
  south: 43.18,
  east: 5.42,
  north: 43.22,
};

export function makeResource(
  id: string,
  kind: OfflineResourceDescriptor['kind'],
  content: string,
  options: {
    tile?: { z: number; x: number; y: number };
    required?: boolean;
    privacyScope?: 'public' | 'private_user';
    license?: string;
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
    license: options.license ?? '© OpenFreeMap © OpenStreetMap contributors',
    privacyScope: options.privacyScope ?? 'public',
  };
}

export function makeManifest(
  overrides: Partial<OfflinePackManifest> & {
    packId: string;
    title?: string;
    bounds?: ZoneBounds;
    resources?: OfflineResourceDescriptor[];
    kind?: OfflinePackManifest['kind'];
    routeId?: string | null;
    regionId?: string | null;
  }
): OfflinePackManifest {
  const resources = overrides.resources ?? [
    makeResource('style', 'style_json', '{"version":8}'),
    makeResource('tile-10-527-374', 'vector_tile', 'MVT_PAYLOAD', {
      tile: { z: 10, x: 527, y: 374 },
    }),
  ];
  const totalExpectedBytes = resources.reduce(
    (total, resource) => total + resource.expectedBytes,
    0
  );
  const base: Omit<OfflinePackManifest, 'manifestSha256'> = {
    packId: overrides.packId,
    version: overrides.version ?? 1,
    ownerUserId: overrides.ownerUserId ?? null,
    kind: overrides.kind ?? 'predefined_region',
    title: overrides.title ?? `Paquet ${overrides.packId}`,
    regionId: overrides.regionId === undefined ? 'fr-calanques-marseille' : overrides.regionId,
    routeId: overrides.routeId ?? null,
    routeRevision: overrides.routeId ? 'rev-1' : null,
    bounds: overrides.bounds ?? CALANQUES_BOUNDS,
    minZoom: overrides.minZoom ?? 10,
    maxZoom: overrides.maxZoom ?? 12,
    pixelRatio: overrides.pixelRatio ?? 2,
    providerId: overrides.providerId ?? 'openfreemap-vector',
    licenseAttribution:
      overrides.licenseAttribution ?? '© OpenFreeMap © OpenStreetMap contributors',
    styleVersion: overrides.styleVersion ?? 'positron-2026.11',
    engineVersion: overrides.engineVersion ?? 'maplibre-5.0',
    pinned: overrides.pinned ?? true,
    sharedPublicly: overrides.sharedPublicly ?? false,
    resources,
    totalExpectedBytes: overrides.totalExpectedBytes ?? totalExpectedBytes,
    createdAtMs: overrides.createdAtMs ?? 1_700_000_000_000,
    updatedAtMs: overrides.updatedAtMs ?? 1_700_000_000_000,
    expiresAtMs: overrides.expiresAtMs ?? null,
    verifiedAtMs: overrides.verifiedAtMs ?? 1_700_000_100_000,
  };

  return {
    ...base,
    manifestSha256: overrides.manifestSha256 ?? computeManifestSha256(base),
  };
}

export function makeCapabilities(
  overrides: Partial<OfflineCapabilityMatrix> = {}
): OfflineCapabilityMatrix {
  return {
    viewRoute: { status: 'available', reason: null },
    viewMapAround: { status: 'available', reason: null },
    followInstructions: { status: 'available', reason: null },
    searchAddresses: {
      status: 'unavailable',
      reason: 'Index de lieux local absent.',
    },
    recalculateRoute: {
      status: 'unavailable',
      reason: 'Aucun graphe de routage local.',
    },
    liveWeatherAndClosures: {
      status: 'unavailable',
      reason: 'Source temps réel indisponible hors réseau.',
    },
    ...overrides,
  };
}

export function makeInstalledPack(
  manifest: OfflinePackManifest,
  overrides: Partial<OfflineInstalledPackRecord> = {}
): OfflineInstalledPackRecord {
  return {
    manifest,
    status: 'available',
    capabilities: makeCapabilities(),
    verifiedResources: new Map(),
    actualStoredBytes: manifest.totalExpectedBytes,
    lastAccessedAtMs: 1_700_000_200_000,
    installedAtMs: 1_700_000_100_000,
    failureReason: null,
    preservedPreviousVersionOnFailure: false,
    ...overrides,
  };
}

export function makePoi(
  overrides: Partial<OfflinePoiRecord> & Pick<OfflinePoiRecord, 'id' | 'name'>
): OfflinePoiRecord {
  return {
    id: overrides.id,
    name: overrides.name,
    kind: overrides.kind ?? 'refuge',
    lat: overrides.lat ?? 43.2,
    lng: overrides.lng ?? 5.39,
    eleM: overrides.eleM ?? 120,
    description: overrides.description ?? null,
    sports: overrides.sports,
    authorized: overrides.authorized ?? true,
    privacyScope: overrides.privacyScope ?? 'public',
    mediaAssets: overrides.mediaAssets ?? [],
  };
}

export function makeMedia(
  overrides: Partial<OfflineMediaAsset> & Pick<OfflineMediaAsset, 'mediaId' | 'poiId'>
): OfflineMediaAsset {
  return {
    mediaId: overrides.mediaId,
    poiId: overrides.poiId,
    canonicalUri: overrides.canonicalUri ?? 'https://cdn.lkdv.local/media/refuge.webp',
    mimeType: overrides.mimeType ?? 'image/webp',
    width: overrides.width ?? 320,
    height: overrides.height ?? 240,
    bytes: overrides.bytes ?? 1024,
    sha256: overrides.sha256 ?? 'a'.repeat(64),
    license: overrides.license ?? 'CC-BY-SA-4.0',
    caption: overrides.caption ?? 'Vue sur la calanque',
    privacyScope: overrides.privacyScope ?? 'public',
  };
}

export function makeUpcomingPoi(
  poi: OfflinePoiRecord,
  distanceRemainingM: number,
  options: {
    lateralOffsetM?: number;
    media?: OfflineUpcomingPoiViewItem['verifiedMediaPreviews'];
  } = {}
): OfflineUpcomingPoiViewItem {
  return {
    poi,
    alongTrackM: 1200,
    distanceRemainingM,
    lateralOffsetM: options.lateralOffsetM ?? 40,
    verifiedMediaPreviews: options.media ?? [],
  };
}
