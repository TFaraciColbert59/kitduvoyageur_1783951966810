/**
 * K2.29 — Choix automatique des étapes d'un long tracé.
 * K2.30 — Déplacer la fin d'une étape et ajuster la suivante (révisions N et N+1 atomiques).
 * K2.31 — Refuge et hébergement comme fin d'étape.
 */

import type {
  ContinuousRoute,
  GpxTrackPoint,
  LodgingAnchor,
  MultiDayPlan,
  SportKind,
  StageBoundaryPreview,
  StageImpactSummary,
  StageOfflineCapabilities,
  StageRevision,
} from './models';
import { assertValidTimeZone, getLocalDateAndHour } from './timezone';

const DEFAULT_SPEED_KMH: Record<SportKind, number> = {
  hiking: 3.8,
  trekking: 3.5,
  trail: 6.5,
  cycling: 18,
  gravel: 16,
  bikepacking: 14,
  mountaineering: 2.8,
};

const DEFAULT_OFFLINE_CAPABILITIES: StageOfflineCapabilities = {
  mapReady: false,
  traceReady: true,
  guidanceReady: true,
  searchReady: false,
  rerouteReady: false,
};

export function haversineKm(a: GpxTrackPoint, b: GpxTrackPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function computeCumulativeDistancesKm(points: GpxTrackPoint[]): number[] {
  if (points.length === 0) return [];
  const cum = [0];
  for (let i = 1; i < points.length; i += 1) {
    cum.push(cum[i - 1] + haversineKm(points[i - 1], points[i]));
  }
  return cum;
}

export function computeStageMetrics(
  points: GpxTrackPoint[],
  sport: SportKind,
): { distanceKm: number; elevationGainM: number; elevationLossM: number; estimatedHours: number } {
  let distanceKm = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;

  for (let i = 1; i < points.length; i += 1) {
    distanceKm += haversineKm(points[i - 1], points[i]);
    const prevEle = points[i - 1].eleM;
    const currEle = points[i].eleM;
    if (prevEle !== null && currEle !== null) {
      const delta = currEle - prevEle;
      if (delta > 0) elevationGainM += delta;
      else elevationLossM += Math.abs(delta);
    }
  }

  const speed = DEFAULT_SPEED_KMH[sport] ?? 4;
  // Naismith-like adjustment: +1h per 600m ascent
  const estimatedHours = Number((distanceKm / speed + elevationGainM / 600).toFixed(2));

  return {
    distanceKm: Number(distanceKm.toFixed(3)),
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    estimatedHours,
  };
}

function buildStageRevision(
  planId: string,
  dayNumber: number,
  revision: number,
  allPoints: GpxTrackPoint[],
  startPointIndex: number,
  endPointIndex: number,
  sport: SportKind,
  endLodging: LodgingAnchor | null,
  offline?: StageOfflineCapabilities,
): StageRevision {
  const slice = allPoints.slice(startPointIndex, endPointIndex + 1);
  const metrics = computeStageMetrics(slice, sport);
  return {
    stageId: `${planId}-day-${dayNumber}`,
    dayNumber,
    revision,
    startPointIndex,
    endPointIndex,
    startCoord: allPoints[startPointIndex],
    endCoord: allPoints[endPointIndex],
    distanceKm: metrics.distanceKm,
    elevationGainM: metrics.elevationGainM,
    elevationLossM: metrics.elevationLossM,
    estimatedHours: metrics.estimatedHours,
    endLodging,
    points: slice,
    offline: offline ? { ...offline } : { ...DEFAULT_OFFLINE_CAPABILITIES },
    standaloneLaunchable: slice.length >= 2,
  };
}

export interface SplitRouteOptions {
  planId: string;
  /** Nombre de jours cible (prioritaire si fourni). */
  targetDays?: number;
  /** Durée journalière cible en heures (utilisée si targetDays absent). */
  targetHoursPerDay?: number;
  nowIso: string;
  publicShareConsented?: boolean;
}

export function splitRouteIntoDays(
  route: ContinuousRoute,
  options: SplitRouteOptions,
): MultiDayPlan {
  const tz = assertValidTimeZone(route.timezone);
  if (route.points.length < 2) {
    throw new Error('ContinuousRoute must contain at least 2 points to split.');
  }
  if (Date.parse(options.nowIso) !== Date.parse(options.nowIso)) {
    throw new Error(`Invalid nowIso: "${options.nowIso}"`);
  }

  const cum = computeCumulativeDistancesKm(route.points);
  const totalDist = cum[cum.length - 1];
  const totalMetrics = computeStageMetrics(route.points, route.sport);

  let daysCount: number;
  if (options.targetDays !== undefined) {
    if (!Number.isInteger(options.targetDays) || options.targetDays < 1) {
      throw new Error(`targetDays must be a positive integer, got ${options.targetDays}`);
    }
    daysCount = Math.min(options.targetDays, route.points.length - 1);
  } else if (options.targetHoursPerDay !== undefined) {
    if (options.targetHoursPerDay <= 0) {
      throw new Error(`targetHoursPerDay must be > 0, got ${options.targetHoursPerDay}`);
    }
    daysCount = Math.max(
      1,
      Math.min(
        Math.ceil(totalMetrics.estimatedHours / options.targetHoursPerDay),
        route.points.length - 1,
      ),
    );
  } else {
    throw new Error('Either targetDays or targetHoursPerDay must be provided.');
  }

  const stages: StageRevision[] = [];
  let startIdx = 0;

  for (let day = 1; day <= daysCount; day += 1) {
    let endIdx: number;
    if (day === daysCount) {
      endIdx = route.points.length - 1;
    } else {
      const targetCumDist = (totalDist * day) / daysCount;
      // Chercher le point le plus proche de targetCumDist tout en laissant assez de points pour les jours restants
      const maxAllowedIdx = route.points.length - 1 - (daysCount - day);
      let bestIdx = startIdx + 1;
      let bestDiff = Math.abs(cum[bestIdx] - targetCumDist);
      for (let i = startIdx + 1; i <= maxAllowedIdx; i += 1) {
        const diff = Math.abs(cum[i] - targetCumDist);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      endIdx = bestIdx;
    }

    stages.push(
      buildStageRevision(
        options.planId,
        day,
        1,
        route.points,
        startIdx,
        endIdx,
        route.sport,
        null,
      ),
    );
    startIdx = endIdx;
  }

  return {
    id: options.planId,
    sourceRouteId: route.id,
    title: route.title,
    countryCode: route.countryCode,
    sport: route.sport,
    theme: route.theme,
    timezone: tz,
    daysCount: stages.length,
    revision: 1,
    ownerId: route.ownerId,
    audience: route.audience,
    publicShareConsented: Boolean(options.publicShareConsented),
    stages,
    createdAtIso: options.nowIso,
    updatedAtIso: options.nowIso,
  };
}

function reconstructFullPoints(plan: MultiDayPlan): GpxTrackPoint[] {
  const all: GpxTrackPoint[] = [];
  for (let i = 0; i < plan.stages.length; i += 1) {
    const stage = plan.stages[i];
    if (i === 0) {
      all.push(...stage.points);
    } else {
      // Éviter de dupliquer le point de jonction partagé entre stage N et N+1
      all.push(...stage.points.slice(1));
    }
  }
  return all;
}

function summarizeImpact(
  prev: StageRevision,
  next: StageRevision,
): StageImpactSummary {
  return {
    dayNumber: prev.dayNumber,
    previousDistanceKm: prev.distanceKm,
    nextDistanceKm: next.distanceKm,
    previousElevationGainM: prev.elevationGainM,
    nextElevationGainM: next.elevationGainM,
    previousStartCoord: prev.startCoord,
    nextStartCoord: next.startCoord,
    previousEndCoord: prev.endCoord,
    nextEndCoord: next.endCoord,
    previousRevision: prev.revision,
    nextRevision: next.revision,
  };
}

export function previewStageBoundaryMove(
  plan: MultiDayPlan,
  dayNumber: number,
  newEndPointIndex: number,
  expectedPlanRevision: number,
  lodging: LodgingAnchor | null = null,
): StageBoundaryPreview | null {
  const idx = plan.stages.findIndex((s) => s.dayNumber === dayNumber);
  if (idx < 0 || idx >= plan.stages.length - 1) {
    return null;
  }

  const stageN = plan.stages[idx];
  const stageNext = plan.stages[idx + 1];

  if (
    !Number.isInteger(newEndPointIndex) ||
    newEndPointIndex <= stageN.startPointIndex ||
    newEndPointIndex >= stageNext.endPointIndex
  ) {
    return null;
  }

  const allPoints = reconstructFullPoints(plan);
  const nextStageN = buildStageRevision(
    plan.id,
    stageN.dayNumber,
    stageN.revision + 1,
    allPoints,
    stageN.startPointIndex,
    newEndPointIndex,
    plan.sport,
    lodging,
    stageN.offline,
  );
  const nextStageNext = buildStageRevision(
    plan.id,
    stageNext.dayNumber,
    stageNext.revision + 1,
    allPoints,
    newEndPointIndex,
    stageNext.endPointIndex,
    plan.sport,
    stageNext.endLodging,
    stageNext.offline,
  );

  return {
    planId: plan.id,
    expectedPlanRevision,
    currentPlanRevision: plan.revision,
    revisionConflict: expectedPlanRevision !== plan.revision,
    dayN: summarizeImpact(stageN, nextStageN),
    dayNext: summarizeImpact(stageNext, nextStageNext),
    lodgingAnchor: lodging,
  };
}

export type BoundaryMoveResult =
  | { ok: true; plan: MultiDayPlan; preview: StageBoundaryPreview }
  | {
      ok: false;
      reason: 'revision_conflict' | 'invalid_day_or_index';
      preview: StageBoundaryPreview | null;
    };

export function commitStageBoundaryMove(
  plan: MultiDayPlan,
  dayNumber: number,
  newEndPointIndex: number,
  expectedPlanRevision: number,
  nowIso: string,
  lodging: LodgingAnchor | null = null,
): BoundaryMoveResult {
  const preview = previewStageBoundaryMove(
    plan,
    dayNumber,
    newEndPointIndex,
    expectedPlanRevision,
    lodging,
  );

  if (!preview) {
    return { ok: false, reason: 'invalid_day_or_index', preview: null };
  }
  if (preview.revisionConflict) {
    // En cas de conflit de révision, conserver l'ancien découpage et renvoyer la prévisualisation actualisée.
    return { ok: false, reason: 'revision_conflict', preview };
  }

  const allPoints = reconstructFullPoints(plan);
  const idx = plan.stages.findIndex((s) => s.dayNumber === dayNumber);
  const stageN = plan.stages[idx];
  const stageNext = plan.stages[idx + 1];

  const updatedN = buildStageRevision(
    plan.id,
    stageN.dayNumber,
    stageN.revision + 1,
    allPoints,
    stageN.startPointIndex,
    newEndPointIndex,
    plan.sport,
    lodging,
    stageN.offline,
  );
  const updatedNext = buildStageRevision(
    plan.id,
    stageNext.dayNumber,
    stageNext.revision + 1,
    allPoints,
    newEndPointIndex,
    stageNext.endPointIndex,
    plan.sport,
    stageNext.endLodging,
    stageNext.offline,
  );

  // Les journées indépendantes (< N et > N+1) restent strictement inchangées (même référence et même révision).
  const nextStages = plan.stages.map((s, i) => {
    if (i === idx) return updatedN;
    if (i === idx + 1) return updatedNext;
    return s;
  });

  return {
    ok: true,
    preview,
    plan: {
      ...plan,
      revision: plan.revision + 1,
      stages: nextStages,
      updatedAtIso: nowIso,
    },
  };
}

export interface AnchorLodgingOptions {
  expectedPlanRevision: number;
  nowIso: string;
  /** Distance maximale autorisée entre l'hébergement et le tracé (km). Défaut 2.5 km. */
  maxSnapDistanceKm?: number;
  /** Date ISO optionnelle du séjour pour vérifier l'ouverture saisonnière du refuge dans le fuseau du plan. */
  stayDateIso?: string | null;
}

export type AnchorLodgingResult =
  | { ok: true; plan: MultiDayPlan; snappedDistanceKm: number; preview: StageBoundaryPreview }
  | {
      ok: false;
      reason:
        | 'invalid_day'
        | 'lodging_too_far'
        | 'lodging_closed_season'
        | 'revision_conflict'
        | 'invalid_boundary';
      snappedDistanceKm?: number;
      preview?: StageBoundaryPreview | null;
    };

export function anchorStageToLodging(
  plan: MultiDayPlan,
  dayNumber: number,
  lodging: LodgingAnchor,
  options: AnchorLodgingOptions,
): AnchorLodgingResult {
  const idx = plan.stages.findIndex((s) => s.dayNumber === dayNumber);
  if (idx < 0 || idx >= plan.stages.length - 1) {
    return { ok: false, reason: 'invalid_day' };
  }

  if (options.stayDateIso && lodging.openMonths && lodging.openMonths.length > 0) {
    const local = getLocalDateAndHour(options.stayDateIso, plan.timezone);
    if (!lodging.openMonths.includes(local.month)) {
      return { ok: false, reason: 'lodging_closed_season' };
    }
  }

  const stageN = plan.stages[idx];
  const stageNext = plan.stages[idx + 1];
  const allPoints = reconstructFullPoints(plan);

  let bestIndex = -1;
  let bestDistKm = Number.POSITIVE_INFINITY;
  const lodgingCoord: GpxTrackPoint = {
    lat: lodging.lat,
    lon: lodging.lon,
    eleM: lodging.eleM,
  };

  for (let i = stageN.startPointIndex + 1; i < stageNext.endPointIndex; i += 1) {
    const d = haversineKm(allPoints[i], lodgingCoord);
    if (d < bestDistKm) {
      bestDistKm = d;
      bestIndex = i;
    }
  }

  const maxSnapKm = options.maxSnapDistanceKm ?? 2.5;
  if (bestIndex < 0) {
    return { ok: false, reason: 'invalid_boundary' };
  }
  const roundedDist = Number(bestDistKm.toFixed(3));
  if (bestDistKm > maxSnapKm) {
    return { ok: false, reason: 'lodging_too_far', snappedDistanceKm: roundedDist };
  }

  const committed = commitStageBoundaryMove(
    plan,
    dayNumber,
    bestIndex,
    options.expectedPlanRevision,
    options.nowIso,
    lodging,
  );

  if (!committed.ok) {
    return {
      ok: false,
      reason: committed.reason === 'revision_conflict' ? 'revision_conflict' : 'invalid_boundary',
      snappedDistanceKm: roundedDist,
      preview: committed.preview,
    };
  }

  return {
    ok: true,
    plan: committed.plan,
    snappedDistanceKm: roundedDist,
    preview: committed.preview,
  };
}
