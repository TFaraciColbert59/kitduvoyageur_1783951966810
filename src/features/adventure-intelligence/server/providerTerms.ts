/**
 * Registre typé des fournisseurs de données ouvertes 0 € (Lot P2).
 *
 * Centralise :
 * - Les conditions d'utilisation datées (`termsSnapshot`), licences, attributions et quotas techniques.
 * - Le coupe-circuit de production `assertNoForbiddenProdProvider` rejetant tout appel à
 *   Open-Meteo public (`api.open-meteo.com`) ou Overpass public (`overpass-api.de`).
 * - Le verrou de séparation stricte ODbL / données biométriques (`assertOdblBiometricSeparation`).
 * - Les constructeurs typés `Evidence<T>` conformes à `effort.schema.ts`.
 */
import {
  EvidenceSchema,
  FORBIDDEN_PUBLIC_BIOMETRIC_AND_INDIVIDUAL_KEYS,
  type Evidence,
  type EvidenceKind,
} from '../schemas/effort.schema';

export const TERMS_SNAPSHOT_VERSION = 'p2-open-data-2026-11-20';
export const TERMS_SNAPSHOT_CAPTURED_AT = '2026-11-20T00:00:00.000Z';

export const OPEN_DATA_PROVIDER_IDS = [
  'met_norway',
  'meteo_france_open_data',
  'ign_geoplateforme_altimetrie',
  'aws_terrain_tiles',
  'nasa_power',
  'openstreetmap_odbl',
] as const;

export type ProviderId = (typeof OPEN_DATA_PROVIDER_IDS)[number];

export interface ProviderQuotaPolicy {
  /** Plafond de requêtes par seconde (par application ou par IP). */
  maxRequestsPerSecond: number | null;
  /** Plafond de points géométriques par requête (ex. IGN elevationLine <= 5 000 pts/req). */
  maxPointsPerRequest: number | null;
  /** Précision maximale recommandée/imposée en décimales de degré (ex. MET Norway = 4 décimales). */
  coordinatePrecisionDecimals: number | null;
  /** Durée minimale de mise en cache en secondes. */
  minCacheTtlSeconds: number;
  /** Exige un en-tête User-Agent identifiant explicitement LKDV. */
  requiresIdentifiedUserAgent: boolean;
}

export interface ProviderTermsEntry {
  id: ProviderId;
  displayName: string;
  licenceName: string;
  licenceSpdxOrUrl: string;
  attributionText: string;
  commercialUseAllowed: true;
  costEur: 0;
  termsSnapshotVersion: string;
  termsCapturedAt: string;
  updatedAtRequired: boolean;
  odblDatabaseSeparationRequired: boolean;
  allowedHosts: readonly string[];
  quota: ProviderQuotaPolicy;
  notes: string;
}

/**
 * Registre canonique des fournisseurs ouverts 0 € autorisés en production.
 */
export const PROVIDER_TERMS_REGISTRY: Readonly<Record<ProviderId, ProviderTermsEntry>> = {
  met_norway: {
    id: 'met_norway',
    displayName: 'MET Norway (Yr) — Locationforecast 2.0',
    licenceName: 'CC BY 4.0',
    licenceSpdxOrUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionText: 'MET Norway (Yr) — CC BY 4.0',
    commercialUseAllowed: true,
    costEur: 0,
    termsSnapshotVersion: TERMS_SNAPSHOT_VERSION,
    termsCapturedAt: TERMS_SNAPSHOT_CAPTURED_AT,
    updatedAtRequired: true,
    odblDatabaseSeparationRequired: false,
    allowedHosts: ['api.met.no'],
    quota: {
      maxRequestsPerSecond: 20,
      maxPointsPerRequest: 1,
      coordinatePrecisionDecimals: 4,
      minCacheTtlSeconds: 2700,
      requiresIdentifiedUserAgent: true,
    },
    notes:
      'User-Agent identifiant LKDV obligatoire (403 sinon), coordonnées arrondies à 4 décimales max, <= 20 req/s, cache respectant Expires.',
  },
  meteo_france_open_data: {
    id: 'meteo_france_open_data',
    displayName: 'Météo-France Données Publiques (AROME / DPObs / BRA)',
    licenceName: 'Licence Ouverte Etalab 2.0',
    licenceSpdxOrUrl: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
    attributionText:
      'Météo-France — Données Publiques (AROME / DPObs / BRA) — Licence Ouverte Etalab 2.0',
    commercialUseAllowed: true,
    costEur: 0,
    termsSnapshotVersion: TERMS_SNAPSHOT_VERSION,
    termsCapturedAt: TERMS_SNAPSHOT_CAPTURED_AT,
    updatedAtRequired: true,
    odblDatabaseSeparationRequired: false,
    allowedHosts: [
      'public-api.meteofrance.fr',
      'donneespubliques.meteofrance.fr',
      'meteo.data.gouv.fr',
    ],
    quota: {
      maxRequestsPerSecond: 10,
      maxPointsPerRequest: 1,
      coordinatePrecisionDecimals: 4,
      minCacheTtlSeconds: 1800,
      requiresIdentifiedUserAgent: true,
    },
    notes:
      'Modèle AROME (tempC, windMs, précipitations), observations DPObs et bulletins BRA (indice 1..5 réservé exclusivement à l’objet risque séparé). Attribution Etalab 2.0 + date de mise à jour stockées.',
  },
  ign_geoplateforme_altimetrie: {
    id: 'ign_geoplateforme_altimetrie',
    displayName: 'IGN Géoplateforme — Service Altimétrie (RGE ALTI)',
    licenceName: 'Licence Ouverte Etalab 2.0',
    licenceSpdxOrUrl: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
    attributionText:
      'IGN Géoplateforme — Service d’Altimétrie (RGE ALTI) — Licence Ouverte Etalab 2.0',
    commercialUseAllowed: true,
    costEur: 0,
    termsSnapshotVersion: TERMS_SNAPSHOT_VERSION,
    termsCapturedAt: TERMS_SNAPSHOT_CAPTURED_AT,
    updatedAtRequired: true,
    odblDatabaseSeparationRequired: false,
    allowedHosts: ['data.geopf.fr'],
    quota: {
      maxRequestsPerSecond: 5,
      maxPointsPerRequest: 5000,
      coordinatePrecisionDecimals: 6,
      minCacheTtlSeconds: 86_400 * 30,
      requiresIdentifiedUserAgent: true,
    },
    notes:
      'Prioritaire sur France métropolitaine et DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte). Découpage <= 5 000 pts/req, rate limiter token-bucket <= 5 req/s/IP, cache SHA-256 de la géométrie.',
  },
  aws_terrain_tiles: {
    id: 'aws_terrain_tiles',
    displayName: 'AWS Terrain Tiles / Mapzen (Terrarium)',
    licenceName: 'ODbL / Public datasets',
    licenceSpdxOrUrl: 'https://registry.opendata.aws/terrain-tiles/',
    attributionText:
      'Terrain Tiles — Mapzen / AWS Open Data (SRTM, GMTED, ETOPO1, NED — ODbL / Public datasets)',
    commercialUseAllowed: true,
    costEur: 0,
    termsSnapshotVersion: TERMS_SNAPSHOT_VERSION,
    termsCapturedAt: TERMS_SNAPSHOT_CAPTURED_AT,
    updatedAtRequired: false,
    odblDatabaseSeparationRequired: false,
    allowedHosts: ['s3.amazonaws.com'],
    quota: {
      maxRequestsPerSecond: null,
      maxPointsPerRequest: null,
      coordinatePrecisionDecimals: 5,
      minCacheTtlSeconds: 86_400 * 30,
      requiresIdentifiedUserAgent: false,
    },
    notes:
      'Repli mondial hors emprise IGN ou en cas d’indisponibilité de la Géoplateforme IGN.',
  },
  nasa_power: {
    id: 'nasa_power',
    displayName: 'NASA POWER (Climatologie & Tendances)',
    licenceName: 'Public Domain (NASA Open Data)',
    licenceSpdxOrUrl: 'https://power.larc.nasa.gov/',
    attributionText: 'NASA POWER — Earth Science Division (Domaine public)',
    commercialUseAllowed: true,
    costEur: 0,
    termsSnapshotVersion: TERMS_SNAPSHOT_VERSION,
    termsCapturedAt: TERMS_SNAPSHOT_CAPTURED_AT,
    updatedAtRequired: false,
    odblDatabaseSeparationRequired: false,
    allowedHosts: ['power.larc.nasa.gov'],
    quota: {
      maxRequestsPerSecond: 5,
      maxPointsPerRequest: 1,
      coordinatePrecisionDecimals: 2,
      minCacheTtlSeconds: 86_400 * 7,
      requiresIdentifiedUserAgent: true,
    },
    notes:
      'Normales climatologiques 2001-2020 et tendances multi-annuelles au-delà de l’horizon de prévision.',
  },
  openstreetmap_odbl: {
    id: 'openstreetmap_odbl',
    displayName: 'OpenStreetMap (Extraits locaux ODbL)',
    licenceName: 'ODbL 1.0',
    licenceSpdxOrUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    attributionText: '© Contributeurs OpenStreetMap — ODbL 1.0',
    commercialUseAllowed: true,
    costEur: 0,
    termsSnapshotVersion: TERMS_SNAPSHOT_VERSION,
    termsCapturedAt: TERMS_SNAPSHOT_CAPTURED_AT,
    updatedAtRequired: true,
    odblDatabaseSeparationRequired: true,
    allowedHosts: [],
    quota: {
      maxRequestsPerSecond: null,
      maxPointsPerRequest: null,
      coordinatePrecisionDecimals: 6,
      minCacheTtlSeconds: 86_400 * 30,
      requiresIdentifiedUserAgent: false,
    },
    notes:
      'Import exclusivement depuis extraits OSM/GeoJSON locaux (osm2pgsql flex / fichiers locaux) sans appel Overpass public (overpass-api.de interdit). Séparation stricte des tables/colonnes ODbL (trail_segments, trail_segment_features) et des données biométriques utilisateurs.',
  },
};

/**
 * Motifs d'URL ou d'identifiants de fournisseurs strictement interdits en production :
 * - Open-Meteo public (`api.open-meteo.com`, gratuit uniquement en usage non commercial)
 * - Overpass public (`overpass-api.de`, quotas/CGU incompatibles avec le pipeline de production)
 */
const FORBIDDEN_PROD_PATTERNS: ReadonlyArray<{
  code: 'FORBIDDEN_OPEN_METEO_PUBLIC' | 'FORBIDDEN_OVERPASS_PUBLIC';
  regex: RegExp;
  reason: string;
}> = [
  {
    code: 'FORBIDDEN_OPEN_METEO_PUBLIC',
    regex: /(?:^|\/\/|\.|_)open[-_]?meteo(?:\.com|\b)/i,
    reason:
      'Open-Meteo public (api.open-meteo.com) est strictement interdit en production (licence non commerciale). Utiliser Météo-France Données Publiques (Etalab 2.0) et MET Norway (CC BY 4.0).',
  },
  {
    code: 'FORBIDDEN_OVERPASS_PUBLIC',
    regex: /(?:overpass-api\.de|overpass\.kumi\.systems|overpass[-_]public)/i,
    reason:
      'Overpass public (overpass-api.de) est strictement interdit pour le peuplement de trail_segments en production. Utiliser des extraits OSM locaux (ODbL 1.0).',
  },
];

export class ForbiddenProdProviderError extends Error {
  public readonly code: 'FORBIDDEN_OPEN_METEO_PUBLIC' | 'FORBIDDEN_OVERPASS_PUBLIC';
  public readonly urlOrId: string;

  constructor(
    code: 'FORBIDDEN_OPEN_METEO_PUBLIC' | 'FORBIDDEN_OVERPASS_PUBLIC',
    urlOrId: string,
    reason: string
  ) {
    super(`[${code}] Fournisseur interdit en production (${urlOrId}) : ${reason}`);
    this.name = 'ForbiddenProdProviderError';
    this.code = code;
    this.urlOrId = urlOrId;
  }
}

/**
 * Coupe-circuit : rejette explicitement tout appel à Open-Meteo public (`api.open-meteo.com`)
 * ou Overpass public (`overpass-api.de`).
 */
export function assertNoForbiddenProdProvider(urlOrId: string): void {
  const normalized = String(urlOrId ?? '').trim();
  if (!normalized) return;

  for (const entry of FORBIDDEN_PROD_PATTERNS) {
    if (entry.regex.test(normalized)) {
      throw new ForbiddenProdProviderError(entry.code, normalized, entry.reason);
    }
  }
}

/**
 * Retourne l'entrée du registre pour un fournisseur ouvert 0 €.
 */
export function getProviderTerms(providerId: ProviderId): ProviderTermsEntry {
  const entry = PROVIDER_TERMS_REGISTRY[providerId];
  if (!entry) {
    throw new Error(`Fournisseur inconnu dans PROVIDER_TERMS_REGISTRY : ${String(providerId)}`);
  }
  return entry;
}

/**
 * Formate le `licenceSnapshot` horodaté à embarquer dans `Evidence<T>.licenceSnapshot`.
 */
export function formatLicenceSnapshot(
  providerId: ProviderId,
  updatedAtIso: string = TERMS_SNAPSHOT_CAPTURED_AT
): string {
  const terms = getProviderTerms(providerId);
  return `${terms.displayName} — ${terms.licenceName} (snapshot ${terms.termsSnapshotVersion}, MAJ ${updatedAtIso})`;
}

/**
 * Vérifie que le User-Agent identifie bien l'application LKDV avec une URL de contact HTTPS.
 */
export function isValidLkdvUserAgent(userAgent: string | null | undefined): boolean {
  if (typeof userAgent !== 'string') return false;
  const trimmed = userAgent.trim();
  return /^kitduvoyageur\/\d+\.\d+\s+\(.*\+https:\/\/[^\s)]+\)$/.test(trimmed);
}

export function assertValidLkdvUserAgent(userAgent: string | null | undefined): void {
  if (!isValidLkdvUserAgent(userAgent)) {
    throw new Error(
      `User-Agent non conforme aux conditions MET Norway / Météo-France / IGN : "${String(userAgent)}". Attendu : "kitduvoyageur/1.0 (...; +https://...)".`
    );
  }
}

/**
 * Clés biométriques et personnelles strictement interdites dans toute table ou payload ODbL
 * (`trail_segments`, `trail_segment_features`, `hiking_routes`).
 */
const ODBL_FORBIDDEN_USER_AND_BIOMETRIC_KEYS = new Set<string>([
  ...FORBIDDEN_PUBLIC_BIOMETRIC_AND_INDIVIDUAL_KEYS.map((k) => k.toLowerCase()),
  'userid',
  'user_id',
  'sessionid',
  'session_id',
  'memberid',
  'member_id',
  'email',
  'fullname',
  'full_name',
  'heartrate',
  'heart_rate',
  'avgheartratebpm',
  'maxheartratebpm',
  'sessionrpe',
  'session_rpe',
  'packweightkg',
  'pack_weight_kg',
  'biometric',
  'physiology',
]);

export class OdblBiometricSeparationError extends Error {
  public readonly forbiddenPaths: string[];

  constructor(forbiddenPaths: string[]) {
    super(
      `[ODBL_BIOMETRIC_SEPARATION_VIOLATION] Des champs utilisateurs ou biométriques ont été détectés dans un enregistrement ODbL (${forbiddenPaths.join(', ')}). Séparation stricte ODbL 1.0 exigée.`
    );
    this.name = 'OdblBiometricSeparationError';
    this.forbiddenPaths = forbiddenPaths;
  }
}

function collectOdblForbiddenPaths(value: unknown, currentPath: string[] = []): string[] {
  if (value === null || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, idx) =>
      collectOdblForbiddenPaths(item, [...currentPath, String(idx)])
    );
  }
  const violations: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = [...currentPath, key];
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (
      ODBL_FORBIDDEN_USER_AND_BIOMETRIC_KEYS.has(key.toLowerCase()) ||
      ODBL_FORBIDDEN_USER_AND_BIOMETRIC_KEYS.has(normalizedKey)
    ) {
      violations.push(nextPath.join('.'));
    }
    violations.push(...collectOdblForbiddenPaths(child, nextPath));
  }
  return violations;
}

/**
 * Vérifie qu'aucune donnée personnelle ou biométrique utilisateur n'est mélangée
 * avec des tables ou entités géographiques sous licence ODbL 1.0.
 */
export function assertOdblBiometricSeparation(recordOrPayload: unknown): void {
  const violations = collectOdblForbiddenPaths(recordOrPayload);
  if (violations.length > 0) {
    throw new OdblBiometricSeparationError(violations);
  }
}

export interface BuildProviderEvidenceParams<T> {
  providerId: ProviderId;
  value: T;
  unit: string;
  kind?: EvidenceKind;
  quality?: number;
  uncertainty?: number;
  capturedAt?: string;
  updatedAt?: string;
  modelVersion?: string;
  sourceDetail?: string;
}

/**
 * Construit et valide un objet `Evidence<T>` rattaché à un fournisseur du registre `PROVIDER_TERMS_REGISTRY`.
 */
export function buildProviderEvidence<T>(params: BuildProviderEvidenceParams<T>): Evidence<T> {
  const terms = getProviderTerms(params.providerId);
  const capturedAt = params.capturedAt ?? new Date().toISOString();
  const updatedAt = params.updatedAt ?? capturedAt;
  const source = params.sourceDetail
    ? `${terms.displayName} (${params.sourceDetail})`
    : terms.displayName;

  const rawEvidence: Evidence<T> = {
    value: params.value,
    unit: params.unit,
    source,
    kind: params.kind ?? 'measured',
    quality: Math.min(1, Math.max(0, params.quality ?? 0.9)),
    ...(params.uncertainty !== undefined ? { uncertainty: Math.max(0, params.uncertainty) } : {}),
    capturedAt,
    licenceSnapshot: formatLicenceSnapshot(params.providerId, updatedAt),
    ...(params.modelVersion ? { modelVersion: params.modelVersion } : {}),
  };

  EvidenceSchema.parse(rawEvidence);
  return rawEvidence;
}
