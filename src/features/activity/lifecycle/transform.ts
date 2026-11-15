/**
 * Lot A02 — Transformations géométriques et corrections réversibles
 * (K5.07, K5.10, S1.22, S1.23).
 *
 * Invariants :
 * - `originalPoints` n'est jamais écrasé par un recadrage, un fractionnement,
 *   un lissage de pic ou une correction D+/distance.
 * - Toute transformation crée une entrée `LifecycleRevision` contenant
 *   `snapshotBefore` et émet un unique `ProjectionRecalculationEvent`.
 * - Les opérations avec `operationId` sont idempotentes aux rejeux réseau/UI.
 */

import {
  applyElevationThresholdSmoothing,
  clonePoints,
  computeActivityStats,
  parseTimestampMs,
  pointDistanceM,
  smoothGpsSpeedSpikes,
} from './metrics';
import type {
  CropActivityOutcome,
  CropBounds,
  CropPreviewResult,
  CropRejectionCode,
  DistanceElevationCorrectionInput,
  DistanceElevationCorrectionOutcome,
  LifecycleActivityRecord,
  LifecyclePoint,
  LifecycleRevision,
  ProjectionRecalculationEvent,
  SplitActivityOutcome,
  SplitActivitySpec,
  SplitRejectionCode,
} from './types';

function cumulativeDistancesM(points: readonly LifecyclePoint[]): number[] {
  const distances: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += pointDistanceM(points[i - 1], points[i]);
    distances.push(total);
  }
  return distances;
}

function buildProjectionEvent(
  record: LifecycleActivityRecord,
  nextStats: LifecycleActivityRecord['stats'],
  kind: ProjectionRecalculationEvent['kind'],
  invalidatedRecords: boolean,
  invalidatedReason: string | null,
  nowIso: string,
  previousSport = record.sport,
): ProjectionRecalculationEvent {
  return {
    eventId: `proj_${record.id}_r${record.revision}_${Date.parse(nowIso) || 0}`,
    activityId: record.id,
    userId: record.userId,
    revision: record.revision,
    kind,
    previousSport,
    currentSport: record.sport,
    invalidatedRecords,
    invalidatedReason,
    deltaDistanceM: Math.round((nextStats.distanceM - record.stats.distanceM) * 10) / 10,
    deltaElevationGainM: nextStats.elevationGainM - record.stats.elevationGainM,
    deltaMovingTimeS: nextStats.movingTimeS - record.stats.movingTimeS,
    createdAt: nowIso,
  };
}

/**
 * Résout les bornes de recadrage (`startIndex` et `endIndex` inclusifs) à partir
 * d'indices, d'horodatages ISO, d'offsets temporels ou de distances cumulées.
 */
function resolveCropIndices(
  points: readonly LifecyclePoint[],
  bounds: CropBounds,
): { ok: true; startIndex: number; endIndex: number } | { ok: false; code: CropRejectionCode; error: string } {
  if (points.length < 2) {
    return {
      ok: false,
      code: 'empty_trace',
      error: 'La trace doit contenir au moins 2 points pour être recadrée.',
    };
  }

  let startIndex = 0;
  let endIndex = points.length - 1;

  const hasAnyBound =
    bounds.startIndex !== undefined ||
    bounds.endIndex !== undefined ||
    bounds.startTimeIso !== undefined ||
    bounds.endTimeIso !== undefined ||
    bounds.startOffsetS !== undefined ||
    bounds.endOffsetS !== undefined ||
    bounds.startDistanceM !== undefined ||
    bounds.endDistanceM !== undefined;

  if (!hasAnyBound) {
    return {
      ok: false,
      code: 'invalid_bounds',
      error: 'Aucune borne de recadrage fournie.',
    };
  }

  if (bounds.startIndex !== undefined) {
    if (!Number.isInteger(bounds.startIndex) || bounds.startIndex < 0 || bounds.startIndex >= points.length) {
      return { ok: false, code: 'invalid_bounds', error: 'startIndex hors limites.' };
    }
    startIndex = Math.max(startIndex, bounds.startIndex);
  }

  if (bounds.endIndex !== undefined) {
    if (!Number.isInteger(bounds.endIndex) || bounds.endIndex < 0 || bounds.endIndex >= points.length) {
      return { ok: false, code: 'invalid_bounds', error: 'endIndex hors limites.' };
    }
    endIndex = Math.min(endIndex, bounds.endIndex);
  }

  const firstTMs = parseTimestampMs(points[0].timestamp);

  if (bounds.startOffsetS !== undefined) {
    if (!Number.isFinite(bounds.startOffsetS) || bounds.startOffsetS < 0 || firstTMs === null) {
      return { ok: false, code: 'invalid_bounds', error: 'startOffsetS invalide ou trace non horodatée.' };
    }
    const targetMs = firstTMs + bounds.startOffsetS * 1000;
    const idx = points.findIndex((pt) => {
      const t = parseTimestampMs(pt.timestamp);
      return t !== null && t >= targetMs;
    });
    if (idx === -1) {
      return { ok: false, code: 'invalid_bounds', error: 'startOffsetS dépasse la fin de la séance.' };
    }
    startIndex = Math.max(startIndex, idx);
  }

  if (bounds.endOffsetS !== undefined) {
    if (!Number.isFinite(bounds.endOffsetS) || bounds.endOffsetS <= 0 || firstTMs === null) {
      return { ok: false, code: 'invalid_bounds', error: 'endOffsetS invalide ou trace non horodatée.' };
    }
    const targetMs = firstTMs + bounds.endOffsetS * 1000;
    let idx = -1;
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const t = parseTimestampMs(points[i].timestamp);
      if (t !== null && t <= targetMs) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      return { ok: false, code: 'invalid_bounds', error: 'endOffsetS précède le début de la séance.' };
    }
    endIndex = Math.min(endIndex, idx);
  }

  if (bounds.startTimeIso !== undefined) {
    const targetMs = parseTimestampMs(bounds.startTimeIso);
    if (targetMs === null) {
      return { ok: false, code: 'invalid_bounds', error: 'startTimeIso invalide.' };
    }
    const idx = points.findIndex((pt) => {
      const t = parseTimestampMs(pt.timestamp);
      return t !== null && t >= targetMs;
    });
    if (idx === -1) {
      return { ok: false, code: 'invalid_bounds', error: 'startTimeIso hors de la plage de la séance.' };
    }
    startIndex = Math.max(startIndex, idx);
  }

  if (bounds.endTimeIso !== undefined) {
    const targetMs = parseTimestampMs(bounds.endTimeIso);
    if (targetMs === null) {
      return { ok: false, code: 'invalid_bounds', error: 'endTimeIso invalide.' };
    }
    let idx = -1;
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const t = parseTimestampMs(points[i].timestamp);
      if (t !== null && t <= targetMs) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      return { ok: false, code: 'invalid_bounds', error: 'endTimeIso hors de la plage de la séance.' };
    }
    endIndex = Math.min(endIndex, idx);
  }

  if (bounds.startDistanceM !== undefined || bounds.endDistanceM !== undefined) {
    const cumDist = cumulativeDistancesM(points);
    const totalDist = cumDist[cumDist.length - 1] ?? 0;

    if (bounds.startDistanceM !== undefined) {
      if (
        !Number.isFinite(bounds.startDistanceM) ||
        bounds.startDistanceM < 0 ||
        bounds.startDistanceM >= totalDist
      ) {
        return { ok: false, code: 'invalid_bounds', error: 'startDistanceM hors limites.' };
      }
      const idx = cumDist.findIndex((d) => d >= bounds.startDistanceM! - 1e-6);
      if (idx === -1) {
        return { ok: false, code: 'invalid_bounds', error: 'startDistanceM introuvable.' };
      }
      startIndex = Math.max(startIndex, idx);
    }

    if (bounds.endDistanceM !== undefined) {
      if (
        !Number.isFinite(bounds.endDistanceM) ||
        bounds.endDistanceM <= 0 ||
        bounds.endDistanceM > totalDist + 1
      ) {
        return { ok: false, code: 'invalid_bounds', error: 'endDistanceM hors limites.' };
      }
      let idx = -1;
      for (let i = cumDist.length - 1; i >= 0; i -= 1) {
        if (cumDist[i] <= bounds.endDistanceM! + 1e-6) {
          idx = i;
          break;
        }
      }
      if (idx === -1) {
        return { ok: false, code: 'invalid_bounds', error: 'endDistanceM introuvable.' };
      }
      endIndex = Math.min(endIndex, idx);
    }
  }

  if (startIndex >= endIndex) {
    return {
      ok: false,
      code: 'too_few_points_remaining',
      error: 'Le recadrage laisse moins de 2 points valides.',
    };
  }

  return { ok: true, startIndex, endIndex };
}

/**
 * Aperçu sans écriture d'un recadrage de trace (K5.07, S1.22).
 * Permet d'afficher la trace coupée et les statistiques recalculées dans le
 * sous-drawer avant validation.
 */
export function previewCropActivityTrace(
  record: LifecycleActivityRecord,
  bounds: CropBounds,
): { ok: true; preview: CropPreviewResult } | { ok: false; code: CropRejectionCode; error: string } {
  if (record.lifecycleStatus === 'deleted') {
    return { ok: false, code: 'activity_deleted', error: 'Activité supprimée.' };
  }

  const resolved = resolveCropIndices(record.points, bounds);
  if (resolved.ok === false) {
    return { ok: false, code: resolved.code, error: resolved.error };
  }

  const { startIndex, endIndex } = resolved;
  const croppedPoints = clonePoints(record.points.slice(startIndex, endIndex + 1));
  // Le premier point de la trace recadrée est la nouvelle borne de départ
  if (croppedPoints.length > 0 && croppedPoints[0].discontinuity) {
    croppedPoints[0] = { ...croppedPoints[0], discontinuity: false };
  }

  const afterStats = computeActivityStats(croppedPoints, record.sport, {
    startedAt: croppedPoints[0]?.timestamp ?? record.startedAt,
    endedAt: croppedPoints[croppedPoints.length - 1]?.timestamp ?? record.endedAt,
  });

  const removedStartPoints = startIndex;
  const removedEndPoints = record.points.length - 1 - endIndex;
  const trimmedDistanceM = Math.max(
    0,
    Math.round((record.stats.distanceM - afterStats.distanceM) * 10) / 10,
  );
  const trimmedDurationS = Math.max(0, record.stats.elapsedTimeS - afterStats.elapsedTimeS);

  return {
    ok: true,
    preview: {
      ok: true,
      resolvedStartIndex: startIndex,
      resolvedEndIndex: endIndex,
      croppedPoints,
      removedStartPoints,
      removedEndPoints,
      beforeStats: record.stats,
      afterStats,
      trimmedDistanceM,
      trimmedDurationS,
      invalidatesRecords: removedStartPoints > 0 || removedEndPoints > 0,
    },
  };
}

/**
 * Applique un recadrage (crop) sur une activité enregistrée (K5.07, S1.22).
 * - Conserve `originalPoints` intact ;
 * - Idempotent si `bounds.operationId` a déjà été appliqué ;
 * - Recalcule déterministiquement `elapsedTimeS`, `movingTimeS`, `distanceM`,
 *   `elevationGainM`, `elevationLossM` et les splits ;
 * - Retire l'éligibilité aux anciens records devenus caducs sur la portion coupée.
 */
export function cropActivityTrace(
  record: LifecycleActivityRecord,
  bounds: CropBounds,
  nowIso = new Date().toISOString(),
): CropActivityOutcome {
  if (record.lifecycleStatus === 'deleted') {
    return { ok: false, code: 'activity_deleted', error: 'Activité supprimée.' };
  }

  if (
    bounds.operationId &&
    record.revisions.some(
      (rev) => rev.kind === 'crop' && rev.operationId === bounds.operationId,
    )
  ) {
    const noopPreview: CropPreviewResult = {
      ok: true,
      resolvedStartIndex: 0,
      resolvedEndIndex: Math.max(0, record.points.length - 1),
      croppedPoints: clonePoints(record.points),
      removedStartPoints: 0,
      removedEndPoints: 0,
      beforeStats: record.stats,
      afterStats: record.stats,
      trimmedDistanceM: 0,
      trimmedDurationS: 0,
      invalidatesRecords: record.recordsEligibility.invalidatedRecords,
    };
    const fallbackEvent =
      record.lastProjectionEvent ??
      buildProjectionEvent(record, record.stats, 'recalculate_totals', false, null, nowIso);
    return {
      ok: true,
      idempotentReplay: true,
      record,
      preview: noopPreview,
      projectionEvent: fallbackEvent,
    };
  }

  const previewOutcome = previewCropActivityTrace(record, bounds);
  if (previewOutcome.ok === false) {
    return { ok: false, code: previewOutcome.code, error: previewOutcome.error };
  }
  const { preview } = previewOutcome;

  const nextRevisionNumber = record.revision + 1;
  const revisionEntry: LifecycleRevision = {
    revision: nextRevisionNumber,
    kind: 'crop',
    operationId: bounds.operationId ?? null,
    createdAt: nowIso,
    summary: `Recadrage [${preview.resolvedStartIndex}..${preview.resolvedEndIndex}] (-${preview.trimmedDistanceM} m)`,
    snapshotBefore: {
      points: clonePoints(record.points),
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      sport: record.sport,
      variantId: record.variantId,
      stats: record.stats,
    },
  };

  const nextStartedAt = preview.croppedPoints[0]?.timestamp ?? record.startedAt;
  const nextEndedAt =
    preview.croppedPoints[preview.croppedPoints.length - 1]?.timestamp ?? record.endedAt;

  const reasons = [...record.recordsEligibility.reasons];
  if (preview.invalidatesRecords && !reasons.includes('cropped_trace')) {
    reasons.push('cropped_trace');
  }

  const updatedBase: LifecycleActivityRecord = {
    ...record,
    revision: nextRevisionNumber,
    startedAt: nextStartedAt,
    endedAt: nextEndedAt,
    points: preview.croppedPoints,
    // Invariant A02 : originalPoints reste la géométrie brute initiale
    originalPoints: clonePoints(record.originalPoints),
    stats: preview.afterStats,
    correctionState: {
      distanceMethod: 'recompute_from_trace',
      elevationMethod: 'raw',
      appliedAt: nowIso,
      previousSnapshot: record.correctionState.previousSnapshot,
    },
    recordsEligibility: {
      eligible: true,
      invalidatedRecords:
        record.recordsEligibility.invalidatedRecords || preview.invalidatesRecords,
      reasons,
    },
    revisions: [...record.revisions, revisionEntry],
    lastProjectionEvent: null,
  };

  const projectionEvent = buildProjectionEvent(
    { ...record, revision: nextRevisionNumber },
    preview.afterStats,
    'recalculate_totals',
    preview.invalidatesRecords,
    preview.invalidatesRecords ? 'cropped_trace' : null,
    nowIso,
  );

  const finalRecord: LifecycleActivityRecord = {
    ...updatedBase,
    lastProjectionEvent: projectionEvent,
  };

  return {
    ok: true,
    idempotentReplay: false,
    record: finalRecord,
    preview,
    projectionEvent,
  };
}

/**
 * Résout les indices de scission (split) ordonnés et dédupliqués (S1.22).
 */
function resolveSplitIndices(
  points: readonly LifecyclePoint[],
  spec: SplitActivitySpec,
): { ok: true; indices: number[] } | { ok: false; code: SplitRejectionCode; error: string } {
  if (points.length < 3) {
    return {
      ok: false,
      code: 'empty_trace',
      error: 'La trace doit contenir au moins 3 points pour être fractionnée.',
    };
  }

  const rawIndices: number[] = [];

  if (Array.isArray(spec.splitIndices) && spec.splitIndices.length > 0) {
    for (const idx of spec.splitIndices) {
      if (!Number.isInteger(idx) || idx <= 0 || idx >= points.length - 1) {
        return {
          ok: false,
          code: 'invalid_split_point',
          error: `Indice de coupure ${String(idx)} hors des bornes intérieures [1..${points.length - 2}].`,
        };
      }
      rawIndices.push(idx);
    }
  } else if (Array.isArray(spec.splitTimestampsIso) && spec.splitTimestampsIso.length > 0) {
    for (const iso of spec.splitTimestampsIso) {
      const targetMs = parseTimestampMs(iso);
      if (targetMs === null) {
        return { ok: false, code: 'invalid_split_point', error: 'Horodatage de coupure invalide.' };
      }
      const idx = points.findIndex((pt) => {
        const t = parseTimestampMs(pt.timestamp);
        return t !== null && t >= targetMs;
      });
      if (idx <= 0 || idx >= points.length - 1) {
        return {
          ok: false,
          code: 'invalid_split_point',
          error: 'Horodatage de coupure hors de la plage intérieure de la séance.',
        };
      }
      rawIndices.push(idx);
    }
  } else if (Array.isArray(spec.splitDistancesM) && spec.splitDistancesM.length > 0) {
    const cumDist = cumulativeDistancesM(points);
    const totalDist = cumDist[cumDist.length - 1] ?? 0;
    for (const dM of spec.splitDistancesM) {
      if (!Number.isFinite(dM) || dM <= 0 || dM >= totalDist) {
        return {
          ok: false,
          code: 'invalid_split_point',
          error: 'Distance de coupure hors de la longueur de la trace.',
        };
      }
      const idx = cumDist.findIndex((d) => d >= dM);
      if (idx <= 0 || idx >= points.length - 1) {
        return {
          ok: false,
          code: 'invalid_split_point',
          error: 'La distance de coupure tombe sur une extrémité de la trace.',
        };
      }
      rawIndices.push(idx);
    }
  } else {
    return {
      ok: false,
      code: 'invalid_split_point',
      error: 'Aucun point de fractionnement fourni.',
    };
  }

  const sorted = Array.from(new Set(rawIndices)).sort((a, b) => a - b);
  let prevIdx = 0;
  for (const splitIdx of [...sorted, points.length - 1]) {
    if (splitIdx - prevIdx < 1) {
      return {
        ok: false,
        code: 'part_too_short',
        error: 'Chaque tronçon fractionné doit comporter au moins 2 points.',
      };
    }
    prevIdx = splitIdx;
  }

  return { ok: true, indices: sorted };
}

/**
 * Fractionne (split) une activité en plusieurs séances indépendantes tout en
 * conservant la filiation (`parentActivityId`, `parentRevision`, `originalPoints`) (S1.22).
 */
export function splitActivityTrace(
  record: LifecycleActivityRecord,
  spec: SplitActivitySpec,
  nowIso = new Date().toISOString(),
): SplitActivityOutcome {
  if (record.lifecycleStatus === 'deleted') {
    return { ok: false, code: 'activity_deleted', error: 'Activité supprimée.' };
  }

  const matchedRevision = spec.operationId
    ? record.revisions.find(
        (rev) => rev.kind === 'split' && rev.operationId === spec.operationId,
      )
    : undefined;
  const alreadyApplied = Boolean(matchedRevision);
  const sourcePoints =
    alreadyApplied && matchedRevision?.snapshotBefore
      ? matchedRevision.snapshotBefore.points
      : record.points;

  const resolved = resolveSplitIndices(sourcePoints, spec);
  if (resolved.ok === false) {
    return { ok: false, code: resolved.code, error: resolved.error };
  }

  const boundaries = [0, ...resolved.indices, sourcePoints.length - 1];
  const parts: LifecycleActivityRecord[] = [];

  for (let partIdx = 0; partIdx < boundaries.length - 1; partIdx += 1) {
    const segStart = boundaries[partIdx];
    const segEnd = boundaries[partIdx + 1];
    const partPoints = clonePoints(sourcePoints.slice(segStart, segEnd + 1));
    if (partPoints.length > 0 && partPoints[0].discontinuity) {
      partPoints[0] = { ...partPoints[0], discontinuity: false };
    }

    const partStartedAt = partPoints[0]?.timestamp ?? record.startedAt;
    const partEndedAt = partPoints[partPoints.length - 1]?.timestamp ?? record.endedAt;
    const partStats = computeActivityStats(partPoints, record.sport, {
      startedAt: partStartedAt,
      endedAt: partEndedAt,
    });

    const partNumber = partIdx + 1;
    const customTitle = spec.partTitles?.[partIdx]?.trim();
    const partTitle =
      customTitle && customTitle.length > 0
        ? customTitle.slice(0, 120)
        : `${record.title} (${partNumber}/${boundaries.length - 1})`.slice(0, 120);

    const partId = `${record.id}__part_${partNumber}`;

    parts.push({
      ...record,
      id: partId,
      revision: 1,
      title: partTitle,
      startedAt: partStartedAt,
      endedAt: partEndedAt,
      parentActivityId: record.id,
      parentRevision: record.revision,
      splitPartIndex: partNumber,
      points: partPoints,
      // Conservation de la trace source de ce segment et filiation vers le parent
      originalPoints: clonePoints(partPoints),
      stats: partStats,
      correctionState: {
        distanceMethod: 'raw',
        elevationMethod: 'raw',
        appliedAt: null,
        previousSnapshot: null,
      },
      recordsEligibility: {
        eligible: true,
        invalidatedRecords: false,
        reasons: ['split_child_recalculated'],
      },
      revisions: [
        {
          revision: 1,
          kind: 'split',
          operationId: spec.operationId ?? null,
          createdAt: nowIso,
          summary: `Tronçon ${partNumber}/${boundaries.length - 1} issu de ${record.id} (rév. ${record.revision})`,
        },
      ],
      lastProjectionEvent: null,
    });
  }

  if (alreadyApplied) {
    const existingEvent =
      record.lastProjectionEvent ??
      buildProjectionEvent(
        record,
        parts[0].stats,
        'split_replace_projections',
        true,
        'split_into_parts',
        nowIso,
      );
    return {
      ok: true,
      idempotentReplay: true,
      parentRecord: record,
      parts,
      projectionEvent: existingEvent,
    };
  }

  const nextRevision = record.revision + 1;
  const parentRevisionEntry: LifecycleRevision = {
    revision: nextRevision,
    kind: 'split',
    operationId: spec.operationId ?? null,
    createdAt: nowIso,
    summary: `Fractionnement en ${parts.length} parties aux indices [${resolved.indices.join(', ')}]`,
    snapshotBefore: {
      points: clonePoints(record.points),
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      sport: record.sport,
      variantId: record.variantId,
      stats: record.stats,
    },
  };

  // Le parent devient le premier tronçon (préserve l'ID historique comme requis par S1.22)
  // ou conserve sa filiation tout en exposant toutes les parts générées.
  const firstPart = parts[0];
  const updatedParent: LifecycleActivityRecord = {
    ...record,
    revision: nextRevision,
    title: firstPart.title,
    startedAt: firstPart.startedAt,
    endedAt: firstPart.endedAt,
    points: clonePoints(firstPart.points),
    originalPoints: clonePoints(record.originalPoints),
    stats: firstPart.stats,
    recordsEligibility: {
      eligible: true,
      invalidatedRecords: true,
      reasons: Array.from(
        new Set([...record.recordsEligibility.reasons, 'split_into_parts']),
      ),
    },
    revisions: [...record.revisions, parentRevisionEntry],
    lastProjectionEvent: null,
  };

  const projectionEvent = buildProjectionEvent(
    updatedParent,
    firstPart.stats,
    'split_replace_projections',
    true,
    'split_into_parts',
    nowIso,
  );

  updatedParent.lastProjectionEvent = projectionEvent;

  return {
    ok: true,
    idempotentReplay: false,
    parentRecord: updatedParent,
    parts,
    projectionEvent,
  };
}

/**
 * Applique une correction versionnée des pics GPS sur la trace active tout en
 * gardant `originalPoints` privé et intact (K5.10).
 */
export function applyVersionedGpsSpikeCorrection(
  record: LifecycleActivityRecord,
  options: { operationId?: string; maxPlausibleSpeedMs?: number; nowIso?: string } = {},
): LifecycleActivityRecord {
  const nowIso = options.nowIso ?? new Date().toISOString();
  if (
    options.operationId &&
    record.revisions.some(
      (rev) =>
        rev.kind === 'gps_spike_smoothing' && rev.operationId === options.operationId,
    )
  ) {
    return record;
  }

  const smoothed = smoothGpsSpeedSpikes(record.points, record.sport, {
    maxPlausibleSpeedMs: options.maxPlausibleSpeedMs,
  });

  if (smoothed.spikes.length === 0) {
    return record;
  }

  const nextRevision = record.revision + 1;
  const nextStats = computeActivityStats(smoothed.cleanedPoints, record.sport, {
    startedAt: record.startedAt,
    endedAt: record.endedAt,
  });

  const revisionEntry: LifecycleRevision = {
    revision: nextRevision,
    kind: 'gps_spike_smoothing',
    operationId: options.operationId ?? null,
    createdAt: nowIso,
    summary: `Suppression de ${smoothed.spikes.length} pic(s) GPS de vitesse`,
    snapshotBefore: {
      points: clonePoints(record.points),
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      sport: record.sport,
      variantId: record.variantId,
      stats: record.stats,
    },
  };

  const projectionEvent = buildProjectionEvent(
    { ...record, revision: nextRevision },
    nextStats,
    'recalculate_totals',
    true,
    'gps_spike_removed',
    nowIso,
  );

  return {
    ...record,
    revision: nextRevision,
    points: smoothed.cleanedPoints,
    originalPoints: clonePoints(record.originalPoints),
    stats: nextStats,
    recordsEligibility: {
      eligible: true,
      invalidatedRecords: true,
      reasons: Array.from(
        new Set([...record.recordsEligibility.reasons, 'gps_spike_removed']),
      ),
    },
    revisions: [...record.revisions, revisionEntry],
    lastProjectionEvent: projectionEvent,
  };
}

/**
 * Corrige la distance et/ou le dénivelé après enregistrement avec méthode
 * explicite et sauvegarde pour annulation (S1.23).
 */
export function correctDistanceAndElevation(
  record: LifecycleActivityRecord,
  input: DistanceElevationCorrectionInput,
  nowIso = new Date().toISOString(),
): DistanceElevationCorrectionOutcome {
  if (record.lifecycleStatus === 'deleted') {
    return { ok: false, code: 'activity_deleted', error: 'Activité supprimée.' };
  }

  if (
    input.operationId &&
    record.revisions.some(
      (rev) =>
        rev.kind === 'distance_elevation_correction' &&
        rev.operationId === input.operationId,
    )
  ) {
    const existingEvent =
      record.lastProjectionEvent ??
      buildProjectionEvent(record, record.stats, 'recalculate_totals', false, null, nowIso);
    return { ok: true, record, projectionEvent: existingEvent };
  }

  const nextDistanceMethod = input.distanceMethod ?? record.correctionState.distanceMethod;
  const nextElevationMethod = input.elevationMethod ?? record.correctionState.elevationMethod;

  if (!input.distanceMethod && !input.elevationMethod) {
    return {
      ok: false,
      code: 'nothing_to_correct',
      error: 'Aucune méthode de correction de distance ou de dénivelé fournie.',
    };
  }

  let nextPoints = clonePoints(record.points);
  let overrideDistanceM: number | null = null;
  let overrideElevationGainM: number | null = null;
  let overrideElevationLossM: number | null = null;

  // Validation et application de la correction de distance
  if (input.distanceMethod === 'manual_override') {
    if (
      typeof input.manualDistanceM !== 'number' ||
      !Number.isFinite(input.manualDistanceM) ||
      input.manualDistanceM <= 0
    ) {
      return {
        ok: false,
        code: 'invalid_distance',
        error: 'Une distance manuelle strictement positive (en mètres) est requise.',
      };
    }
    overrideDistanceM = input.manualDistanceM;
  } else if (!input.distanceMethod && record.correctionState.distanceMethod === 'manual_override') {
    overrideDistanceM = record.stats.distanceM;
  }

  // Validation et application de la correction de dénivelé
  if (input.elevationMethod === 'dem_projection') {
    if (
      !Array.isArray(input.demElevationsM) ||
      input.demElevationsM.length !== nextPoints.length
    ) {
      return {
        ok: false,
        code: 'missing_dem_samples',
        error: 'Les altitudes DEM doivent correspondre au nombre de points de la trace.',
      };
    }
    const validDemCount = input.demElevationsM.filter(
      (ele): ele is number => typeof ele === 'number' && Number.isFinite(ele),
    ).length;
    if (validDemCount < 2) {
      return {
        ok: false,
        code: 'missing_dem_samples',
        error: 'Le profil DEM doit fournir au moins 2 altitudes valides.',
      };
    }
    nextPoints = nextPoints.map((pt, idx) => {
      const demEle = input.demElevationsM![idx];
      return {
        ...pt,
        // Un trou DEM reste null, jamais une altitude inventée
        elevationM:
          typeof demEle === 'number' && Number.isFinite(demEle)
            ? Math.round(demEle * 10) / 10
            : null,
      };
    });
  } else if (input.elevationMethod === 'threshold_smoothing') {
    nextPoints = applyElevationThresholdSmoothing(
      nextPoints,
      input.smoothingThresholdM ?? 2,
    );
  } else if (input.elevationMethod === 'manual_override') {
    if (
      typeof input.manualElevationGainM !== 'number' ||
      !Number.isFinite(input.manualElevationGainM) ||
      input.manualElevationGainM < 0
    ) {
      return {
        ok: false,
        code: 'invalid_elevation',
        error: 'Un dénivelé positif manuel valide (>= 0 m) est requis.',
      };
    }
    overrideElevationGainM = input.manualElevationGainM;
    if (input.manualElevationLossM !== undefined) {
      if (
        typeof input.manualElevationLossM !== 'number' ||
        !Number.isFinite(input.manualElevationLossM) ||
        input.manualElevationLossM < 0
      ) {
        return {
          ok: false,
          code: 'invalid_elevation',
          error: 'Le dénivelé négatif manuel doit être >= 0 m.',
        };
      }
      overrideElevationLossM = input.manualElevationLossM;
    }
  } else if (
    !input.elevationMethod &&
    record.correctionState.elevationMethod === 'manual_override'
  ) {
    overrideElevationGainM = record.stats.elevationGainM;
    overrideElevationLossM = record.stats.elevationLossM;
  }

  const nextStats = computeActivityStats(nextPoints, record.sport, {
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    fallbackDurationS: record.stats.elapsedTimeS,
    overrideDistanceM,
    overrideElevationGainM,
    overrideElevationLossM,
    fallbackMaxAltitudeM: record.stats.maxAltitudeM,
  });

  // On conserve le premier snapshot avant correction si plusieurs corrections s'enchaînent,
  // ou le snapshot courant pour permettre l'annulation vers l'état non corrigé.
  const previousSnapshot = record.correctionState.previousSnapshot ?? {
    points: clonePoints(record.points),
    distanceM: record.stats.distanceM,
    elevationGainM: record.stats.elevationGainM,
    elevationLossM: record.stats.elevationLossM,
    minAltitudeM: record.stats.minAltitudeM,
    maxAltitudeM: record.stats.maxAltitudeM,
    distanceMethod: record.correctionState.distanceMethod,
    elevationMethod: record.correctionState.elevationMethod,
  };

  const nextRevision = record.revision + 1;
  const isManualOverride =
    nextDistanceMethod === 'manual_override' || nextElevationMethod === 'manual_override';
  const invalidatedRecords =
    isManualOverride ||
    nextStats.distanceM < record.stats.distanceM ||
    nextStats.elevationGainM < record.stats.elevationGainM;

  const reasons = [...record.recordsEligibility.reasons];
  if (isManualOverride && !reasons.includes('manual_metric_override')) {
    reasons.push('manual_metric_override');
  } else if (invalidatedRecords && !reasons.includes('distance_or_elevation_corrected')) {
    reasons.push('distance_or_elevation_corrected');
  }

  const revisionEntry: LifecycleRevision = {
    revision: nextRevision,
    kind: 'distance_elevation_correction',
    operationId: input.operationId ?? null,
    createdAt: nowIso,
    summary: `Correction distance (${nextDistanceMethod}) / dénivelé (${nextElevationMethod})`,
    snapshotBefore: {
      points: clonePoints(record.points),
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      sport: record.sport,
      variantId: record.variantId,
      stats: record.stats,
    },
  };

  const projectionEvent = buildProjectionEvent(
    { ...record, revision: nextRevision },
    nextStats,
    'recalculate_totals',
    invalidatedRecords,
    invalidatedRecords ? (isManualOverride ? 'manual_metric_override' : 'metric_corrected') : null,
    nowIso,
  );

  const updatedRecord: LifecycleActivityRecord = {
    ...record,
    revision: nextRevision,
    points: nextPoints,
    originalPoints: clonePoints(record.originalPoints),
    stats: nextStats,
    correctionState: {
      distanceMethod: nextDistanceMethod,
      elevationMethod: nextElevationMethod,
      appliedAt: nowIso,
      previousSnapshot,
    },
    recordsEligibility: {
      // Une surcharge manuelle de distance/D+ retire l'éligibilité aux classements automatiques GPS
      eligible: !isManualOverride,
      invalidatedRecords:
        record.recordsEligibility.invalidatedRecords || invalidatedRecords,
      reasons,
    },
    revisions: [...record.revisions, revisionEntry],
    lastProjectionEvent: projectionEvent,
  };

  return {
    ok: true,
    record: updatedRecord,
    projectionEvent,
  };
}

/**
 * Annule la correction de distance et de dénivelé et restaure l'état mesuré
 * d'avant correction (S1.23).
 */
export function revertDistanceAndElevationCorrection(
  record: LifecycleActivityRecord,
  nowIso = new Date().toISOString(),
): DistanceElevationCorrectionOutcome {
  if (record.lifecycleStatus === 'deleted') {
    return { ok: false, code: 'activity_deleted', error: 'Activité supprimée.' };
  }

  const snap = record.correctionState.previousSnapshot;
  if (!snap) {
    return {
      ok: false,
      code: 'nothing_to_revert',
      error: 'Aucune correction de distance ou de dénivelé à annuler.',
    };
  }

  const restoredPoints = clonePoints(snap.points);
  const nextStats = computeActivityStats(restoredPoints, record.sport, {
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    fallbackDurationS: record.stats.elapsedTimeS,
    overrideDistanceM: snap.points.length === 0 ? snap.distanceM : null,
    overrideElevationGainM: snap.points.length === 0 ? snap.elevationGainM : null,
    overrideElevationLossM: snap.points.length === 0 ? snap.elevationLossM : null,
    fallbackMaxAltitudeM: snap.maxAltitudeM,
  });

  const nextRevision = record.revision + 1;
  const revisionEntry: LifecycleRevision = {
    revision: nextRevision,
    kind: 'revert_transformation',
    operationId: null,
    createdAt: nowIso,
    summary: 'Annulation de la correction de distance/dénivelé',
    snapshotBefore: {
      points: clonePoints(record.points),
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      sport: record.sport,
      variantId: record.variantId,
      stats: record.stats,
    },
  };

  const projectionEvent = buildProjectionEvent(
    { ...record, revision: nextRevision },
    nextStats,
    'recalculate_totals',
    false,
    null,
    nowIso,
  );

  const filteredReasons = record.recordsEligibility.reasons.filter(
    (r) => r !== 'manual_metric_override' && r !== 'distance_or_elevation_corrected',
  );

  const updatedRecord: LifecycleActivityRecord = {
    ...record,
    revision: nextRevision,
    points: restoredPoints,
    originalPoints: clonePoints(record.originalPoints),
    stats: nextStats,
    correctionState: {
      distanceMethod: snap.distanceMethod,
      elevationMethod: snap.elevationMethod,
      appliedAt: null,
      previousSnapshot: null,
    },
    recordsEligibility: {
      eligible: true,
      invalidatedRecords: filteredReasons.length > 0,
      reasons: filteredReasons,
    },
    revisions: [...record.revisions, revisionEntry],
    lastProjectionEvent: projectionEvent,
  };

  return {
    ok: true,
    record: updatedRecord,
    projectionEvent,
  };
}

/**
 * Restaure intégralement la géométrie d'origine (`originalPoints`) après un ou
 * plusieurs recadrages ou corrections (Invariant de réversibilité A02).
 */
export function restoreOriginalGeometry(
  record: LifecycleActivityRecord,
  nowIso = new Date().toISOString(),
): LifecycleActivityRecord {
  const restoredPoints = clonePoints(record.originalPoints);
  const firstStartedAt = restoredPoints[0]?.timestamp ?? record.startedAt;
  const lastEndedAt =
    restoredPoints[restoredPoints.length - 1]?.timestamp ?? record.endedAt;

  const nextStats = computeActivityStats(restoredPoints, record.sport, {
    startedAt: firstStartedAt,
    endedAt: lastEndedAt,
    fallbackDurationS: record.stats.elapsedTimeS,
  });

  const nextRevision = record.revision + 1;
  const revisionEntry: LifecycleRevision = {
    revision: nextRevision,
    kind: 'revert_transformation',
    operationId: null,
    createdAt: nowIso,
    summary: 'Restauration de la trace brute d’origine',
    snapshotBefore: {
      points: clonePoints(record.points),
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      sport: record.sport,
      variantId: record.variantId,
      stats: record.stats,
    },
  };

  const projectionEvent = buildProjectionEvent(
    { ...record, revision: nextRevision },
    nextStats,
    'recalculate_totals',
    false,
    null,
    nowIso,
  );

  return {
    ...record,
    revision: nextRevision,
    startedAt: firstStartedAt,
    endedAt: lastEndedAt,
    points: restoredPoints,
    originalPoints: clonePoints(record.originalPoints),
    stats: nextStats,
    correctionState: {
      distanceMethod: 'raw',
      elevationMethod: 'raw',
      appliedAt: null,
      previousSnapshot: null,
    },
    recordsEligibility: {
      eligible: true,
      invalidatedRecords: false,
      reasons: [],
    },
    revisions: [...record.revisions, revisionEntry],
    lastProjectionEvent: projectionEvent,
  };
}
