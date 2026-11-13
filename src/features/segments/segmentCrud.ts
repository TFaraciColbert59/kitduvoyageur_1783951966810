/**
 * S4.02 — Créer, modifier, rendre privé/public ou supprimer un segment.
 *
 * Responsabilités :
 * - Créer un segment à partir d'une tranche (bornes `startPointIndex`..`endPointIndex`)
 *   d'une activité enregistrée, avec calcul déterministe de la longueur, du D+/D- et des pentes.
 * - Garantir les invariants P01 : interdire la création ou la publication d'un segment `public`
 *   dont le tracé intersecte une zone masquée (K7.05 / S6.14) ou des points masqués.
 * - Gérer la modification des bornes (incrémentation de `version` et invalidation des efforts
 *   de l'ancienne version), le basculement `public` ↔ `private` (retrait immédiat des classements
 *   publics) et la suppression logique/définitive par le propriétaire.
 * - Fournir la machine d'état pure du sous-drawer de création/édition avec restauration
 *   du contexte du drawer parent.
 */

import { haversineM } from '@/features/adventure-intelligence/domain/geo';
import { elevationGainLoss, NORMALIZATION_DEFAULTS } from '@/features/adventure-intelligence/domain/trackNormalization';
import { isPointInPrivacyZones } from './matchingEngine';
import type {
  ActivityTraceForSegments,
  DrawerParentContext,
  GeoPoint,
  PrivacyZoneCircle,
  SegmentDefinition,
  SegmentEffort,
  SegmentSport,
  SegmentVisibility,
} from './types';

export const MIN_SEGMENT_LENGTH_M = 120;
export const MAX_SEGMENT_LENGTH_M = 80_000;
export const MIN_SEGMENT_POINTS = 3;

export type SegmentCrudValidationError =
  | 'invalid_name'
  | 'invalid_bounds'
  | 'too_few_points'
  | 'segment_too_short'
  | 'segment_too_long'
  | 'manual_or_indoor_source'
  | 'privacy_zone_conflict_for_public_segment'
  | 'gps_gap_in_source_trace'
  | 'unauthorized_not_owner';

export interface CreateSegmentFromActivityInput {
  segmentId?: string;
  name: string;
  activity: ActivityTraceForSegments;
  startPointIndex: number;
  endPointIndex: number;
  visibility: SegmentVisibility;
  sport?: SegmentSport;
  surface?: string | null;
  nowIso?: string;
}

export interface CreateSegmentResult {
  ok: boolean;
  error?: SegmentCrudValidationError;
  segment?: SegmentDefinition;
}

function computeSegmentGeometryStats(points: GeoPoint[]): {
  lengthM: number;
  elevationGainM: number;
  elevationLossM: number;
  meanGradePct: number;
  maxGradePct: number;
} {
  let lengthM = 0;
  let maxGradePct = 0;

  for (let i = 1; i < points.length; i += 1) {
    lengthM += haversineM(points[i - 1], points[i]);
  }

  // Calcul de pente maximale sur fenêtre d'au moins 25 m pour lisser le bruit
  for (let i = 0; i < points.length - 1; i += 1) {
    const startEle = points[i].ele;
    if (typeof startEle !== 'number' || !Number.isFinite(startEle)) continue;
    let distWindow = 0;
    let j = i;
    while (j + 1 < points.length && distWindow < 25) {
      distWindow += haversineM(points[j], points[j + 1]);
      j += 1;
    }
    if (distWindow >= 25) {
      const endEle = points[j].ele;
      if (typeof endEle === 'number' && Number.isFinite(endEle)) {
        const grade = Math.abs(((endEle - startEle) / distWindow) * 100);
        maxGradePct = Math.max(maxGradePct, grade);
      }
    }
  }

  const { gainM, lossM } = elevationGainLoss(
    points.map((p) => (typeof p.ele === 'number' ? p.ele : undefined)),
    NORMALIZATION_DEFAULTS.elevationHysteresisM
  );

  const firstEle = points.find((p) => typeof p.ele === 'number' && Number.isFinite(p.ele))?.ele;
  const lastEle = [...points]
    .reverse()
    .find((p) => typeof p.ele === 'number' && Number.isFinite(p.ele))?.ele;

  const netDeltaEle =
    typeof firstEle === 'number' && typeof lastEle === 'number'
      ? lastEle - firstEle
      : gainM - lossM;

  const meanGradePct = lengthM > 0 ? (netDeltaEle / lengthM) * 100 : 0;

  return {
    lengthM: Math.round(lengthM * 10) / 10,
    elevationGainM: Math.round(gainM * 10) / 10,
    elevationLossM: Math.round(lossM * 10) / 10,
    meanGradePct: Math.round(meanGradePct * 100) / 100,
    maxGradePct: Math.round(maxGradePct * 100) / 100,
  };
}

/**
 * Crée un segment à partir d'une activité enregistrée entre `startPointIndex` et `endPointIndex`.
 */
export function createSegmentFromActivity(
  input: CreateSegmentFromActivityInput
): CreateSegmentResult {
  const { activity, startPointIndex, endPointIndex, visibility } = input;
  const trimmedName = input.name.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();

  if (trimmedName.length < 3) {
    return { ok: false, error: 'invalid_name' };
  }

  if (activity.isManualOrIndoor) {
    return { ok: false, error: 'manual_or_indoor_source' };
  }

  if (
    !Number.isInteger(startPointIndex) ||
    !Number.isInteger(endPointIndex) ||
    startPointIndex < 0 ||
    endPointIndex >= activity.points.length ||
    endPointIndex <= startPointIndex
  ) {
    return { ok: false, error: 'invalid_bounds' };
  }

  const slice = activity.points.slice(startPointIndex, endPointIndex + 1);
  if (slice.length < MIN_SEGMENT_POINTS) {
    return { ok: false, error: 'too_few_points' };
  }

  // Vérification de continuité GPS (pas de saut > 350 m dans la définition du segment)
  for (let i = 1; i < slice.length; i += 1) {
    if (haversineM(slice[i - 1], slice[i]) > 350) {
      return { ok: false, error: 'gps_gap_in_source_trace' };
    }
  }

  // Contrôle P01 : un segment public ne peut pas être créé dans une zone masquée
  if (visibility === 'public') {
    const maskedSet = new Set(activity.maskedPointIndices ?? []);
    for (let idx = startPointIndex; idx <= endPointIndex; idx += 1) {
      const pt = activity.points[idx];
      if (
        pt.maskedByPrivacyZone === true ||
        maskedSet.has(idx) ||
        isPointInPrivacyZones(pt, activity.hiddenZones)
      ) {
        return { ok: false, error: 'privacy_zone_conflict_for_public_segment' };
      }
    }
  }

  const geoPoints: GeoPoint[] = slice.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    ele: p.ele ?? null,
  }));

  const stats = computeSegmentGeometryStats(geoPoints);
  if (stats.lengthM < MIN_SEGMENT_LENGTH_M) {
    return { ok: false, error: 'segment_too_short' };
  }
  if (stats.lengthM > MAX_SEGMENT_LENGTH_M) {
    return { ok: false, error: 'segment_too_long' };
  }

  const segmentId =
    input.segmentId ?? `seg_${activity.activityId}_${startPointIndex}_${endPointIndex}`;

  const segment: SegmentDefinition = {
    id: segmentId,
    version: 1,
    name: trimmedName,
    sport: input.sport ?? activity.sport,
    direction: 'forward',
    points: geoPoints,
    startPoint: geoPoints[0],
    endPoint: geoPoints[geoPoints.length - 1],
    lengthM: stats.lengthM,
    elevationGainM: stats.elevationGainM,
    elevationLossM: stats.elevationLossM,
    meanGradePct: stats.meanGradePct,
    maxGradePct: stats.maxGradePct,
    surface: input.surface ?? null,
    visibility,
    createdByUserId: activity.userId,
    sourceActivityId: activity.activityId,
    verified: false,
    verifiedReason: null,
    canonicalSegmentId: null,
    mergedDuplicateIds: [],
    hazardous: false,
    hazardCategory: null,
    hazardReportedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    deletedAt: null,
  };

  return { ok: true, segment };
}

export interface UpdateSegmentInput {
  segment: SegmentDefinition;
  actorUserId: string;
  name?: string;
  sport?: SegmentSport;
  surface?: string | null;
  visibility?: SegmentVisibility;
  /** Optionnel : redéfinition des bornes sur la trace de l'activité source. */
  newBounds?: {
    activity: ActivityTraceForSegments;
    startPointIndex: number;
    endPointIndex: number;
  };
  ownerHiddenZones?: PrivacyZoneCircle[];
  existingEfforts?: SegmentEffort[];
  nowIso?: string;
}

export interface UpdateSegmentResult {
  ok: boolean;
  error?: SegmentCrudValidationError;
  segment: SegmentDefinition;
  updatedEfforts: SegmentEffort[];
  requiresEffortRecomputation: boolean;
}

/**
 * Modifie un segment existant (nom, sport, bornes, visibilité).
 * Si les bornes ou le sport changent, incrémente `version` et demande le recalcul des efforts.
 * Si la visibilité passe à `private`, retire immédiatement tous les efforts des classements publics.
 */
export function updateSegment(input: UpdateSegmentInput): UpdateSegmentResult {
  const { segment, actorUserId } = input;
  const existingEfforts = input.existingEfforts ?? [];
  const nowIso = input.nowIso ?? new Date().toISOString();

  if (actorUserId !== segment.createdByUserId) {
    return {
      ok: false,
      error: 'unauthorized_not_owner',
      segment,
      updatedEfforts: existingEfforts,
      requiresEffortRecomputation: false,
    };
  }

  const nextName = input.name !== undefined ? input.name.trim() : segment.name;
  if (nextName.length < 3) {
    return {
      ok: false,
      error: 'invalid_name',
      segment,
      updatedEfforts: existingEfforts,
      requiresEffortRecomputation: false,
    };
  }

  const nextVisibility = input.visibility ?? segment.visibility;
  const nextSport = input.sport ?? segment.sport;

  let nextPoints = segment.points;
  let stats = {
    lengthM: segment.lengthM,
    elevationGainM: segment.elevationGainM,
    elevationLossM: segment.elevationLossM,
    meanGradePct: segment.meanGradePct,
    maxGradePct: segment.maxGradePct,
  };
  let geometryChanged = false;

  if (input.newBounds) {
    const { activity, startPointIndex, endPointIndex } = input.newBounds;
    if (
      startPointIndex < 0 ||
      endPointIndex >= activity.points.length ||
      endPointIndex - startPointIndex + 1 < MIN_SEGMENT_POINTS
    ) {
      return {
        ok: false,
        error: 'invalid_bounds',
        segment,
        updatedEfforts: existingEfforts,
        requiresEffortRecomputation: false,
      };
    }
    const slice = activity.points.slice(startPointIndex, endPointIndex + 1);
    nextPoints = slice.map((p) => ({ lat: p.lat, lng: p.lng, ele: p.ele ?? null }));
    stats = computeSegmentGeometryStats(nextPoints);
    if (stats.lengthM < MIN_SEGMENT_LENGTH_M) {
      return {
        ok: false,
        error: 'segment_too_short',
        segment,
        updatedEfforts: existingEfforts,
        requiresEffortRecomputation: false,
      };
    }
    if (stats.lengthM > MAX_SEGMENT_LENGTH_M) {
      return {
        ok: false,
        error: 'segment_too_long',
        segment,
        updatedEfforts: existingEfforts,
        requiresEffortRecomputation: false,
      };
    }
    geometryChanged = true;
  }

  if (nextVisibility === 'public') {
    const zones = input.ownerHiddenZones ?? input.newBounds?.activity.hiddenZones ?? [];
    for (const pt of nextPoints) {
      if (isPointInPrivacyZones(pt, zones)) {
        return {
          ok: false,
          error: 'privacy_zone_conflict_for_public_segment',
          segment,
          updatedEfforts: existingEfforts,
          requiresEffortRecomputation: false,
        };
      }
    }
  }

  const requiresEffortRecomputation = geometryChanged || nextSport !== segment.sport;
  const nextVersion = requiresEffortRecomputation ? segment.version + 1 : segment.version;

  const updatedSegment: SegmentDefinition = {
    ...segment,
    version: nextVersion,
    name: nextName,
    sport: nextSport,
    surface: input.surface !== undefined ? input.surface : segment.surface,
    visibility: nextVisibility,
    points: nextPoints,
    startPoint: nextPoints[0],
    endPoint: nextPoints[nextPoints.length - 1],
    lengthM: stats.lengthM,
    elevationGainM: stats.elevationGainM,
    elevationLossM: stats.elevationLossM,
    meanGradePct: stats.meanGradePct,
    maxGradePct: stats.maxGradePct,
    updatedAt: nowIso,
  };

  const updatedEfforts = existingEfforts.map((eff) => {
    if (eff.segmentId !== segment.id) return eff;
    if (nextVisibility === 'private') {
      return {
        ...eff,
        visibility: 'private' as const,
        eligibleForPublicLeaderboard: false,
      };
    }
    return eff;
  });

  return {
    ok: true,
    segment: updatedSegment,
    updatedEfforts,
    requiresEffortRecomputation,
  };
}

/**
 * Raccourci explicite pour basculer la visibilité `public` / `private` d'un segment.
 */
export function setSegmentVisibility(params: {
  segment: SegmentDefinition;
  actorUserId: string;
  visibility: SegmentVisibility;
  ownerHiddenZones?: PrivacyZoneCircle[];
  existingEfforts?: SegmentEffort[];
  nowIso?: string;
}): UpdateSegmentResult {
  return updateSegment({
    segment: params.segment,
    actorUserId: params.actorUserId,
    visibility: params.visibility,
    ownerHiddenZones: params.ownerHiddenZones,
    existingEfforts: params.existingEfforts,
    nowIso: params.nowIso,
  });
}

/**
 * Supprime un segment (seul son créateur y est autorisé) et purge ses efforts.
 */
export function deleteSegment(params: {
  segment: SegmentDefinition;
  actorUserId: string;
  existingEfforts: SegmentEffort[];
  nowIso?: string;
}): {
  ok: boolean;
  error?: SegmentCrudValidationError;
  deletedSegment: SegmentDefinition;
  remainingEfforts: SegmentEffort[];
} {
  const { segment, actorUserId, existingEfforts } = params;
  const nowIso = params.nowIso ?? new Date().toISOString();

  if (actorUserId !== segment.createdByUserId) {
    return {
      ok: false,
      error: 'unauthorized_not_owner',
      deletedSegment: segment,
      remainingEfforts: existingEfforts,
    };
  }

  return {
    ok: true,
    deletedSegment: {
      ...segment,
      visibility: 'private',
      deletedAt: nowIso,
      updatedAt: nowIso,
    },
    remainingEfforts: existingEfforts.filter((e) => e.segmentId !== segment.id),
  };
}

/**
 * Machine d'état pure du drawer S4.02 (Trace de la sortie ou détail segment → ⋯ → créer / modifier)
 * avec restauration garantie du contexte parent.
 */
export interface SegmentCrudDrawerState {
  isOpen: boolean;
  mode: 'create' | 'edit' | null;
  targetSegmentId: string | null;
  sourceActivityId: string | null;
  draftName: string;
  draftVisibility: SegmentVisibility;
  draftStartPointIndex: number;
  draftEndPointIndex: number;
  parentContext: DrawerParentContext | null;
}

export function openSegmentCrudDrawer(params: {
  mode: 'create' | 'edit';
  parentContext: DrawerParentContext;
  sourceActivityId?: string;
  segment?: SegmentDefinition;
  initialStartPointIndex?: number;
  initialEndPointIndex?: number;
}): SegmentCrudDrawerState {
  return {
    isOpen: true,
    mode: params.mode,
    targetSegmentId: params.segment?.id ?? null,
    sourceActivityId: params.sourceActivityId ?? params.segment?.sourceActivityId ?? null,
    draftName: params.segment?.name ?? '',
    draftVisibility: params.segment?.visibility ?? 'public',
    draftStartPointIndex: params.initialStartPointIndex ?? 0,
    draftEndPointIndex: params.initialEndPointIndex ?? 1,
    parentContext: { ...params.parentContext },
  };
}

export function closeSegmentCrudDrawer(state: SegmentCrudDrawerState): {
  drawerState: SegmentCrudDrawerState;
  restoredParentContext: DrawerParentContext | null;
} {
  return {
    drawerState: {
      isOpen: false,
      mode: null,
      targetSegmentId: null,
      sourceActivityId: null,
      draftName: '',
      draftVisibility: 'public',
      draftStartPointIndex: 0,
      draftEndPointIndex: 0,
      parentContext: null,
    },
    restoredParentContext: state.parentContext ? { ...state.parentContext } : null,
  };
}
