/**
 * Lot N02 — Intégrité des manifestes, sommes de contrôle SHA-256, normalisation
 * d'URI sans jetons temporaires, politiques de licence des tuiles et matrice
 * de capacités hors ligne (Recherche 04, K4.14..K4.17).
 */

import type {
  OfflineCapabilityMatrix,
  OfflineClosureEvaluation,
  OfflineClosureNotice,
  OfflinePackManifest,
  OfflinePackStatus,
  OfflineResourceDescriptor,
  OfflineTileProviderId,
  TileProviderLicensePolicy,
  VerifiedResourceChunk,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Politiques de licence des fournisseurs de tuiles (OSMF, MapLibre iOS/Android)
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER_POLICIES: Record<OfflineTileProviderId, TileProviderLicensePolicy> = {
  'openfreemap-vector': {
    providerId: 'openfreemap-vector',
    allowedForOfflinePack: true,
    attributionRequired: '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors',
    maxZoomSupported: 15,
    supportedTargets: ['web-cache-storage', 'ios-maplibre-pack', 'android-maplibre-region'],
    requiresExplicitDownloadStartOnAndroid: true,
    participatesInIosNativeOfflinePackApi: true,
  },
  'terrarium-dem': {
    providerId: 'terrarium-dem',
    allowedForOfflinePack: true,
    attributionRequired: 'Terrain tiles © Mapzen / AWS Open Data',
    maxZoomSupported: 15,
    supportedTargets: ['web-cache-storage', 'ios-maplibre-pack', 'android-maplibre-region'],
    requiresExplicitDownloadStartOnAndroid: true,
    participatesInIosNativeOfflinePackApi: true,
  },
  'maptiler-licensed': {
    providerId: 'maptiler-licensed',
    allowedForOfflinePack: true,
    attributionRequired: '© MapTiler © OpenStreetMap contributors',
    maxZoomSupported: 16,
    supportedTargets: ['web-cache-storage', 'ios-maplibre-pack', 'android-maplibre-region'],
    requiresExplicitDownloadStartOnAndroid: true,
    participatesInIosNativeOfflinePackApi: true,
  },
  'protomaps-pmtiles': {
    providerId: 'protomaps-pmtiles',
    allowedForOfflinePack: true,
    attributionRequired: '© Protomaps © OpenStreetMap contributors',
    maxZoomSupported: 15,
    // Recherche 04 [S1] : sur iOS, PMTiles est lisible comme archive locale mais
    // ne participe pas aux packs de l'API MLNOfflineStorage.
    supportedTargets: ['web-cache-storage', 'ios-local-pmtiles', 'android-maplibre-region'],
    requiresExplicitDownloadStartOnAndroid: true,
    participatesInIosNativeOfflinePackApi: false,
  },
  'osm-public-raster': {
    providerId: 'osm-public-raster',
    allowedForOfflinePack: false,
    attributionRequired: '© OpenStreetMap contributors',
    maxZoomSupported: 19,
    supportedTargets: [],
    requiresExplicitDownloadStartOnAndroid: false,
    participatesInIosNativeOfflinePackApi: false,
    rejectionReason:
      'Les tuiles raster publiques OSM (tile.openstreetmap.org) interdisent le préchargement massif et les packs hors ligne (politique OSMF).',
  },
};

export function getTileProviderPolicy(providerId: OfflineTileProviderId): TileProviderLicensePolicy {
  return PROVIDER_POLICIES[providerId];
}

export function isProviderAllowedForOfflinePack(providerId: OfflineTileProviderId): boolean {
  const policy = PROVIDER_POLICIES[providerId];
  return Boolean(policy && policy.allowedForOfflinePack);
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation d'URL (suppression des jetons éphémères — Recherche 04)
// ─────────────────────────────────────────────────────────────────────────────

const EPHEMERAL_QUERY_PARAMS = new Set([
  'token',
  'access_token',
  'auth',
  'sig',
  'signature',
  'expires',
  'exp',
  'jwt',
  'key',
  'api_key',
  'apikey',
  'x-amz-signature',
  'x-amz-credential',
  'x-amz-security-token',
  'x-amz-date',
  'x-amz-expires',
  'x-amz-signedheaders',
]);

/**
 * Nettoie une URI de tout jeton temporaire pour que l'identité d'une ressource
 * téléchargée reste stable à travers les renouvellements de session.
 */
export function normalizeResourceUri(rawUri: string): string {
  const trimmed = rawUri.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed, 'https://offline.lkdv.local');
    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_value, key) => {
      if (EPHEMERAL_QUERY_PARAMS.has(key.toLowerCase())) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }
    parsed.searchParams.sort();
    parsed.hash = '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('lkdv://')) {
      return parsed.toString();
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return trimmed.split('?')[0] ?? trimmed;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 déterministe (synchrone + asynchrone, sans dépendance externe)
// ─────────────────────────────────────────────────────────────────────────────

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function toUtf8Bytes(input: Uint8Array | string): Uint8Array {
  if (input instanceof Uint8Array) return input;
  return new TextEncoder().encode(input);
}

/**
 * Calcule l'empreinte SHA-256 hexadécimale (64 caractères minuscules) d'un
 * payload binaire ou texte de manière pure et déterministe.
 */
export function computeSha256Hex(input: Uint8Array | string): string {
  const bytes = toUtf8Bytes(input);
  const bitLenHi = Math.floor((bytes.length * 8) / 0x100000000);
  const bitLenLo = (bytes.length * 8) >>> 0;

  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, bitLenHi, false);
  view.setUint32(paddedLength - 4, bitLenLo, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Vérification des ressources et du manifeste (fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

export interface ResourceVerificationOutcome {
  ok: boolean;
  actualBytes: number;
  actualSha256: string;
  failureReason:
    | null
    | 'empty_payload'
    | 'byte_length_mismatch'
    | 'sha256_mismatch'
    | 'missing_license';
}

/**
 * Vérifie strictement la taille en octets, la présence d'une licence et la
 * somme de contrôle SHA-256 d'une ressource téléchargée.
 */
export function verifyResourcePayload(
  descriptor: OfflineResourceDescriptor,
  payload: Uint8Array | string,
): ResourceVerificationOutcome {
  if (!descriptor.license || descriptor.license.trim().length === 0) {
    return {
      ok: false,
      actualBytes: 0,
      actualSha256: '',
      failureReason: 'missing_license',
    };
  }

  const bytes = toUtf8Bytes(payload);
  const actualBytes = bytes.byteLength;
  const actualSha256 = computeSha256Hex(bytes);

  if (descriptor.expectedBytes > 0 && actualBytes === 0) {
    return {
      ok: false,
      actualBytes,
      actualSha256,
      failureReason: 'empty_payload',
    };
  }

  if (actualBytes !== descriptor.expectedBytes) {
    return {
      ok: false,
      actualBytes,
      actualSha256,
      failureReason: 'byte_length_mismatch',
    };
  }

  if (actualSha256.toLowerCase() !== descriptor.expectedSha256.toLowerCase()) {
    return {
      ok: false,
      actualBytes,
      actualSha256,
      failureReason: 'sha256_mismatch',
    };
  }

  return {
    ok: true,
    actualBytes,
    actualSha256,
    failureReason: null,
  };
}

/**
 * Calcule l'empreinte SHA-256 canonique d'un manifeste de paquet hors ligne.
 */
export function computeManifestSha256(
  manifest: Omit<OfflinePackManifest, 'manifestSha256'>,
): string {
  const canonicalPayload = JSON.stringify({
    packId: manifest.packId,
    version: manifest.version,
    ownerUserId: manifest.ownerUserId,
    kind: manifest.kind,
    bounds: {
      west: manifest.bounds.west,
      south: manifest.bounds.south,
      east: manifest.bounds.east,
      north: manifest.bounds.north,
    },
    minZoom: manifest.minZoom,
    maxZoom: manifest.maxZoom,
    pixelRatio: manifest.pixelRatio,
    providerId: manifest.providerId,
    styleVersion: manifest.styleVersion,
    engineVersion: manifest.engineVersion,
    routeId: manifest.routeId,
    routeRevision: manifest.routeRevision,
    sharedPublicly: manifest.sharedPublicly,
    totalExpectedBytes: manifest.totalExpectedBytes,
    resources: [...manifest.resources]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        canonicalUri: normalizeResourceUri(r.canonicalUri),
        expectedSha256: r.expectedSha256.toLowerCase(),
        expectedBytes: r.expectedBytes,
        required: r.required,
        license: r.license,
        privacyScope: r.privacyScope,
      })),
  });
  return computeSha256Hex(canonicalPayload);
}

export interface ManifestValidationResult {
  valid: boolean;
  reason:
    | null
    | 'unlicensed_or_forbidden_provider'
    | 'empty_resources'
    | 'total_bytes_mismatch'
    | 'manifest_checksum_mismatch'
    | 'private_resource_in_public_pack'
    | 'ephemeral_token_in_resource_uri'
    | 'missing_resource_license'
    | 'invalid_zoom_range';
}

/**
 * Vérifie la validité structurelle, légale (fournisseur et licences) et
 * cryptographique (SHA-256) d'un manifeste de paquet hors ligne.
 */
export function validatePackManifest(manifest: OfflinePackManifest): ManifestValidationResult {
  if (!isProviderAllowedForOfflinePack(manifest.providerId)) {
    return { valid: false, reason: 'unlicensed_or_forbidden_provider' };
  }

  if (
    !Number.isFinite(manifest.minZoom) ||
    !Number.isFinite(manifest.maxZoom) ||
    manifest.minZoom < 0 ||
    manifest.maxZoom < manifest.minZoom ||
    manifest.maxZoom > 22
  ) {
    return { valid: false, reason: 'invalid_zoom_range' };
  }

  if (!manifest.resources || manifest.resources.length === 0) {
    return { valid: false, reason: 'empty_resources' };
  }

  let summedBytes = 0;
  for (const res of manifest.resources) {
    if (!res.license || res.license.trim().length === 0) {
      return { valid: false, reason: 'missing_resource_license' };
    }
    if (manifest.sharedPublicly && res.privacyScope === 'private_user') {
      // Recherche 04 §Intégration : les coordonnées ou photos privées n'entrent
      // jamais dans un paquet partagé public.
      return { valid: false, reason: 'private_resource_in_public_pack' };
    }
    const normalized = normalizeResourceUri(res.canonicalUri);
    if (normalized !== res.canonicalUri) {
      return { valid: false, reason: 'ephemeral_token_in_resource_uri' };
    }
    summedBytes += res.expectedBytes;
  }

  if (summedBytes !== manifest.totalExpectedBytes) {
    return { valid: false, reason: 'total_bytes_mismatch' };
  }

  const expectedManifestSha = computeManifestSha256(manifest);
  if (expectedManifestSha.toLowerCase() !== manifest.manifestSha256.toLowerCase()) {
    return { valid: false, reason: 'manifest_checksum_mismatch' };
  }

  return { valid: true, reason: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Évaluation de la matrice de capacités et de l'état global du paquet
// ─────────────────────────────────────────────────────────────────────────────

export interface PackEvaluationSummary {
  status: OfflinePackStatus;
  capabilities: OfflineCapabilityMatrix;
  missingRequiredResourceIds: string[];
  missingOptionalResourceIds: string[];
  corruptedResourceIds: string[];
}

/**
 * Évalue de façon déterministe l'état réel d'un paquet et sa matrice de
 * capacités (carte, trace, guidage, recherche, recalcul, météo/fermetures)
 * à partir des ressources effectivement vérifiées (Recherche 04).
 */
export function evaluatePackCapabilitiesAndStatus(
  manifest: OfflinePackManifest,
  verifiedChunks: ReadonlyMap<string, VerifiedResourceChunk>,
  options: {
    nowMs?: number;
    hasLocalRoutingEngine?: boolean;
  } = {},
): PackEvaluationSummary {
  const nowMs = options.nowMs ?? Date.now();
  const missingRequiredResourceIds: string[] = [];
  const missingOptionalResourceIds: string[] = [];
  const corruptedResourceIds: string[] = [];

  const verifiedByKind = new Map<OfflineResourceDescriptor['kind'], number>();
  const totalByKind = new Map<OfflineResourceDescriptor['kind'], number>();

  for (const descriptor of manifest.resources) {
    totalByKind.set(descriptor.kind, (totalByKind.get(descriptor.kind) ?? 0) + 1);
    const chunk = verifiedChunks.get(descriptor.id);
    if (!chunk) {
      if (descriptor.required) {
        missingRequiredResourceIds.push(descriptor.id);
      } else {
        missingOptionalResourceIds.push(descriptor.id);
      }
      continue;
    }

    const check = verifyResourcePayload(descriptor, chunk.payload);
    if (!check.ok || chunk.actualSha256.toLowerCase() !== descriptor.expectedSha256.toLowerCase()) {
      corruptedResourceIds.push(descriptor.id);
      continue;
    }

    verifiedByKind.set(descriptor.kind, (verifiedByKind.get(descriptor.kind) ?? 0) + 1);
  }

  const hasStyle = (verifiedByKind.get('style_json') ?? 0) > 0;
  const hasVectorTiles = (verifiedByKind.get('vector_tile') ?? 0) > 0;
  const allVectorTilesPresent =
    (totalByKind.get('vector_tile') ?? 0) > 0 &&
    (verifiedByKind.get('vector_tile') ?? 0) === (totalByKind.get('vector_tile') ?? 0);
  const totalGlyphs = totalByKind.get('glyph_range') ?? 0;
  const verifiedGlyphs = verifiedByKind.get('glyph_range') ?? 0;
  const missingGlyphs = totalGlyphs > 0 && verifiedGlyphs < totalGlyphs;

  const hasRouteGeometry = (verifiedByKind.get('route_geometry') ?? 0) > 0;
  const hasManeuvers = (verifiedByKind.get('navigation_maneuvers') ?? 0) > 0;
  const hasAddressIndex = (verifiedByKind.get('address_index') ?? 0) > 0;
  const hasRoutingGraph =
    (totalByKind.get('routing_graph_tile') ?? 0) > 0 &&
    (verifiedByKind.get('routing_graph_tile') ?? 0) === (totalByKind.get('routing_graph_tile') ?? 0);

  const capabilities: OfflineCapabilityMatrix = {
    viewRoute:
      hasRouteGeometry && hasStyle
        ? { status: 'available', reason: null }
        : hasRouteGeometry
          ? { status: 'degraded', reason: 'Style local manquant, tracé seul affichable.' }
          : { status: 'unavailable', reason: 'Aucune géométrie de parcours incluse dans ce paquet.' },
    viewMapAround:
      hasStyle && allVectorTilesPresent && !missingGlyphs
        ? { status: 'available', reason: null }
        : hasStyle && hasVectorTiles && missingGlyphs
          ? {
              status: 'degraded',
              reason: 'Style et tuiles présents mais police/glyphes manquants (libellés dégradés).',
            }
          : {
              status: 'unavailable',
              reason: 'Tuiles ou style de carte incomplets pour couvrir la zone.',
            },
    followInstructions:
      hasRouteGeometry && hasManeuvers
        ? { status: 'available', reason: null }
        : {
            status: 'unavailable',
            reason: 'Manœuvres ou tracé de référence absents du paquet.',
          },
    searchAddresses: hasAddressIndex
      ? { status: 'available', reason: null }
      : {
          status: 'unavailable',
          reason: 'Index de lieux local absent (non acquis par le seul pack cartographique).',
        },
    recalculateRoute:
      hasRoutingGraph && options.hasLocalRoutingEngine
        ? { status: 'available', reason: null }
        : hasRoutingGraph && !options.hasLocalRoutingEngine
          ? {
              status: 'unavailable',
              reason: 'Tuiles de graphe présentes mais moteur de routage local non actif.',
            }
          : {
              status: 'unavailable',
              reason: 'Aucun graphe de routage local dans le paquet (retour vers la trace uniquement).',
            },
    liveWeatherAndClosures: {
      status: 'unavailable',
      reason: 'Source externe temps réel indisponible hors réseau ; dernière donnée datée uniquement.',
    },
  };

  if (corruptedResourceIds.length > 0) {
    return {
      status: 'corrupted',
      capabilities,
      missingRequiredResourceIds,
      missingOptionalResourceIds,
      corruptedResourceIds,
    };
  }

  if (missingRequiredResourceIds.length > 0) {
    return {
      status: 'corrupted',
      capabilities,
      missingRequiredResourceIds,
      missingOptionalResourceIds,
      corruptedResourceIds,
    };
  }

  if (manifest.expiresAtMs !== null && nowMs > manifest.expiresAtMs) {
    return {
      status: 'expired',
      capabilities,
      missingRequiredResourceIds,
      missingOptionalResourceIds,
      corruptedResourceIds,
    };
  }

  if (missingOptionalResourceIds.length > 0 || missingGlyphs) {
    return {
      status: 'degraded',
      capabilities,
      missingRequiredResourceIds,
      missingOptionalResourceIds,
      corruptedResourceIds,
    };
  }

  return {
    status: 'available',
    capabilities,
    missingRequiredResourceIds,
    missingOptionalResourceIds,
    corruptedResourceIds,
  };
}

/**
 * Évalue les fermetures connues stockées dans un paquet hors ligne.
 * Recherche 04 §Cas qui doivent échouer proprement :
 * « Fermeture connue expirée hors ligne : conserver date et incertitude ; ne pas affirmer la réouverture. »
 */
export function evaluateOfflineClosures(
  closures: readonly OfflineClosureNotice[],
  nowMs: number = Date.now(),
): OfflineClosureEvaluation[] {
  return closures.map((closure) => {
    const isExpired = closure.expiresAtMs !== null && nowMs > closure.expiresAtMs;
    const recordedDateIso = new Date(closure.recordedAtMs).toISOString().slice(0, 10);
    if (isExpired) {
      const expiredDateIso = new Date(closure.expiresAtMs!).toISOString().slice(0, 10);
      return {
        closureId: closure.id,
        title: closure.title,
        recordedAtMs: closure.recordedAtMs,
        expiresAtMs: closure.expiresAtMs,
        freshness: 'uncertain_expired',
        warningLabel: `${closure.title} — fermeture relevée le ${recordedDateIso} (fin théorique ${expiredDateIso} dépassée hors réseau : réouverture non confirmée).`,
      };
    }
    return {
      closureId: closure.id,
      title: closure.title,
      recordedAtMs: closure.recordedAtMs,
      expiresAtMs: closure.expiresAtMs,
      freshness: 'active_known',
      warningLabel: `${closure.title} — fermeture connue relevée le ${recordedDateIso}.`,
    };
  });
}
