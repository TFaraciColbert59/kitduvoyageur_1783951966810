/**
 * K3.08 & S3.19 — Heatmap personnelle privée par sport et période, avec
 * comparaison entre deux périodes ou deux sports.
 *
 * Invariants de sécurité (fail-closed) :
 * - Une heatmap personnelle n'est calculée que lorsque `viewerUserId` est
 *   strictement identique à `ownerUserId` (non vide). Tout appel par un tiers,
 *   un invité ou sans authentification lève ou retourne un refus explicite et
 *   zéro cellule.
 * - Seules les activités appartenant à `ownerUserId` (et non supprimées)
 *   peuvent alimenter sa couche personnelle.
 */

import { isValidLatLng, sanitizeTracePointsForPublic } from './privacyMask';
import {
  classifyIntensityBand,
  quantizePointToCell,
  type GridCellGeometry,
} from './spatialGrid';
import { isNocturnalTimestamp, isWithinPersonalTimeFilter } from './temporal';
import {
  DEFAULT_GRID_RESOLUTION_DEG,
  type HeatmapActivityRecord,
  type HeatmapGeoJsonCollection,
  type HeatmapGeoJsonFeature,
  type PersonalHeatmapCell,
  type PersonalHeatmapLayer,
  type PersonalTimeFilter,
  type Sport,
  type UserPrivacyZone,
} from './types';

export interface BuildPersonalHeatmapOptions {
  /** Propriétaire de la heatmap personnelle. */
  ownerUserId: string;
  /** Utilisateur courant demandant la vue (doit être === `ownerUserId`). */
  viewerUserId: string;
  /** Filtre par sport : `'all'`, un `Sport` ou une liste de `Sport` (K3.08, S3.19). */
  sport?: Sport | readonly Sport[] | 'all';
  /** Filtre de période temporelle (S3.19). Défaut : `{ kind: 'all_time' }`. */
  period?: PersonalTimeFilter;
  /** Inclure les sorties privées du propriétaire (défaut : `true`). */
  includePrivateActivities?: boolean;
  /** Appliquer optionnellement les zones de masquage sur sa propre vue (défaut : `false`). */
  applyPrivacyZones?: boolean;
  privacyZones?: readonly UserPrivacyZone[];
  /** Résolution de grille en degrés (défaut : `DEFAULT_GRID_RESOLUTION_DEG`). */
  gridResolutionDeg?: number;
  /** Instant de référence ISO (défaut : maintenant). */
  now?: string;
}

export interface PersonalHeatmapAccessResult {
  authorized: boolean;
  reason?: 'missing_user_id' | 'viewer_is_not_owner';
  layer: PersonalHeatmapLayer | null;
}

export interface PersonalCellComparisonDelta {
  cellId: string;
  cellCenterLat: number;
  cellCenterLng: number;
  baselineActivityCount: number;
  targetActivityCount: number;
  activityDelta: number;
  intensityDelta: number;
}

export interface PersonalHeatmapComparison {
  ownerUserId: string;
  /** Cellules nouvellement explorées dans la couche cible (`target`) absentes de `baseline`. */
  newlyExploredCells: PersonalHeatmapCell[];
  /** Cellules visitées dans les deux périodes/sports avec variation de fréquentation. */
  recurringCells: PersonalCellComparisonDelta[];
  /** Cellules présentes dans `baseline` mais non revisitées dans `target`. */
  unvisitedBaselineCells: PersonalHeatmapCell[];
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function normalizeSportSelection(
  sport?: Sport | readonly Sport[] | 'all'
): readonly Sport[] | 'all' {
  if (!sport || sport === 'all') return 'all';
  if (typeof sport === 'string') return [sport];
  return sport.length === 0 ? 'all' : [...sport];
}

interface MutablePersonalBucket {
  geometry: GridCellGeometry;
  activityIds: Set<string>;
  pointCount: number;
  sports: Set<Sport>;
  lastVisitedAt: string | null;
}

/**
 * Calcule la heatmap personnelle privée (K3.08, S3.19) avec contrôle d'accès
 * propriétaire fail-closed.
 */
export function buildPersonalHeatmapLayer(
  activities: readonly HeatmapActivityRecord[],
  options: BuildPersonalHeatmapOptions
): PersonalHeatmapAccessResult {
  const ownerId = (options.ownerUserId ?? '').trim();
  const viewerId = (options.viewerUserId ?? '').trim();

  if (!ownerId || !viewerId) {
    return {
      authorized: false,
      reason: 'missing_user_id',
      layer: null,
    };
  }

  if (ownerId !== viewerId) {
    return {
      authorized: false,
      reason: 'viewer_is_not_owner',
      layer: null,
    };
  }

  const sportsFilter = normalizeSportSelection(options.sport);
  const sportsSet = sportsFilter === 'all' ? null : new Set<Sport>(sportsFilter);
  const period: PersonalTimeFilter = options.period ?? { kind: 'all_time' };
  const includePrivateActivities = options.includePrivateActivities ?? true;
  const computedAt = options.now ?? new Date().toISOString();
  const gridResolutionDeg =
    options.gridResolutionDeg != null &&
    Number.isFinite(options.gridResolutionDeg) &&
    options.gridResolutionDeg > 0
      ? Math.max(0.0001, Math.min(1, options.gridResolutionDeg))
      : DEFAULT_GRID_RESOLUTION_DEG;

  const ownerZones =
    options.applyPrivacyZones && options.privacyZones
      ? options.privacyZones.filter((z) => (z.userId ?? '').trim() === ownerId && z.active)
      : [];

  const buckets = new Map<string, MutablePersonalBucket>();
  let matchedActivityCount = 0;

  for (const activity of activities) {
    if ((activity.userId ?? '').trim() !== ownerId) continue;
    if (activity.deletedAt != null && activity.deletedAt !== '') continue;
    if (activity.sessionFinished === false) continue;

    if (!includePrivateActivities) {
      const isPrivate =
        activity.isPrivate === true ||
        activity.visibility === 'private' ||
        activity.visibility === 'followers_only';
      if (isPrivate) continue;
    }

    if (sportsSet && !sportsSet.has(activity.sport)) {
      continue;
    }

    const sourcePoints =
      options.applyPrivacyZones === true
        ? sanitizeTracePointsForPublic(activity.points, ownerZones, activity.maskingRule).keptPoints
        : activity.points.filter((pt) => pt && isValidLatLng(pt.lat, pt.lng));

    if (sourcePoints.length === 0) continue;

    let activityContributed = false;

    for (const pt of sourcePoints) {
      const effectiveTs = pt.timestamp ?? activity.startedAt;
      if (!isWithinPersonalTimeFilter(effectiveTs, period, computedAt)) {
        continue;
      }
      if (period.nocturnalOnly === true && !isNocturnalTimestamp(effectiveTs, pt.lat, pt.lng)) {
        continue;
      }

      const cell = quantizePointToCell(pt.lat, pt.lng, gridResolutionDeg);
      if (!cell) continue;

      activityContributed = true;
      let bucket = buckets.get(cell.cellId);
      if (!bucket) {
        bucket = {
          geometry: cell,
          activityIds: new Set<string>(),
          pointCount: 0,
          sports: new Set<Sport>(),
          lastVisitedAt: null,
        };
        buckets.set(cell.cellId, bucket);
      }

      bucket.activityIds.add(activity.activityId);
      bucket.pointCount += 1;
      bucket.sports.add(activity.sport);

      if (
        effectiveTs &&
        (bucket.lastVisitedAt === null || Date.parse(effectiveTs) > Date.parse(bucket.lastVisitedAt))
      ) {
        bucket.lastVisitedAt = effectiveTs;
      }
    }

    if (activityContributed) {
      matchedActivityCount += 1;
    }
  }

  const maxActivityCount = Array.from(buckets.values()).reduce(
    (max, b) => Math.max(max, b.activityIds.size),
    0
  );

  const cells: PersonalHeatmapCell[] = Array.from(buckets.values()).map((bucket) => {
    const activityCount = bucket.activityIds.size;
    const rawIntensity =
      maxActivityCount <= 1
        ? 1
        : Math.log1p(activityCount) / Math.log1p(maxActivityCount);
    const intensity = round4(Math.max(0.1, Math.min(1, rawIntensity)));

    return {
      cellId: bucket.geometry.cellId,
      cellCenterLat: bucket.geometry.cellCenterLat,
      cellCenterLng: bucket.geometry.cellCenterLng,
      cellBounds: bucket.geometry.cellBounds,
      activityCount,
      pointCount: bucket.pointCount,
      intensity,
      band: classifyIntensityBand(intensity),
      sports: Array.from(bucket.sports).sort(),
      lastVisitedAt: bucket.lastVisitedAt,
    };
  });

  cells.sort((a, b) => (a.cellId < b.cellId ? -1 : a.cellId > b.cellId ? 1 : 0));

  const features: HeatmapGeoJsonFeature<Omit<PersonalHeatmapCell, 'cellBounds'>>[] = cells.map(
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
        activityCount: cell.activityCount,
        pointCount: cell.pointCount,
        intensity: cell.intensity,
        band: cell.band,
        sports: cell.sports,
        lastVisitedAt: cell.lastVisitedAt,
      },
    })
  );

  const geojson: HeatmapGeoJsonCollection<Omit<PersonalHeatmapCell, 'cellBounds'>> = {
    type: 'FeatureCollection',
    features,
  };

  return {
    authorized: true,
    layer: {
      kind: 'personal',
      ownerUserId: ownerId,
      sports: sportsFilter,
      period,
      includePrivateActivities,
      gridResolutionDeg,
      computedAt,
      cells,
      activityCount: matchedActivityCount,
      geojson,
    },
  };
}

/**
 * Compare deux couches de heatmap personnelles du même propriétaire (S3.19 :
 * comparaison entre deux périodes ou deux sports).
 * Fail-closed si les deux couches n'appartiennent pas au même `ownerUserId`.
 */
export function comparePersonalHeatmaps(
  baseline: PersonalHeatmapLayer,
  target: PersonalHeatmapLayer
): PersonalHeatmapComparison | null {
  if (
    !baseline.ownerUserId ||
    baseline.ownerUserId !== target.ownerUserId ||
    baseline.gridResolutionDeg !== target.gridResolutionDeg
  ) {
    return null;
  }

  const baselineByCell = new Map<string, PersonalHeatmapCell>(
    baseline.cells.map((c) => [c.cellId, c])
  );
  const targetByCell = new Map<string, PersonalHeatmapCell>(
    target.cells.map((c) => [c.cellId, c])
  );

  const newlyExploredCells: PersonalHeatmapCell[] = [];
  const recurringCells: PersonalCellComparisonDelta[] = [];
  const unvisitedBaselineCells: PersonalHeatmapCell[] = [];

  for (const targetCell of target.cells) {
    const baseCell = baselineByCell.get(targetCell.cellId);
    if (!baseCell) {
      newlyExploredCells.push(targetCell);
    } else {
      recurringCells.push({
        cellId: targetCell.cellId,
        cellCenterLat: targetCell.cellCenterLat,
        cellCenterLng: targetCell.cellCenterLng,
        baselineActivityCount: baseCell.activityCount,
        targetActivityCount: targetCell.activityCount,
        activityDelta: targetCell.activityCount - baseCell.activityCount,
        intensityDelta: round4(targetCell.intensity - baseCell.intensity),
      });
    }
  }

  for (const baseCell of baseline.cells) {
    if (!targetByCell.has(baseCell.cellId)) {
      unvisitedBaselineCells.push(baseCell);
    }
  }

  return {
    ownerUserId: baseline.ownerUserId,
    newlyExploredCells,
    recurringCells,
    unvisitedBaselineCells,
  };
}
