/**
 * Phase 4 — Types du pipeline de couverture (dry-run, sans réseau).
 *
 * AUCUNE donnée géographique n'est embarquée ici : ces types décrivent la
 * structure des fichiers/manifestes que l'humain fournit en entrée.
 */

export type CoverageStatus = 'not_covered' | 'experimental' | 'covered';

export type DatasetStatus = 'staged' | 'validated' | 'published' | 'rolled_back' | 'rejected';

export type Difficulty = 'easy' | 'moderate' | 'hard' | 'expert' | 'unknown';

export interface LatLng {
  lat: number;
  lng: number;
  ele?: number;
  time?: string;
}

export interface NormalizedRoute {
  externalId: string;
  name: string;
  /** Référence dossier/source du manifeste, recopiée telle quelle. */
  source: string;
  points: LatLng[];
  tags: Record<string, string>;
}

export type PoiKind = 'geographic' | 'commercial_offer' | 'affiliate_link';

export type PoiCategory =
  | 'water'
  | 'refuge'
  | 'shelter'
  | 'rescue'
  | 'restriction'
  | 'viewpoint'
  | 'camping'
  | 'food'
  | 'transport'
  | 'lodging'
  | 'summit';

export interface NormalizedPoi {
  id: string;
  kind: PoiKind;
  name: string;
  lat: number;
  lng: number;
  category: PoiCategory | null;
  source: string;
  /** Offres : prix sourcé UNIQUEMENT s'il est horodaté (null sinon). */
  price: number | null;
  currency: string | null;
  priceCheckedAt: string | null;
  availability: boolean | null;
  availabilityCheckedAt: string | null;
  expiresAt: string | null;
  /** Affiliation : URL cible https + divulgation obligatoire. */
  affiliateTargetUrl: string | null;
  affiliateDisclosure: string | null;
  tags: Record<string, string>;
}

export interface LicenseRecord {
  code: string;
  name: string;
  status: 'active' | 'revoked';
  allowsRedistribution: boolean;
  allowsCommercialUse: boolean;
  shareAlike: boolean;
  evidenceUrl: string | null;
  evidenceNote: string | null;
  validUntil: string | null;
}

export interface ImportAuthorization {
  /** Étape 1 : le téléchargement doit être explicitement autorisé. */
  downloadAuthorized: boolean;
  /** Référence humaine de l'autorisation (courriel, contrat, conditions). */
  reference: string;
}

export interface ImportSource {
  name: string;
  url: string;
  licenseCode: string;
  /** Horodatage du téléchargement réel — null tant qu'aucun téléchargement. */
  downloadedAt: string | null;
}

export interface ImportManifest {
  datasetKey: string;
  version: string;
  region: {
    countryIsoA2: string;
    regionCode: string;
  };
  source: ImportSource;
  authorization: ImportAuthorization;
  pipelineVersion: string;
  importActor: string;
}

export interface QualityThresholds {
  minValidGeometries: number;
  minSourcedPois: number;
  minSampledRoutes: number;
  maxUnjustifiedBreaks: number;
}

export interface RouteMetrics {
  distanceKm: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  difficulty: Difficulty;
}

export interface DatasetQualityMetrics {
  totalFeatures: number;
  validGeometries: number;
  invalidGeometries: number;
  unjustifiedBreaks: number;
  sourcedPois: number;
  sampledRoutes: number;
}

export type PipelineStepStatus = 'ok' | 'refused' | 'warning' | 'skipped';

export interface PipelineStepReport {
  step: number;
  name: string;
  status: PipelineStepStatus;
  detail: string;
  counts?: Record<string, number>;
}

export interface FeatureFlags {
  [id: string]: boolean;
}
