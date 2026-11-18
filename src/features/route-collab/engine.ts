import { haversineKm } from '@/features/adventure-prep/engine/routing';
import {
  defaultSpeedKmHForSport,
  type RouteGeometry,
} from '@/features/adventure-prep/routeRevision';
import type { RouteRoutingOptions, RouteSport } from '@/features/adventure-prep/routeProfiles';
import { hasRoutePermission, requiredPermissionForOperation } from './permissions';
import type {
  ApplyOperationResult,
  CollaborativeKitItem,
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  CollaborativeStage,
  DeparturePackManifest,
  DomainConflict,
  ElevationProfile,
  RouteComment,
  RouteImpactSummary,
  RouteOperationInput,
  RouteOperationRecord,
  RouteProposal,
  RouteRevisionSnapshot,
  RouteWorkspaceState,
} from './types';

/* ---------- Utilitaires déterministes ---------- */

export function stableHash(input: unknown): string {
  const json = JSON.stringify(input);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < json.length; i += 1) {
    const c = json.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function computeRoutingFingerprint(params: {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  sport: RouteSport;
  options: RouteRoutingOptions;
  provider?: string | null;
}): string {
  return stableHash({
    from: [Number(params.from.lat.toFixed(6)), Number(params.from.lon.toFixed(6))],
    to: [Number(params.to.lat.toFixed(6)), Number(params.to.lon.toFixed(6))],
    sport: params.sport,
    options: params.options,
    provider: params.provider ?? 'auto',
  });
}

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Clé lexicographique déterministe entre `prev` et `next` pour insérer sans renuméroter. */
export function orderKeyBetween(prev: string | null, next: string | null): string {
  if (!prev && !next) return 'V';
  if (!prev) {
    const firstIdx = ALPHABET.indexOf(next![0]);
    if (firstIdx > 1) return ALPHABET[Math.floor(firstIdx / 2)];
    return `0${orderKeyBetween(null, next!.slice(1) || 'V')}`;
  }
  if (!next) {
    const lastIdx = ALPHABET.indexOf(prev[0]);
    if (lastIdx >= 0 && lastIdx < ALPHABET.length - 2) {
      return ALPHABET[Math.floor((lastIdx + ALPHABET.length) / 2)];
    }
    return `${prev}V`;
  }
  let i = 0;
  while (i < prev.length || i < next.length) {
    const a = i < prev.length ? ALPHABET.indexOf(prev[i]) : 0;
    const b = i < next.length ? ALPHABET.indexOf(next[i]) : ALPHABET.length - 1;
    if (a < b - 1) {
      return prev.slice(0, i) + ALPHABET[Math.floor((a + b) / 2)];
    }
    if (a === b) {
      i += 1;
      continue;
    }
    return prev.slice(0, i + 1) + orderKeyBetween(prev.slice(i + 1) || null, null);
  }
  return `${prev}V`;
}

export function activePoints(workspace: RouteWorkspaceState): CollaborativeRoutePoint[] {
  return workspace.points
    .filter((p) => !p.deletedAt)
    .slice()
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : a.id.localeCompare(b.id)));
}

export function lineDistanceKm(coords: readonly [number, number][]): number {
  let km = 0;
  for (let i = 1; i < coords.length; i += 1) {
    km += haversineKm(
      { lat: coords[i - 1][1], lon: coords[i - 1][0] },
      { lat: coords[i][1], lon: coords[i][0] },
    );
  }
  return Number(km.toFixed(3));
}

export function workspaceTotals(workspace: RouteWorkspaceState): {
  distanceKm: number;
  durationMin: number | null;
  ascentM: number | null;
  descentM: number | null;
  hasMissingElevation: boolean;
} {
  let distanceKm = 0;
  let durationMin = 0;
  let hasDuration = workspace.sections.length > 0;
  let ascentM = 0;
  let descentM = 0;
  let hasAscent = workspace.sections.length > 0;

  for (const s of workspace.sections) {
    distanceKm += s.distanceKm;
    if (s.durationMin != null) durationMin += s.durationMin;
    else hasDuration = false;
    if (s.ascentM != null) ascentM += s.ascentM;
    else hasAscent = false;
    if (s.descentM != null) descentM += s.descentM;
  }

  const speed = defaultSpeedKmHForSport(workspace.sport);
  const fallbackDuration =
    distanceKm > 0 ? Math.round((distanceKm / speed) * 60 + (hasAscent ? (ascentM / 600) * 60 : 0)) : null;

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMin: hasDuration ? Math.round(durationMin) : fallbackDuration,
    ascentM: hasAscent ? Math.round(ascentM) : null,
    descentM: hasAscent ? Math.round(descentM) : null,
    hasMissingElevation: !hasAscent,
  };
}

export function buildElevationProfile(workspace: RouteWorkspaceState): ElevationProfile {
  const samples: Array<{ distanceM: number; elevationM: number | null }> = [];
  let cumM = 0;
  let missingCount = 0;
  const pts = activePoints(workspace);
  const pointById = new Map(pts.map((p) => [p.id, p]));

  for (const sec of workspace.sections) {
    const fromPt = pointById.get(sec.fromPointId);
    const toPt = pointById.get(sec.toPointId);
    const coords = sec.geometry.coordinates;
    for (let i = 0; i < coords.length; i += 1) {
      if (i > 0) {
        cumM += haversineKm(
          { lat: coords[i - 1][1], lon: coords[i - 1][0] },
          { lat: coords[i][1], lon: coords[i][0] },
        ) * 1000;
      }
      let ele: number | null = null;
      if (i === 0 && fromPt?.eleM != null) ele = fromPt.eleM;
      else if (i === coords.length - 1 && toPt?.eleM != null) ele = toPt.eleM;
      if (ele == null) missingCount += 1;
      samples.push({ distanceM: Math.round(cumM), elevationM: ele });
    }
  }

  return {
    samples,
    source: workspace.sourceOrigin.kind === 'gpx_import' ? 'GPX / points' : 'points de passage',
    computedAt: workspace.updatedAt,
    missingRatio: samples.length > 0 ? Number((missingCount / samples.length).toFixed(2)) : 1,
  };
}

/* ---------- Impact Graph ---------- */

export function computeRouteImpact(
  before: RouteWorkspaceState,
  after: RouteWorkspaceState,
): RouteImpactSummary {
  const prevTotals = workspaceTotals(before);
  const nextTotals = workspaceTotals(after);
  const deltaDistanceKm = Number((nextTotals.distanceKm - prevTotals.distanceKm).toFixed(2));
  const deltaAscentM =
    prevTotals.ascentM != null && nextTotals.ascentM != null
      ? nextTotals.ascentM - prevTotals.ascentM
      : null;
  const deltaDurationMin =
    prevTotals.durationMin != null && nextTotals.durationMin != null
      ? nextTotals.durationMin - prevTotals.durationMin
      : null;

  const affectedStageIds: string[] = [];
  const affectedDayNumbers: number[] = [];
  let overnightChanged = false;
  let waterGapChanged = false;

  const prevStageById = new Map(before.stages.map((s) => [s.id, s]));
  for (const nextStage of after.stages) {
    const prevStage = prevStageById.get(nextStage.id);
    if (!prevStage) {
      affectedStageIds.push(nextStage.id);
      affectedDayNumbers.push(nextStage.dayNumber);
      continue;
    }
    const overnightDiff =
      (prevStage.overnightPlace?.id ?? null) !== (nextStage.overnightPlace?.id ?? null) ||
      (prevStage.overnightPlace?.type ?? null) !== (nextStage.overnightPlace?.type ?? null);
    if (overnightDiff) overnightChanged = true;
    if (prevStage.waterObservations.length !== nextStage.waterObservations.length) {
      waterGapChanged = true;
    }
    if (
      prevStage.startPointId !== nextStage.startPointId ||
      prevStage.endPointId !== nextStage.endPointId ||
      overnightDiff ||
      prevStage.notes !== nextStage.notes ||
      Math.abs(deltaDistanceKm) >= 0.1
    ) {
      affectedStageIds.push(nextStage.id);
      affectedDayNumbers.push(nextStage.dayNumber);
    }
  }

  const arrivalShiftMin = deltaDurationMin;
  const weatherRevalidationNeeded =
    arrivalShiftMin !== null ? Math.abs(arrivalShiftMin) >= 20 : Math.abs(deltaDistanceKm) >= 1;
  if (Math.abs(deltaDistanceKm) >= 1) waterGapChanged = true;

  const kitItemsToRevalidate: Array<{
    itemId: string;
    itemName: string;
    reason: string;
    assigneeUserId: string | null;
  }> = [];

  for (const item of after.kitItems) {
    const reasons: string[] = [];
    if (overnightChanged && item.dependsOn.includes('overnight')) {
      reasons.push('Hébergement / nuit modifiée');
    }
    if (waterGapChanged && item.dependsOn.includes('water')) {
      reasons.push('Distance ou ravitaillement eau modifié');
    }
    if (weatherRevalidationNeeded && item.dependsOn.includes('weather')) {
      reasons.push('Créneau horaire météo décalé');
    }
    if ((deltaDurationMin != null && Math.abs(deltaDurationMin) >= 30) && item.dependsOn.includes('duration')) {
      reasons.push('Durée estimée modifiée');
    }
    if (Math.abs(deltaDistanceKm) >= 1 && item.dependsOn.includes('distance')) {
      reasons.push('Kilométrage modifié');
    }
    if (reasons.length > 0) {
      kitItemsToRevalidate.push({
        itemId: item.id,
        itemName: item.name,
        reason: reasons.join(' · '),
        assigneeUserId: item.assigneeUserId,
      });
    }
  }

  const memberReasonMap = new Map<string, Set<string>>();
  for (const k of kitItemsToRevalidate) {
    if (!k.assigneeUserId) continue;
    if (!memberReasonMap.has(k.assigneeUserId)) memberReasonMap.set(k.assigneeUserId, new Set());
    memberReasonMap.get(k.assigneeUserId)!.add(`Vérifier ${k.itemName}`);
  }
  const memberById = new Map(after.members.map((m) => [m.userId, m]));
  const affectedMembers = Array.from(memberReasonMap.entries()).map(([userId, reasons]) => ({
    userId,
    displayName: memberById.get(userId)?.displayName ?? userId,
    reason: Array.from(reasons).join(', '),
  }));

  const unknowns: string[] = [];
  if (nextTotals.hasMissingElevation) unknowns.push('Altitude manquante sur au moins une section');
  if (after.stages.some((s) => !s.weatherSlice || s.weatherSlice.status === 'unavailable')) {
    unknowns.push('Météo indisponible ou non actualisée sur une étape');
  }
  if (after.stages.some((s) => s.waterObservations.some((w) => w.status === 'unknown'))) {
    unknowns.push('Disponibilité ou potabilité de l’eau non confirmée');
  }

  return {
    deltaDistanceKm,
    deltaAscentM,
    deltaDurationMin,
    affectedStageIds,
    affectedDayNumbers,
    arrivalShiftMin,
    weatherRevalidationNeeded,
    waterGapChanged,
    overnightChanged,
    kitItemsToRevalidate,
    affectedMembers,
    unknowns,
  };
}

/* ---------- Sections & Commentaires ---------- */

function rebuildSectionsFromPoints(
  workspaceId: string,
  orderedPoints: readonly CollaborativeRoutePoint[],
  existingSections: readonly CollaborativeRouteSection[],
  sport: RouteSport,
  options: RouteRoutingOptions,
): CollaborativeRouteSection[] {
  if (orderedPoints.length < 2) return [];
  const byPair = new Map<string, CollaborativeRouteSection>();
  for (const sec of existingSections) {
    byPair.set(`${sec.fromPointId}->${sec.toPointId}`, sec);
  }
  const speed = defaultSpeedKmHForSport(sport);
  const out: CollaborativeRouteSection[] = [];

  for (let i = 0; i < orderedPoints.length - 1; i += 1) {
    const from = orderedPoints[i];
    const to = orderedPoints[i + 1];
    const existing = byPair.get(`${from.id}->${to.id}`);
    if (existing) {
      out.push(existing);
      continue;
    }
    const coords: Array<[number, number]> = [
      [from.lon, from.lat],
      [to.lon, to.lat],
    ];
    const distanceKm = lineDistanceKm(coords);
    out.push({
      id: `sec-${from.id}-${to.id}`,
      workspaceId,
      fromPointId: from.id,
      toPointId: to.id,
      mode: 'routed',
      geometry: { type: 'LineString', coordinates: coords },
      distanceKm,
      durationMin: Math.round((distanceKm / speed) * 60),
      ascentM: null,
      descentM: null,
      surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'unknown', source: null }],
      routingInputHash: computeRoutingFingerprint({ from, to, sport, options }),
      pendingFingerprint: null,
      provenance: {
        provider: null,
        calculatedAt: null,
        profile: sport,
        confidence: 'estimated',
      },
      warnings: ['Segment direct en attente de calcul routeur'],
      entityVersion: 1,
    });
  }
  return out;
}

function relocateOrFlagComments(
  comments: readonly RouteComment[],
  points: readonly CollaborativeRoutePoint[],
  sections: readonly CollaborativeRouteSection[],
): RouteComment[] {
  const pointById = new Map(points.filter((p) => !p.deletedAt).map((p) => [p.id, p]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  return comments.map((comment) => {
    if (comment.status === 'resolved') return comment;
    const { anchor } = comment;
    if (anchor.anchorType === 'point') {
      const pt = pointById.get(anchor.entityId);
      if (!pt) return { ...comment, status: 'needs_relocation' };
      const movedKm = haversineKm(
        { lat: anchor.originalLat, lon: anchor.originalLon },
        { lat: pt.lat, lon: pt.lon },
      );
      if (movedKm * 1000 > anchor.maxRelocateMeters) {
        return { ...comment, status: 'needs_relocation' };
      }
    } else if (anchor.anchorType === 'section') {
      const sec = sectionById.get(anchor.entityId);
      if (!sec) return { ...comment, status: 'needs_relocation' };
    }
    return comment;
  });
}

function applyKitRevalidations(
  kitItems: readonly CollaborativeKitItem[],
  impact: RouteImpactSummary,
): CollaborativeKitItem[] {
  const revalMap = new Map(impact.kitItemsToRevalidate.map((r) => [r.itemId, r.reason]));
  return kitItems.map((item) => {
    const reason = revalMap.get(item.id);
    if (!reason) return item; // Préserve les confirmations encore valables !
    return {
      ...item,
      status: 'needs_revalidation',
      revalidationReason: reason,
    };
  });
}

/* ---------- Application Transactionnelle d'Opérations ---------- */

export interface ApplyOperationCommand {
  readonly opId: string;
  readonly baseSeq: number;
  readonly actorId: string;
  readonly actorName: string;
  readonly operation: RouteOperationInput;
  readonly expectedVersions?: Readonly<Record<string, number>>;
}

function stageIdForOperation(workspace: RouteWorkspaceState, op: RouteOperationInput): string | null {
  if ('stageId' in op) return op.stageId;
  if ('pointId' in op) {
    const stage = workspace.stages.find(
      (s) => s.startPointId === op.pointId || s.endPointId === op.pointId,
    );
    return stage?.id ?? null;
  }
  return null;
}

export function applyWorkspaceOperation(
  workspace: RouteWorkspaceState,
  opLog: readonly RouteOperationRecord[],
  command: ApplyOperationCommand,
  nowIso: string,
): { result: ApplyOperationResult; nextOpLog: readonly RouteOperationRecord[] } {
  const member = workspace.members.find((m) => m.userId === command.actorId);
  const requiredPerm = requiredPermissionForOperation(command.operation);
  const stageScope = stageIdForOperation(workspace, command.operation);

  if (!hasRoutePermission(member, requiredPerm, stageScope)) {
    return {
      result: { status: 'denied', reason: 'Accès insuffisant ou révoqué pour cette action.' },
      nextOpLog: opLog,
    };
  }

  const pHash = stableHash(command.operation);
  const existingOp = opLog.find((o) => o.workspaceId === workspace.id && o.opId === command.opId);
  if (existingOp) {
    if (existingOp.payloadHash !== pHash) {
      return {
        result: {
          status: 'denied',
          reason: 'Clé d’idempotence réutilisée avec un contenu différent.',
        },
        nextOpLog: opLog,
      };
    }
    return {
      result: { status: 'already_applied', seq: existingOp.seq, workspace },
      nextOpLog: opLog,
    };
  }

  const expected = command.expectedVersions ?? {};
  const conflicts: DomainConflict[] = [];

  // Vérification des versions d'entités touchées (concurrence optimiste par entité).
  for (const [entityId, expectedVer] of Object.entries(expected)) {
    const pt = workspace.points.find((p) => p.id === entityId);
    if (pt) {
      if (pt.deletedAt) {
        conflicts.push({
          entityId,
          entityType: 'point',
          entityLabel: pt.name || `Point ${pt.id.slice(0, 6)}`,
          expectedVersion: expectedVer,
          currentVersion: pt.entityVersion,
          message: `Le point « ${pt.name || pt.id} » a été supprimé entre-temps.`,
          yourSummary: 'Modifier ce point',
          currentSummary: 'Point supprimé par un collaborateur',
        });
      } else if (pt.entityVersion !== expectedVer) {
        conflicts.push({
          entityId,
          entityType: 'point',
          entityLabel: pt.name || `Point ${pt.id.slice(0, 6)}`,
          expectedVersion: expectedVer,
          currentVersion: pt.entityVersion,
          message: `Conflit sur « ${pt.name || pt.id} » : modifié en parallèle (v${pt.entityVersion} vs v${expectedVer}).`,
          yourSummary: 'Votre modification locale',
          currentSummary: `Position actuelle (${pt.lat.toFixed(4)}, ${pt.lon.toFixed(4)})`,
        });
      }
      continue;
    }

    const sec = workspace.sections.find((s) => s.id === entityId);
    if (sec && sec.entityVersion !== expectedVer) {
      conflicts.push({
        entityId,
        entityType: 'section',
        entityLabel: `Section ${sec.id.slice(0, 8)}`,
        expectedVersion: expectedVer,
        currentVersion: sec.entityVersion,
        message: `La section a été modifiée en parallèle (v${sec.entityVersion} vs v${expectedVer}).`,
        yourSummary: 'Votre modification de section',
        currentSummary: `Section actuelle (${sec.distanceKm} km, ${sec.mode})`,
      });
      continue;
    }

    const stage = workspace.stages.find((s) => s.id === entityId);
    if (stage && stage.entityVersion !== expectedVer) {
      conflicts.push({
        entityId,
        entityType: 'stage',
        entityLabel: stage.title,
        expectedVersion: expectedVer,
        currentVersion: stage.entityVersion,
        message: `L’étape « ${stage.title} » a été modifiée en parallèle (v${stage.entityVersion} vs v${expectedVer}).`,
        yourSummary: 'Votre modification d’étape',
        currentSummary: `Étape actuelle (${stage.overnightPlace?.name ?? 'sans hébergement'})`,
      });
    }
  }

  if (conflicts.length > 0) {
    return {
      result: {
        status: 'conflict',
        currentSeq: workspace.headSeq,
        conflicts,
        currentWorkspace: workspace,
      },
      nextOpLog: opLog,
    };
  }

  // Rejet d'un résultat de routage tardif / périmé.
  if (command.operation.type === 'apply_routing_result') {
    const op = command.operation;
    const sec = workspace.sections.find((s) => s.id === op.sectionId);
    if (!sec) {
      return {
        result: {
          status: 'stale_routing_discarded',
          seq: workspace.headSeq,
          reason: 'Section introuvable (supprimée ou fusionnée).',
        },
        nextOpLog: opLog,
      };
    }
    const activeHash = sec.pendingFingerprint ?? sec.routingInputHash;
    if (activeHash && op.routingInputHash !== activeHash) {
      return {
        result: {
          status: 'stale_routing_discarded',
          seq: workspace.headSeq,
          reason: 'Résultat de routage obsolète : les points ou options ont changé depuis la requête.',
        },
        nextOpLog: opLog,
      };
    }
  }

  const nextSeq = workspace.headSeq + 1;
  let nextPoints = workspace.points.slice();
  let nextSections = workspace.sections.slice();
  let nextStages = workspace.stages.slice();
  let nextSport = workspace.sport;
  let nextOptions = workspace.routingOptions;

  const op = command.operation;
  switch (op.type) {
    case 'move_point': {
      nextPoints = nextPoints.map((p) =>
        p.id === op.pointId
          ? {
              ...p,
              lat: op.lat,
              lon: op.lon,
              eleM: op.eleM !== undefined ? op.eleM : p.eleM,
              entityVersion: p.entityVersion + 1,
            }
          : p,
      );
      const ordered = activePoints({ ...workspace, points: nextPoints });
      nextSections = nextSections.map((s) => {
        if (s.fromPointId !== op.pointId && s.toPointId !== op.pointId) return s;
        const fromPt = ordered.find((p) => p.id === s.fromPointId);
        const toPt = ordered.find((p) => p.id === s.toPointId);
        if (!fromPt || !toPt) return s;
        const coords: Array<[number, number]> = [
          [fromPt.lon, fromPt.lat],
          [toPt.lon, toPt.lat],
        ];
        const dist = lineDistanceKm(coords);
        return {
          ...s,
          geometry: { type: 'LineString', coordinates: coords },
          distanceKm: dist,
          routingInputHash: computeRoutingFingerprint({
            from: fromPt,
            to: toPt,
            sport: nextSport,
            options: nextOptions,
          }),
          entityVersion: s.entityVersion + 1,
        };
      });
      break;
    }

    case 'insert_point': {
      const ordered = activePoints(workspace);
      const afterIdx = op.afterPointId
        ? ordered.findIndex((p) => p.id === op.afterPointId)
        : ordered.length - 1;
      const prevKey = afterIdx >= 0 ? ordered[afterIdx].orderKey : null;
      const nextKey =
        afterIdx >= 0 && afterIdx + 1 < ordered.length ? ordered[afterIdx + 1].orderKey : null;
      const newPoint: CollaborativeRoutePoint = {
        id: op.pointId,
        workspaceId: workspace.id,
        kind: op.kind ?? 'via',
        orderKey: orderKeyBetween(prevKey, nextKey),
        lat: op.lat,
        lon: op.lon,
        name: op.name ?? null,
        semanticKind: op.semanticKind ?? 'waypoint',
        entityVersion: 1,
      };
      nextPoints.push(newPoint);
      const reordered = activePoints({ ...workspace, points: nextPoints });
      nextSections = rebuildSectionsFromPoints(
        workspace.id,
        reordered,
        nextSections,
        nextSport,
        nextOptions,
      );
      break;
    }

    case 'delete_point': {
      nextPoints = nextPoints.map((p) =>
        p.id === op.pointId ? { ...p, deletedAt: nowIso, entityVersion: p.entityVersion + 1 } : p,
      );
      const reordered = activePoints({ ...workspace, points: nextPoints });
      nextSections = rebuildSectionsFromPoints(
        workspace.id,
        reordered,
        nextSections,
        nextSport,
        nextOptions,
      );
      break;
    }

    case 'reverse_route': {
      const ordered = activePoints(workspace).reverse();
      let prev: string | null = null;
      const reversedMap = new Map<string, string>();
      for (const p of ordered) {
        const k = orderKeyBetween(prev, null);
        reversedMap.set(p.id, k);
        prev = k;
      }
      nextPoints = nextPoints.map((p) =>
        p.deletedAt
          ? p
          : {
              ...p,
              orderKey: reversedMap.get(p.id) ?? p.orderKey,
              entityVersion: p.entityVersion + 1,
            },
      );
      const reordered = activePoints({ ...workspace, points: nextPoints });
      nextSections = rebuildSectionsFromPoints(
        workspace.id,
        reordered,
        [],
        nextSport,
        nextOptions,
      );
      break;
    }

    case 'set_section_mode': {
      nextSections = nextSections.map((s) =>
        s.id === op.sectionId
          ? {
              ...s,
              mode: op.mode,
              geometry: op.geometry ?? s.geometry,
              distanceKm: op.geometry ? lineDistanceKm(op.geometry.coordinates) : s.distanceKm,
              entityVersion: s.entityVersion + 1,
            }
          : s,
      );
      break;
    }

    case 'apply_routing_result': {
      nextSections = nextSections.map((s) =>
        s.id === op.sectionId
          ? {
              ...s,
              mode: 'routed',
              geometry: op.geometry,
              distanceKm: op.distanceKm,
              durationMin: op.durationMin,
              ascentM: op.ascentM,
              descentM: op.descentM,
              surfaceSegments: op.surfaceSegments ?? s.surfaceSegments,
              routingInputHash: op.routingInputHash,
              pendingFingerprint: null,
              provenance: op.provenance,
              warnings: [],
              entityVersion: s.entityVersion + 1,
            }
          : s,
      );
      break;
    }

    case 'split_days': {
      const ordered = activePoints(workspace);
      if (ordered.length >= 2) {
        const count = Math.max(1, Math.min(op.targetDays, ordered.length - 1));
        const tz = op.timezone ?? workspace.stages[0]?.timezone ?? 'Europe/Paris';
        const stages: CollaborativeStage[] = [];
        for (let d = 0; d < count; d += 1) {
          const startIdx = Math.floor((d * (ordered.length - 1)) / count);
          const endIdx =
            d === count - 1
              ? ordered.length - 1
              : Math.floor(((d + 1) * (ordered.length - 1)) / count);
          const prev = workspace.stages[d];
          stages.push({
            id: prev?.id ?? `stage-${d + 1}`,
            workspaceId: workspace.id,
            orderKey: String(d + 1).padStart(3, '0'),
            dayNumber: d + 1,
            title: prev?.title ?? `Jour ${d + 1}`,
            dateIso: prev?.dateIso ?? null,
            departureTimeLocal: prev?.departureTimeLocal ?? '08:30',
            timezone: tz,
            startPointId: ordered[startIdx].id,
            endPointId: ordered[endIdx].id,
            overnightPlace: prev?.overnightPlace ?? null,
            notes: prev?.notes ?? '',
            waterObservations: prev?.waterObservations ?? [],
            weatherSlice: prev?.weatherSlice ?? null,
            hazards: prev?.hazards ?? [],
            entityVersion: (prev?.entityVersion ?? 0) + 1,
          });
        }
        nextStages = stages;
      }
      break;
    }

    case 'move_day_boundary': {
      const idx = nextStages.findIndex((s) => s.id === op.stageId);
      if (idx >= 0 && idx + 1 < nextStages.length) {
        nextStages = nextStages.map((s, i) => {
          if (i === idx) {
            return { ...s, endPointId: op.newEndPointId, entityVersion: s.entityVersion + 1 };
          }
          if (i === idx + 1) {
            return { ...s, startPointId: op.newEndPointId, entityVersion: s.entityVersion + 1 };
          }
          return s;
        });
      }
      break;
    }

    case 'update_stage_note': {
      nextStages = nextStages.map((s) =>
        s.id === op.stageId ? { ...s, notes: op.notes, entityVersion: s.entityVersion + 1 } : s,
      );
      break;
    }

    case 'set_overnight': {
      nextStages = nextStages.map((s) =>
        s.id === op.stageId
          ? { ...s, overnightPlace: op.overnightPlace, entityVersion: s.entityVersion + 1 }
          : s,
      );
      break;
    }

    case 'set_sport_profile': {
      nextSport = op.sport;
      nextOptions = op.routingOptions;
      break;
    }

    case 'revert_to_seq': {
      // L'annulation crée une nouvelle opération dans l'historique sans effacer le passé.
      break;
    }
  }

  const nextComments = relocateOrFlagComments(workspace.comments, nextPoints, nextSections);
  const candidateWorkspace: RouteWorkspaceState = {
    ...workspace,
    sport: nextSport,
    routingOptions: nextOptions,
    headSeq: nextSeq,
    points: nextPoints,
    sections: nextSections,
    stages: nextStages,
    comments: nextComments,
    updatedAt: nowIso,
  };

  const impact = computeRouteImpact(workspace, candidateWorkspace);
  const finalWorkspace: RouteWorkspaceState = {
    ...candidateWorkspace,
    kitItems: applyKitRevalidations(workspace.kitItems, impact),
  };

  const opRecord: RouteOperationRecord = {
    seq: nextSeq,
    opId: command.opId,
    workspaceId: workspace.id,
    actorId: command.actorId,
    actorName: command.actorName,
    baseSeq: command.baseSeq,
    payloadHash: pHash,
    operation: command.operation,
    expectedVersions: expected,
    createdAt: nowIso,
  };

  return {
    result: {
      status: 'accepted',
      seq: nextSeq,
      workspace: finalWorkspace,
      impact,
    },
    nextOpLog: [...opLog, opRecord],
  };
}

/* ---------- Publication Immuable ---------- */

export type PublishResult =
  | {
      readonly status: 'published';
      readonly revision: RouteRevisionSnapshot;
      readonly workspace: RouteWorkspaceState;
      readonly pack: DeparturePackManifest;
    }
  | {
      readonly status: 'blocked';
      readonly reason: string;
      readonly blockingIssues: readonly string[];
    };

export function publishWorkspaceRevision(params: {
  workspace: RouteWorkspaceState;
  actorId: string;
  actorName: string;
  expectedHeadSeq: number;
  summary: string;
  acknowledgedUnknowns?: readonly string[];
  nowIso: string;
}): PublishResult {
  const { workspace, actorId, actorName, expectedHeadSeq, summary, nowIso } = params;
  const member = workspace.members.find((m) => m.userId === actorId);
  if (!hasRoutePermission(member, 'route.publish')) {
    return {
      status: 'blocked',
      reason: 'Permission de publication requise.',
      blockingIssues: ['permission_denied'],
    };
  }

  if (expectedHeadSeq !== workspace.headSeq) {
    return {
      status: 'blocked',
      reason: `Le brouillon a avancé (séquence ${workspace.headSeq} vs ${expectedHeadSeq} relue) : une nouvelle vérification est requise avant publication.`,
      blockingIssues: ['head_changed_requires_review'],
    };
  }

  const pts = activePoints(workspace);
  const blockingIssues: string[] = [];
  if (pts.length < 2) blockingIssues.push('Au moins 2 points sont nécessaires.');
  if (workspace.sections.some((s) => Boolean(s.pendingFingerprint))) {
    blockingIssues.push('Une section est encore en cours de calcul.');
  }
  // Vérifier la continuité des sections
  for (let i = 0; i < pts.length - 1; i += 1) {
    const sec = workspace.sections[i];
    if (!sec || sec.fromPointId !== pts[i].id || sec.toPointId !== pts[i + 1].id) {
      blockingIssues.push(`Discontinuité détectée entre les points ${i + 1} et ${i + 2}.`);
      break;
    }
  }

  if (blockingIssues.length > 0) {
    return {
      status: 'blocked',
      reason: blockingIssues[0],
      blockingIssues,
    };
  }

  const nextRevNo = (workspace.publishedRevisionNo ?? 0) + 1;
  const revId = `rev-${workspace.id}-v${nextRevNo}`;
  const revision: RouteRevisionSnapshot = {
    id: revId,
    workspaceId: workspace.id,
    revisionNo: nextRevNo,
    parentRevisionId: workspace.publishedRevisionId,
    basedOnSeq: workspace.headSeq,
    createdBy: actorId,
    createdByName: actorName,
    createdAt: nowIso,
    kind: 'published',
    summary: summary.trim() || `Publication v${nextRevNo}`,
    points: pts,
    sections: workspace.sections,
    stages: workspace.stages,
    kitSnapshot: workspace.kitItems,
    acknowledgedUnknowns: params.acknowledgedUnknowns ?? [],
  };

  const payloadForChecksum = {
    revId,
    points: pts,
    sections: workspace.sections,
    stages: workspace.stages,
    kitSnapshot: workspace.kitItems,
  };
  const checksum = stableHash(payloadForChecksum);
  const estimatedBytes = JSON.stringify(payloadForChecksum).length;

  const pack: DeparturePackManifest = {
    packId: `pack-${revId}`,
    workspaceId: workspace.id,
    revisionId: revId,
    revisionNo: nextRevNo,
    checksum,
    estimatedBytes,
    generatedAt: nowIso,
    includedItems: ['geometry', 'stages', 'waypoints', 'notes', 'checklist', 'elevation'],
    unavailableItems: workspace.stages.some((s) => !s.weatherSlice)
      ? ['tuiles_offline_hors_emprise']
      : [],
    mapTileSource: {
      provider: 'OpenFreeMap / Protomaps (usage offline autorisé selon emprise)',
      offlineAuthorized: true,
      licenseNote: 'Attribution OpenStreetMap / OpenFreeMap conservée hors ligne',
    },
  };

  const nextParticipantPacks = workspace.participantPacks.map((pp) => ({
    ...pp,
    status: pp.downloadedRevisionNo === nextRevNo ? ('ready' as const) : ('outdated' as const),
  }));

  const nextWorkspace: RouteWorkspaceState = {
    ...workspace,
    status: 'published',
    reviewedSeq: workspace.headSeq,
    publishedRevisionId: revId,
    publishedRevisionNo: nextRevNo,
    revisions: [...workspace.revisions, revision],
    packs: [...workspace.packs, pack],
    participantPacks: nextParticipantPacks,
    updatedAt: nowIso,
  };

  return { status: 'published', revision, workspace: nextWorkspace, pack };
}

/* ---------- Import / Export GPX 1.1 ---------- */

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportWorkspaceGpx(workspace: RouteWorkspaceState, stageId?: string): string {
  const pts = activePoints(workspace);
  const pointById = new Map(pts.map((p) => [p.id, p]));
  let targetPoints = pts;
  let targetSections = workspace.sections;
  let trackName = workspace.title;

  if (stageId) {
    const stage = workspace.stages.find((s) => s.id === stageId);
    if (stage) {
      trackName = `${workspace.title} — ${stage.title}`;
      const startIdx = pts.findIndex((p) => p.id === stage.startPointId);
      const endIdx = pts.findIndex((p) => p.id === stage.endPointId);
      if (startIdx >= 0 && endIdx > startIdx) {
        targetPoints = pts.slice(startIdx, endIdx + 1);
        const allowedIds = new Set(targetPoints.map((p) => p.id));
        targetSections = workspace.sections.filter(
          (s) => allowedIds.has(s.fromPointId) && allowedIds.has(s.toPointId),
        );
      }
    }
  }

  const wpts = targetPoints
    .filter((p) => p.name || p.semanticKind)
    .map((p) => {
      const eleTag = p.eleM != null ? `<ele>${p.eleM}</ele>` : '';
      const nameTag = `<name>${escapeXml(p.name || p.semanticKind || p.id)}</name>`;
      return `  <wpt lat="${p.lat}" lon="${p.lon}">${eleTag}${nameTag}</wpt>`;
    })
    .join('\n');

  const trkpts: string[] = [];
  for (const sec of targetSections) {
    const fromPt = pointById.get(sec.fromPointId);
    const toPt = pointById.get(sec.toPointId);
    const coords = sec.geometry.coordinates;
    for (let i = 0; i < coords.length; i += 1) {
      const [lon, lat] = coords[i];
      const ele =
        i === 0 ? fromPt?.eleM ?? null : i === coords.length - 1 ? toPt?.eleM ?? null : null;
      const eleTag = ele != null ? `<ele>${ele}</ele>` : '';
      trkpts.push(`      <trkpt lat="${lat}" lon="${lon}">${eleTag}</trkpt>`);
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Le Kit du Voyageur (LKDV)" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(trackName)}</name><time>${workspace.updatedAt}</time></metadata>`,
    wpts,
    '  <trk>',
    `    <name>${escapeXml(trackName)}</name>`,
    '    <trkseg>',
    trkpts.join('\n'),
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ]
    .filter(Boolean)
    .join('\n');
}

export interface GpxImportResult {
  readonly ok: true;
  readonly points: readonly CollaborativeRoutePoint[];
  readonly sections: readonly CollaborativeRouteSection[];
  readonly originalGpxXml: string;
}

export function parseGpxToWorkspaceEntities(params: {
  gpxXml: string;
  workspaceId: string;
  keepOriginalGeometry?: boolean;
}): GpxImportResult | { readonly ok: false; readonly error: string } {
  const xml = params.gpxXml.trim();
  if (!xml || !xml.includes('<gpx')) {
    return { ok: false, error: 'Fichier GPX invalide ou vide.' };
  }
  if (xml.length > 2_000_000) {
    return { ok: false, error: 'Fichier GPX trop volumineux (limite 2 Mo).' };
  }

  const trkptRegex = /<trkpt\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/trkpt>|<trkpt\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*\/>/gi;
  const rawCoords: Array<{ lat: number; lon: number; eleM: number | null }> = [];
  let match: RegExpExecArray | null;
  while ((match = trkptRegex.exec(xml)) !== null) {
    const lat = Number(match[1] ?? match[4]);
    const lon = Number(match[2] ?? match[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      continue;
    }
    const inner = match[3] ?? '';
    const eleMatch = inner.match(/<ele>([^<]+)<\/ele>/i);
    const eleM = eleMatch ? Number(eleMatch[1]) : null;
    rawCoords.push({
      lat,
      lon,
      eleM: eleM !== null && Number.isFinite(eleM) ? eleM : null,
    });
    if (rawCoords.length >= 20_000) break;
  }

  if (rawCoords.length < 2) {
    return { ok: false, error: 'Le GPX ne contient pas assez de points exploitables.' };
  }

  const startPt: CollaborativeRoutePoint = {
    id: `pt-gpx-start-${stableHash(rawCoords[0]).slice(0, 6)}`,
    workspaceId: params.workspaceId,
    kind: 'start',
    orderKey: 'A',
    lat: rawCoords[0].lat,
    lon: rawCoords[0].lon,
    eleM: rawCoords[0].eleM,
    name: 'Départ GPX',
    entityVersion: 1,
  };
  const endPt: CollaborativeRoutePoint = {
    id: `pt-gpx-end-${stableHash(rawCoords[rawCoords.length - 1]).slice(0, 6)}`,
    workspaceId: params.workspaceId,
    kind: 'finish',
    orderKey: 'Z',
    lat: rawCoords[rawCoords.length - 1].lat,
    lon: rawCoords[rawCoords.length - 1].lon,
    eleM: rawCoords[rawCoords.length - 1].eleM,
    name: 'Arrivée GPX',
    entityVersion: 1,
  };

  const coords: Array<[number, number]> = rawCoords.map((c) => [c.lon, c.lat]);
  let ascentM = 0;
  let descentM = 0;
  let hasEle = false;
  for (let i = 1; i < rawCoords.length; i += 1) {
    const prev = rawCoords[i - 1].eleM;
    const curr = rawCoords[i].eleM;
    if (prev != null && curr != null) {
      hasEle = true;
      if (curr > prev) ascentM += curr - prev;
      else descentM += prev - curr;
    }
  }
  const distanceKm = lineDistanceKm(coords);
  const section: CollaborativeRouteSection = {
    id: `sec-gpx-${startPt.id}-${endPt.id}`,
    workspaceId: params.workspaceId,
    fromPointId: startPt.id,
    toPointId: endPt.id,
    mode: params.keepOriginalGeometry !== false ? 'imported_preserved' : 'routed',
    geometry: { type: 'LineString', coordinates: coords },
    distanceKm,
    durationMin: Math.round((distanceKm / 4) * 60),
    ascentM: hasEle ? Math.round(ascentM) : null,
    descentM: hasEle ? Math.round(descentM) : null,
    surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'unknown', source: 'GPX importé' }],
    routingInputHash: null,
    provenance: {
      provider: 'gpx-import',
      calculatedAt: new Date().toISOString(),
      profile: 'imported',
      confidence: 'verified',
    },
    warnings: hasEle ? [] : ['Données d’altitude absentes dans le GPX'],
    entityVersion: 1,
  };

  return {
    ok: true,
    points: [startPt, endPt],
    sections: [section],
    originalGpxXml: xml,
  };
}
