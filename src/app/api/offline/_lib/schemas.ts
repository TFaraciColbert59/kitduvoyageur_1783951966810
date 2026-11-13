import { z } from 'zod';

/**
 * Lot N02-UI — Schémas d’entrée des routes API hors ligne.
 *
 * Les bornes restent volontairement non ordonnées : c’est le contrat
 * `validateAndEstimateCustomZone` qui produit `inverted_bounds`, afin de rendre
 * un diagnostic métier plutôt qu’une erreur de schéma opaque.
 */

export const zoneBoundsSchema = z.object({
  west: z.number().finite().min(-180).max(180),
  south: z.number().finite().min(-90).max(90),
  east: z.number().finite().min(-180).max(180),
  north: z.number().finite().min(-90).max(90),
});

export const orderedZoneBoundsSchema = zoneBoundsSchema.refine(
  (bounds) => bounds.west < bounds.east && bounds.south < bounds.north,
  'L’ouest doit être inférieur à l’est et le sud au nord.'
);

export const tileCoordinateSchema = z.object({
  z: z.number().int().min(0).max(22),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

export const packKindSchema = z.enum(['predefined_region', 'custom_zone', 'route_corridor']);

export const packStatusSchema = z.enum([
  'estimated',
  'queued',
  'downloading',
  'paused',
  'verifying',
  'available',
  'degraded',
  'corrupted',
  'expired',
  'unavailable',
]);

/** Plafond opérationnel des paquets hors ligne (les fournisseurs licenciés plafonnent à 15/16). */
export const MAX_OFFLINE_ZOOM = 16;

export const providerIdSchema = z.enum([
  'openfreemap-vector',
  'terrarium-dem',
  'maptiler-licensed',
  'protomaps-pmtiles',
  'osm-public-raster',
]);

export const packSummarySchema = z.object({
  packId: z.string().min(1).max(160),
  title: z.string().min(1).max(200),
  kind: packKindSchema,
  status: packStatusSchema,
  bounds: orderedZoneBoundsSchema,
  minZoom: z.number().int().min(0).max(22),
  maxZoom: z.number().int().min(0).max(22),
  storedBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  verifiedAtMs: z.number().int().min(0).nullable().optional(),
  expiresAtMs: z.number().int().min(0).nullable().optional(),
  lastAccessedAtMs: z.number().int().min(0).optional(),
  installedAtMs: z.number().int().min(0).optional(),
  version: z.number().int().min(1).max(100_000).optional(),
  pinned: z.boolean().optional(),
  regionId: z.string().max(160).nullable().optional(),
  routeId: z.string().max(160).nullable().optional(),
  providerId: providerIdSchema.optional(),
  licenseAttribution: z.string().max(300).optional(),
  manifestSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, 'SHA-256 hexadécimal attendu')
    .optional(),
});

export type PackSummaryInput = z.infer<typeof packSummarySchema>;

export const customZoneInputSchema = z.object({
  zoneId: z.string().min(1).max(160).optional(),
  label: z.string().min(1).max(120).optional(),
  bounds: zoneBoundsSchema,
  minZoom: z.number().int().min(0).max(MAX_OFFLINE_ZOOM).optional(),
  maxZoom: z.number().int().min(0).max(MAX_OFFLINE_ZOOM).optional(),
  maxTilesLimit: z.number().int().min(1).max(100_000).optional(),
  maxAreaKm2: z.number().positive().max(1_000_000).optional(),
  minAreaKm2: z.number().positive().max(100_000).optional(),
});

export type CustomZoneInput = z.infer<typeof customZoneInputSchema>;

export const estimateInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('predefined_region'),
    regionId: z.string().min(1).max(160),
    minZoom: z.number().int().min(0).max(MAX_OFFLINE_ZOOM).optional(),
    maxZoom: z.number().int().min(0).max(MAX_OFFLINE_ZOOM).optional(),
    mediaPreviewCount: z.number().int().min(0).max(10_000).optional(),
    includeRoutingGraph: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('custom_zone'),
    zone: customZoneInputSchema,
  }),
  z.object({
    kind: z.literal('multi_zone'),
    zones: z.array(customZoneInputSchema).max(16),
    maxZonesAllowed: z.number().int().min(1).max(16).optional(),
    maxTilesPerZone: z.number().int().min(1).max(100_000).optional(),
  }),
]);

export const coverageInputSchema = z.object({
  packs: z.array(packSummarySchema).max(50),
  viewportBounds: orderedZoneBoundsSchema,
  requestedZoom: z.number().int().min(0).max(22),
  nowMs: z.number().int().min(0).optional(),
});

export const shortcutsInputSchema = z.object({
  packs: z.array(packSummarySchema).max(50),
  platform: z.enum(['all', 'android', 'ios']).optional(),
  query: z.string().max(120).optional(),
  deepLinkUri: z.string().max(500).optional(),
  maxDynamicShortcuts: z.number().int().min(0).max(10).optional(),
});

const resourceKindSchema = z.enum([
  'vector_tile',
  'dem_tile',
  'style_json',
  'glyph_range',
  'sprite_sheet',
  'route_geometry',
  'navigation_maneuvers',
  'elevation_profile',
  'routing_graph_tile',
  'poi_dataset',
  'media_preview',
  'address_index',
]);

const privacyScopeSchema = z.enum(['public', 'private_user']);

export const offlineResourceSchema = z.object({
  id: z.string().min(1).max(240),
  kind: resourceKindSchema,
  canonicalUri: z.string().min(1).max(2_000),
  tile: tileCoordinateSchema.optional(),
  expectedSha256: z.string().regex(/^[a-f0-9]{64}$/i, 'SHA-256 hexadécimal attendu'),
  expectedBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  required: z.boolean(),
  license: z.string().min(1).max(300),
  privacyScope: privacyScopeSchema,
});

export const offlineManifestSchema = z.object({
  packId: z.string().min(1).max(160),
  version: z.number().int().min(1).max(100_000),
  ownerUserId: z.string().max(160).nullable(),
  kind: packKindSchema,
  title: z.string().min(1).max(200),
  regionId: z.string().max(160).nullable(),
  routeId: z.string().max(160).nullable(),
  routeRevision: z.string().max(160).nullable(),
  bounds: orderedZoneBoundsSchema,
  minZoom: z.number().int().min(0).max(22),
  maxZoom: z.number().int().min(0).max(22),
  pixelRatio: z.number().positive().max(8),
  providerId: providerIdSchema,
  licenseAttribution: z.string().min(1).max(300),
  styleVersion: z.string().min(1).max(120),
  engineVersion: z.string().min(1).max(120),
  pinned: z.boolean(),
  sharedPublicly: z.boolean(),
  resources: z.array(offlineResourceSchema).max(5_000),
  totalExpectedBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/i, 'SHA-256 hexadécimal attendu'),
  createdAtMs: z.number().int().min(0),
  updatedAtMs: z.number().int().min(0),
  expiresAtMs: z.number().int().min(0).nullable(),
  verifiedAtMs: z.number().int().min(0).nullable(),
});

export const verifiedResourceChunkSchema = z.object({
  resourceId: z.string().min(1).max(240),
  canonicalUri: z.string().min(1).max(2_000),
  actualSha256: z.string().regex(/^[a-f0-9]{64}$/i, 'SHA-256 hexadécimal attendu'),
  actualBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  verifiedAtMs: z.number().int().min(0),
  payload: z.string().max(512_000),
});

export const manifestValidationInputSchema = z.object({
  manifest: offlineManifestSchema,
  verifiedResources: z.array(verifiedResourceChunkSchema).max(200).optional(),
});

const sportSchema = z.enum([
  'course',
  'rando',
  'velo',
  'kayak',
  'trail',
  'ski',
  'escalade',
  'famille',
  'bivouac',
]);

const poiKindSchema = z.enum([
  'summit',
  'water',
  'refuge',
  'bivouac',
  'viewpoint',
  'danger',
  'access',
  'friend',
  'trail',
  'highlight',
  'waypoint',
]);

export const offlineMediaAssetSchema = z.object({
  mediaId: z.string().min(1).max(160),
  poiId: z.string().min(1).max(160),
  canonicalUri: z.string().min(1).max(2_000),
  mimeType: z.enum(['image/jpeg', 'image/webp', 'image/png']),
  width: z.number().int().min(0).max(100_000),
  height: z.number().int().min(0).max(100_000),
  bytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'SHA-256 hexadécimal attendu'),
  license: z.string().min(1).max(300),
  caption: z.string().max(500).nullable().optional(),
  privacyScope: privacyScopeSchema,
});

export const offlinePoiRecordSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  kind: poiKindSchema,
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  eleM: z.number().finite().nullable().optional(),
  description: z.string().max(2_000).nullable().optional(),
  sports: z.array(sportSchema).max(20).optional(),
  authorized: z.boolean(),
  privacyScope: privacyScopeSchema,
  mediaAssets: z.array(offlineMediaAssetSchema).max(20),
});

export const poisInputSchema = z.object({
  pois: z.array(offlinePoiRecordSchema).max(200),
  sharedPublicly: z.boolean(),
});
