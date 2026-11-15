/**
 * K3.07, S3.16, S3.17, S3.18 — Agrégation spatiale sur grille anonymisée
 * par sport et fenêtre temporelle avec k-anonymat strict.
 *
 * Invariants :
 * 1. Aucune coordonnée brute individuelle n'est stockée ni exposée : chaque point
 *    est projeté sur sa cellule de grille `(row, col)` et seules les coordonnées
 *    du centroïde géométrique de la cellule (`cellCenterLat`, `cellCenterLng`)
 *    et ses bornes (`cellBounds`) figurent dans la sortie.
 * 2. K-anonymat strict : une cellule n'est publiée que si au moins
 *    `minContributors` (défaut 5, plancher absolu 3) utilisateurs distincts
 *    éligibles y ont contribué. Un utilisateur qui passe 50 fois dans la même
 *    cellule compte toujours pour 1 seul contributeur distinct.
 * 3. Fail-closed : toute activité privée, supprimée, non terminée, d'un
 *    utilisateur sans consentement ou en opt-out (K7.06 / S6.17), ainsi que
 *    tout point dans une zone masquée (K7.05 / S6.14), est strictement exclu
 *    avant l'accumulation.
 */

import {
  anonymizeContributorId,
  evaluateActivityPublicEligibility,
} from './consent';
import { isValidLatLng, sanitizeTracePointsForPublic } from './privacyMask';
import { filterPointsByCommunityTimeWindow } from './temporal';
import {
  ABSOLUTE_MIN_PUBLIC_CONTRIBUTORS,
  DEFAULT_GRID_RESOLUTION_DEG,
  HEATMAP_GLOBAL_MAX_AGE_DAYS,
  HEATMAP_PROCESSOR_VERSION,
  MIN_HEATMAP_CONTRIBUTORS,
  MIN_PUBLIC_GRID_RESOLUTION_DEG,
  type AggregateContributionPreferences,
  type CellBBox,
  type CommunityTimeWindow,
  type HeatmapActivityRecord,
  type HeatmapGeoJsonCollection,
  type HeatmapGeoJsonFeature,
  type HeatmapIntensityBand,
  type HeatmapSportFilter,
  type PublicHeatmapCell,
  type PublicHeatmapLayer,
  type UserPrivacyZone,
} from './types';

export interface GridCellGeometry {
  cellId: string;
  row: number;
  col: number;
  cellCenterLat: number;
  cellCenterLng: number;
  cellBounds: CellBBox;
}

export interface BuildCommunityHeatmapOptions {
  /** Filtre par sport (`'all'` par défaut — K3.07, S3.16). */
  sport?: HeatmapSportFilter;
  /** Fenêtre temporelle (`'global'` par défaut — S3.16, S3.17, S3.18). */
  timeWindow?: CommunityTimeWindow;
  /** Instant de référence ISO (défaut : maintenant). */
  now?: string;
  /** Résolution de la grille en degrés (plancher public : `MIN_PUBLIC_GRID_RESOLUTION_DEG`). */
  gridResolutionDeg?: number;
  /** Seuil minimal de contributeurs distincts par cellule (défaut : 5, plancher absolu : 3). */
  minContributors?: number;
  /** Âge maximal en jours pour la fenêtre globale/nocturne (défaut : 730). */
  maxGlobalAgeDays?: number;
  /** Préférences de consentement indexées ou en tableau par utilisateur (K7.06, S6.17). */
  consents:
    | ReadonlyMap<string, AggregateContributionPreferences>
    | readonly AggregateContributionPreferences[];
  /** Zones de confidentialité géographiques (K7.05, S6.14). */
  privacyZones?: readonly UserPrivacyZone[];
  /** Liste optionnelle d'identifiants d'utilisateurs révoqués/bloqués à exclure immédiatement. */
  revokedUserIds?: ReadonlySet<string> | readonly string[];
}

function roundCoord(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Normalise la résolution de grille publique en imposant le plancher anti-reconstruction. */
export function resolvePublicGridResolution(requested?: number): number {
  if (requested == null || !Number.isFinite(requested) || requested <= 0) {
    return DEFAULT_GRID_RESOLUTION_DEG;
  }
  return Math.max(MIN_PUBLIC_GRID_RESOLUTION_DEG, Math.min(1, requested));
}

/** Normalise le seuil de k-anonymat public en imposant le plancher absolu (>= 3). */
export function resolvePublicMinContributors(requested?: number): number {
  if (requested == null || !Number.isFinite(requested)) {
    return MIN_HEATMAP_CONTRIBUTORS;
  }
  return Math.max(ABSOLUTE_MIN_PUBLIC_CONTRIBUTORS, Math.floor(requested));
}

/**
 * Projette un point `(lat, lng)` sur une cellule de grille déterministe et
 * retourne uniquement la géométrie de la cellule (centroïde fixe et bbox).
 */
export function quantizePointToCell(
  lat: number,
  lng: number,
  resolutionDeg = DEFAULT_GRID_RESOLUTION_DEG
): GridCellGeometry | null {
  if (!isValidLatLng(lat, lng)) return null;
  const res =
    Number.isFinite(resolutionDeg) && resolutionDeg > 0
      ? resolutionDeg
      : DEFAULT_GRID_RESOLUTION_DEG;

  const row = Math.floor((lat + 90) / res);
  const col = Math.floor((lng + 180) / res);

  const minLat = roundCoord(-90 + row * res);
  const maxLat = roundCoord(Math.min(90, minLat + res));
  const minLng = roundCoord(-180 + col * res);
  const maxLng = roundCoord(Math.min(180, minLng + res));

  const cellCenterLat = roundCoord((minLat + maxLat) / 2);
  const cellCenterLng = roundCoord((minLng + maxLng) / 2);
  const resTag = Math.round(res * 1_000_000);

  return {
    cellId: `g${resTag}:${row}:${col}`,
    row,
    col,
    cellCenterLat,
    cellCenterLng,
    cellBounds: [minLng, minLat, maxLng, maxLat],
  };
}

/** Attribue une bande d'intensité visuelle à partir d'un score normalisé `[0, 1]`. */
export function classifyIntensityBand(intensity: number): HeatmapIntensityBand {
  if (intensity >= 0.8) return 'peak';
  if (intensity >= 0.5) return 'high';
  if (intensity >= 0.25) return 'medium';
  return 'low';
}

function toConsentMap(
  consents:
    | ReadonlyMap<string, AggregateContributionPreferences>
    | readonly AggregateContributionPreferences[]
): Map<string, AggregateContributionPreferences> {
  if (consents instanceof Map) {
    return new Map(consents);
  }
  const map = new Map<string, AggregateContributionPreferences>();
  if (Array.isArray(consents)) {
    for (const item of consents) {
      if (item && typeof item.userId === 'string') {
        map.set(item.userId.trim(), item);
      }
    }
  }
  return map;
}

function toRevokedSet(revoked?: ReadonlySet<string> | readonly string[]): Set<string> {
  if (!revoked) return new Set();
  return new Set(Array.from(revoked, (id) => id.trim()));
}

interface MutableCommunityBucket {
  geometry: GridCellGeometry;
  contributorHashes: Set<string>;
  passageIds: Set<string>;
}

/**
 * Construit une couche de heatmap communautaire/publique (K3.07, S3.16, S3.17, S3.18)
 * en appliquant :
 * - le filtre de sport (`sport`),
 * - le consentement explicite et l'opt-out strict K7.06 / S6.17,
 * - l'exclusion des activités privées/non terminées/supprimées,
 * - le masquage géométrique des zones privées K7.05 / S6.14,
 * - le filtre temporel (`global`, `last_7_days`, `nocturnal`),
 * - et le seuil de k-anonymat par cellule (`minContributors`).
 */
export function buildCommunityHeatmapLayer(
  activities: readonly HeatmapActivityRecord[],
  options: BuildCommunityHeatmapOptions
): PublicHeatmapLayer {
  const sport: HeatmapSportFilter = options.sport ?? 'all';
  const timeWindow: CommunityTimeWindow = options.timeWindow ?? 'global';
  const computedAt = options.now ?? new Date().toISOString();
  const gridResolutionDeg = resolvePublicGridResolution(options.gridResolutionDeg);
  const minContributors = resolvePublicMinContributors(options.minContributors);
  const maxGlobalAgeDays = options.maxGlobalAgeDays ?? HEATMAP_GLOBAL_MAX_AGE_DAYS;

  const consentMap = toConsentMap(options.consents);
  const revokedUsers = toRevokedSet(options.revokedUserIds);

  const zonesByUser = new Map<string, UserPrivacyZone[]>();
  if (options.privacyZones) {
    for (const zone of options.privacyZones) {
      const uid = (zone.userId ?? '').trim();
      if (!uid) continue;
      const list = zonesByUser.get(uid);
      if (list) list.push(zone);
      else zonesByUser.set(uid, [zone]);
    }
  }

  const buckets = new Map<string, MutableCommunityBucket>();
  let eligibleActivityCount = 0;
  let excludedActivityCount = 0;
  let maskedPointCount = 0;

  for (const activity of activities) {
    const uid = (activity.userId ?? '').trim();

    // Filtre par sport (K3.07)
    if (sport !== 'all' && activity.sport !== sport) {
      continue;
    }

    // Utilisateur révoqué explicitement
    if (revokedUsers.has(uid)) {
      excludedActivityCount += 1;
      continue;
    }

    // Éligibilité fail-closed (K7.06, S6.17, P01)
    const prefs = consentMap.get(uid);
    const eligibility = evaluateActivityPublicEligibility(activity, prefs, 'global_heatmap');
    if (!eligibility.eligible) {
      excludedActivityCount += 1;
      continue;
    }

    // Masquage géométrique des zones de confidentialité (K7.05, S6.14)
    const userZones = zonesByUser.get(uid) ?? [];
    const sanitized = sanitizeTracePointsForPublic(
      activity.points,
      userZones,
      activity.maskingRule
    );
    maskedPointCount += sanitized.maskedPointCount;

    if (sanitized.keptPoints.length === 0) {
      excludedActivityCount += 1;
      continue;
    }

    // Filtre de fenêtre temporelle (S3.16 global, S3.17 7 jours, S3.18 nocturne)
    const windowPoints = filterPointsByCommunityTimeWindow(
      sanitized.keptPoints,
      activity.startedAt,
      timeWindow,
      computedAt,
      maxGlobalAgeDays
    );

    if (windowPoints.length === 0) {
      excludedActivityCount += 1;
      continue;
    }

    // Déduplication des cellules traversées par cette activité
    const visitedCellsInActivity = new Map<string, GridCellGeometry>();
    for (const pt of windowPoints) {
      const cell = quantizePointToCell(pt.lat, pt.lng, gridResolutionDeg);
      if (!cell) continue;
      if (!visitedCellsInActivity.has(cell.cellId)) {
        visitedCellsInActivity.set(cell.cellId, cell);
      }
    }

    if (visitedCellsInActivity.size === 0) {
      excludedActivityCount += 1;
      continue;
    }

    eligibleActivityCount += 1;
    const contributorHash = anonymizeContributorId(uid);

    for (const [cellId, geometry] of visitedCellsInActivity.entries()) {
      let bucket = buckets.get(cellId);
      if (!bucket) {
        bucket = {
          geometry,
          contributorHashes: new Set<string>(),
          passageIds: new Set<string>(),
        };
        buckets.set(cellId, bucket);
      }
      bucket.contributorHashes.add(contributorHash);
      bucket.passageIds.add(activity.activityId);
    }
  }

  // Filtrage strict par k-anonymat (>= minContributors utilisateurs distincts)
  const publishableBuckets: MutableCommunityBucket[] = [];
  let suppressedCellCount = 0;

  for (const bucket of buckets.values()) {
    if (bucket.contributorHashes.size >= minContributors) {
      publishableBuckets.push(bucket);
    } else {
      suppressedCellCount += 1;
    }
  }

  const maxPassages = publishableBuckets.reduce(
    (max, b) => Math.max(max, b.passageIds.size),
    0
  );

  const cells: PublicHeatmapCell[] = publishableBuckets.map((bucket) => {
    const distinctContributorCount = bucket.contributorHashes.size;
    const passageCount = bucket.passageIds.size;
    // Normalisation logarithmique douce dans [0, 1]
    const rawIntensity =
      maxPassages <= 1
        ? 1
        : Math.log1p(passageCount) / Math.log1p(maxPassages);
    const intensity = round4(Math.max(0.05, Math.min(1, rawIntensity)));

    return {
      cellId: bucket.geometry.cellId,
      cellCenterLat: bucket.geometry.cellCenterLat,
      cellCenterLng: bucket.geometry.cellCenterLng,
      cellBounds: bucket.geometry.cellBounds,
      distinctContributorCount,
      passageCount,
      intensity,
      band: classifyIntensityBand(intensity),
    };
  });

  // Tri déterministe par cellId
  cells.sort((a, b) => (a.cellId < b.cellId ? -1 : a.cellId > b.cellId ? 1 : 0));

  const features: HeatmapGeoJsonFeature<Omit<PublicHeatmapCell, 'cellBounds'>>[] = cells.map(
    (cell) => ({
      type: 'Feature',
      id: cell.cellId,
      bbox: cell.cellBounds,
      geometry: {
        type: 'Point',
        coordinates: [cell.cellCenterLng, cell.cellCenterLat],
      },
      properties: {
        cellId: cell.cellId,
        cellCenterLat: cell.cellCenterLat,
        cellCenterLng: cell.cellCenterLng,
        distinctContributorCount: cell.distinctContributorCount,
        passageCount: cell.passageCount,
        intensity: cell.intensity,
        band: cell.band,
      },
    })
  );

  const geojson: HeatmapGeoJsonCollection<Omit<PublicHeatmapCell, 'cellBounds'>> = {
    type: 'FeatureCollection',
    features,
  };

  return {
    kind: 'community',
    processorVersion: HEATMAP_PROCESSOR_VERSION,
    sport,
    timeWindow,
    gridResolutionDeg,
    minContributors,
    computedAt,
    cells,
    suppressedCellCount,
    eligibleActivityCount,
    excludedActivityCount,
    maskedPointCount,
    geojson,
  };
}
