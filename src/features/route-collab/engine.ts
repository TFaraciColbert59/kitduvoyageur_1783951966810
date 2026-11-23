import { haversineKm } from '@/features/adventure-prep/engine/routing';
import {
  defaultSpeedKmHForSport,
  type RouteGeometry,
} from '@/features/adventure-prep/routeRevision';
import type { RouteRoutingOptions, RouteSport } from '@/features/adventure-prep/routeProfiles';
import { hasRoutePermission, requiredPermissionForOperation } from './permissions';
import {
  SNAP_POINT_KM,
  distanceToKm,
  isDefaultDayTitle,
  locateOnSections,
  mergeSectionPair,
  normalizeStages,
  repairStagesForRemovedPoints,
  reverseSectionData,
  shiftIsoDate,
  splitSectionAt,
  stageKind,
} from './engineTrack';
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
  let usedTerrainSamples = false;
  const pts = activePoints(workspace);
  const pointById = new Map(pts.map((p) => [p.id, p]));

  for (const sec of workspace.sections) {
    const fromPt = pointById.get(sec.fromPointId);
    const toPt = pointById.get(sec.toPointId);
    const coords = sec.geometry.coordinates;
    const secEle = sec.elevationSamples;
    if (secEle && secEle.length >= 2) usedTerrainSamples = true;
    for (let i = 0; i < coords.length; i += 1) {
      if (i > 0) {
        cumM += haversineKm(
          { lat: coords[i - 1][1], lon: coords[i - 1][0] },
          { lat: coords[i][1], lon: coords[i][0] },
        ) * 1000;
      }
      let ele: number | null = null;
      if (secEle && secEle.length >= 2) {
        const mappedIdx = Math.min(
          secEle.length - 1,
          Math.round((i / Math.max(1, coords.length - 1)) * (secEle.length - 1)),
        );
        ele = secEle[mappedIdx] ?? null;
      } else if (i === 0 && fromPt?.eleM != null) {
        ele = fromPt.eleM;
      } else if (i === coords.length - 1 && toPt?.eleM != null) {
        ele = toPt.eleM;
      }
      if (ele == null) missingCount += 1;
      samples.push({ distanceM: Math.round(cumM), elevationM: ele });
    }
  }

  return {
    samples,
    source: usedTerrainSamples
      ? 'Terrain Tiles (DEM)'
      : workspace.sourceOrigin.kind === 'gpx_import'
        ? 'GPX / points'
        : 'points de passage',
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
          reason:
            'Calcul rejeté : le tronçon n’existe plus (supprimé, coupé ou fusionné pendant le calcul). Le tracé affiché n’a pas changé.',
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
          reason:
            'Calcul rejeté : le tronçon a changé pendant le calcul (point déplacé, profil modifié ou recalcul plus récent). Le tracé affiché est resté celui d’avant ; relancez le calcul.',
        },
        nextOpLog: opLog,
      };
    }
  }

  const nextSeq = workspace.headSeq + 1;
  let nextPoints = workspace.points.slice();
  let nextSections = workspace.sections.slice();
  let nextStages = workspace.stages.slice();
  let nextVariants = workspace.variants.slice();
  let nextSport = workspace.sport;
  let nextShapeMode = workspace.shapeMode ?? 'one_way';
  let nextOptions = workspace.routingOptions;
  let nextSourceOrigin = workspace.sourceOrigin;
  const fp = (from: CollaborativeRoutePoint, to: CollaborativeRoutePoint) =>
    computeRoutingFingerprint({ from, to, sport: nextSport, options: nextOptions });
  const deny = (reason: string): { result: ApplyOperationResult; nextOpLog: readonly RouteOperationRecord[] } => ({
    result: { status: 'denied', reason },
    nextOpLog: opLog,
  });

  const op = command.operation;

  /** Les tronçons dans l'ordre des points actifs (un tronçon manquant n'y figure pas). */
  const orderedSections = (): CollaborativeRouteSection[] => {
    const pts = activePoints({ ...workspace, points: nextPoints });
    return pts
      .slice(0, -1)
      .map((p, i) => nextSections.find((s) => s.fromPointId === p.id && s.toPointId === pts[i + 1].id))
      .filter((s): s is CollaborativeRouteSection => Boolean(s));
  };
  const realign = () => {
    nextSections = rebuildSectionsFromPoints(
      workspace.id,
      activePoints({ ...workspace, points: nextPoints }),
      nextSections,
      nextSport,
      nextOptions,
    );
  };
  /**
   * Pose un point sur le tracé : un point existant à moins de 30 m est réutilisé, sinon le tronçon le plus
   * proche est coupé en deux (géométrie conservée). Lieu à plus de 500 m du tracé : refusé.
   */
  const placePointOnTrack = (
    newId: string,
    lat: number,
    lon: number,
    name: string | null | undefined,
  ): { ok: true; pointId: string } | { ok: false; reason: string } => {
    const pts = activePoints({ ...workspace, points: nextPoints });
    const near = pts
      .map((p) => ({ p, d: distanceToKm(p, { lat, lon }) }))
      .sort((a, b) => a.d - b.d)[0];
    if (near && near.d <= SNAP_POINT_KM) return { ok: true, pointId: near.p.id };
    if (nextPoints.some((p) => p.id === newId)) return { ok: false, reason: 'Identifiant de point déjà utilisé.' };
    const secs = orderedSections();
    const loc = locateOnSections(secs, lat, lon);
    if (!loc || loc.offsetKm > 0.5) return { ok: false, reason: 'Ce lieu est trop éloigné du tracé.' };
    const sec = secs[loc.sectionIndex];
    const from = pts.find((p) => p.id === sec.fromPointId);
    const to = pts.find((p) => p.id === sec.toPointId);
    if (!from || !to) return { ok: false, reason: 'Tronçon introuvable.' };
    const via: CollaborativeRoutePoint = {
      id: newId,
      workspaceId: workspace.id,
      kind: 'via',
      orderKey: orderKeyBetween(from.orderKey, to.orderKey),
      lat: loc.point[1],
      lon: loc.point[0],
      name: name ?? null,
      semanticKind: 'waypoint',
      entityVersion: 1,
    };
    const split = splitSectionAt(sec, loc, from, via, to, fp);
    if (!split.ok) return split;
    nextPoints = [...nextPoints, via];
    nextSections = [...nextSections.filter((s) => s !== sec), split.left, split.right];
    realign();
    return { ok: true, pointId: via.id };
  };
  const byDay = () => nextStages.slice().sort((a, b) => a.dayNumber - b.dayNumber);

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
        if (s.mode !== 'routed' && s.geometry.coordinates.length >= 2) {
          // Tracé à la main ou importé : il est conservé, seul son sommet d'extrémité suit le point déplacé.
          const kept = s.geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]);
          if (s.fromPointId === op.pointId) kept[0] = [op.lon, op.lat];
          else kept[kept.length - 1] = [op.lon, op.lat];
          return {
            ...s,
            geometry: { type: 'LineString', coordinates: kept },
            distanceKm: lineDistanceKm(kept),
            entityVersion: s.entityVersion + 1,
          };
        }
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
          // Segment direct en attendant le routeur : il n'est plus présenté comme calculé.
          provenance: { ...s.provenance, calculatedAt: null, confidence: 'estimated' as const },
          warnings: ['Point déplacé : tronçon à recalculer'],
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
      const before = activePoints(workspace);
      const at = before.findIndex((p) => p.id === op.pointId);
      if (at < 0) return deny('Point introuvable ou déjà supprimé.');
      if (before.length <= 2) return deny('Un itinéraire garde au moins deux points.');
      nextPoints = nextPoints.map((p) =>
        p.id === op.pointId ? { ...p, deletedAt: nowIso, entityVersion: p.entityVersion + 1 } : p,
      );
      const prevPt = before[at - 1];
      const nextPt = before[at + 1];
      const inSec = prevPt ? nextSections.find((s) => s.fromPointId === prevPt.id && s.toPointId === op.pointId) : undefined;
      const outSec = nextPt ? nextSections.find((s) => s.fromPointId === op.pointId && s.toPointId === nextPt.id) : undefined;
      // Les deux tronçons voisins deviennent un seul. Tracés à la main ou importés : leur géométrie est
      // conservée telle quelle. Tracés routés : segment direct recalculé ensuite (jamais laissé en trou).
      nextSections = nextSections.filter((s) => s !== inSec && s !== outSec);
      if (prevPt && nextPt && inSec && outSec && (inSec.mode !== 'routed' || outSec.mode !== 'routed')) {
        const merged = mergeSectionPair(inSec, outSec, prevPt, nextPt, fp);
        if (merged.ok) nextSections.push(merged.section);
      }
      nextSections = nextSections.filter((s) => s.fromPointId !== op.pointId && s.toPointId !== op.pointId);
      const reordered = activePoints({ ...workspace, points: nextPoints });
      nextSections = rebuildSectionsFromPoints(
        workspace.id,
        reordered,
        nextSections,
        nextSport,
        nextOptions,
      );
      nextStages = normalizeStages(
        repairStagesForRemovedPoints(nextStages, before, new Set([op.pointId])),
        reordered,
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
      const swapKind = (k: CollaborativeRoutePoint['kind']): CollaborativeRoutePoint['kind'] =>
        k === 'start' ? 'finish' : k === 'finish' ? 'start' : k;
      nextPoints = nextPoints.map((p) =>
        p.deletedAt
          ? p
          : {
              ...p,
              orderKey: reversedMap.get(p.id) ?? p.orderKey,
              kind: swapKind(p.kind),
              entityVersion: p.entityVersion + 1,
            },
      );
      const reordered = activePoints({ ...workspace, points: nextPoints });
      // Chaque tronçon est parcouru à l'envers : géométrie retournée, D+ et D− échangés. Un tronçon routé
      // reste affiché mais attend un nouveau calcul (sens uniques, montées et descentes ne sont plus les mêmes).
      const reversedSections: CollaborativeRouteSection[] = [];
      for (let i = 0; i < reordered.length - 1; i += 1) {
        const a = reordered[i];
        const b = reordered[i + 1];
        const old = nextSections.find((s) => s.fromPointId === b.id && s.toPointId === a.id);
        if (old) reversedSections.push(reverseSectionData(old, a, b, fp, { keepCalculated: false }));
      }
      nextSections = rebuildSectionsFromPoints(workspace.id, reordered, reversedSections, nextSport, nextOptions);
      // Les journées se lisent dans l'autre sens : la première devient la dernière, la nuit suit le lieu.
      const slots = nextStages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
      const count = slots.length;
      nextStages = slots.map((slot, idx) => {
        const src = slots[count - 1 - idx];
        const night = idx < count - 1 ? slots[count - 2 - idx] : null;
        return {
          ...slot,
          kind: src.kind,
          title: isDefaultDayTitle(src.title) ? slot.title : src.title,
          startPointId: src.endPointId,
          endPointId: src.startPointId,
          overnightPlace: night ? night.overnightPlace : null,
          notes: src.notes,
          waterObservations: src.waterObservations,
          hazards: src.hazards,
          weatherSlice: null,
          entityVersion: slot.entityVersion + 1,
        };
      });
      break;
    }

    case 'set_section_mode': {
      const ordered = activePoints(workspace);
      nextSections = nextSections.map((s) => {
        if (s.id !== op.sectionId) return s;
        const changed = {
          ...s,
          mode: op.mode,
          geometry: op.geometry ?? s.geometry,
          distanceKm: op.geometry ? lineDistanceKm(op.geometry.coordinates) : s.distanceKm,
          entityVersion: s.entityVersion + 1,
        };
        const fromPt = ordered.find((p) => p.id === s.fromPointId);
        const toPt = ordered.find((p) => p.id === s.toPointId);
        if (op.mode === 'routed' && s.mode !== 'routed' && !op.geometry && fromPt && toPt) {
          // « Revenir au calcul » : le tracé à la main reste affiché jusqu'au résultat du routeur, dit à calculer.
          return {
            ...changed,
            routingInputHash: fp(fromPt, toPt),
            pendingFingerprint: null,
            provenance: { ...s.provenance, calculatedAt: null, confidence: 'estimated' as const },
            warnings: ['Retour au calcul : tronçon à recalculer'],
          };
        }
        if (op.mode === 'manual' && s.mode !== 'manual') {
          // Tracé à la main : jamais présenté comme vérifié.
          return { ...changed, provenance: { ...s.provenance, confidence: 'unknown' as const } };
        }
        return changed;
      });
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
              elevationSamples: op.elevationSamples ?? s.elevationSamples,
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

    case 'set_shape_mode': {
      nextShapeMode = op.shapeMode;
      const beforePoints = activePoints(workspace);
      // Les points d'une forme précédente (fermeture de boucle, retour) sont retirés d'abord : changer de
      // forme, ou rappuyer sur la même, ne les empile jamais.
      const generated = new Set(beforePoints.filter((p) => /^pt-(loop-close|ret)-/.test(p.id)).map((p) => p.id));
      let ordered = beforePoints;
      if (generated.size > 0) {
        nextPoints = nextPoints.map((p) =>
          generated.has(p.id) ? { ...p, deletedAt: nowIso, entityVersion: p.entityVersion + 1 } : p,
        );
        nextSections = nextSections.filter((s) => !generated.has(s.fromPointId) && !generated.has(s.toPointId));
        ordered = beforePoints.filter((p) => !generated.has(p.id));
        nextStages = normalizeStages(repairStagesForRemovedPoints(nextStages, beforePoints, generated), ordered);
      }
      if (ordered.length >= 2) {
        const first = ordered[0];
        const last = ordered[ordered.length - 1];
        const lastStageIdx = nextStages.length
          ? nextStages.reduce((best, s, i) => (s.dayNumber >= nextStages[best].dayNumber ? i : best), 0)
          : -1;
        if (op.shapeMode === 'loop') {
          const dist = haversineKm({ lat: first.lat, lon: first.lon }, { lat: last.lat, lon: last.lon });
          if (dist > 0.05) {
            const closingPt: CollaborativeRoutePoint = {
              id: `pt-loop-close-${nextSeq}`,
              workspaceId: workspace.id,
              kind: 'finish',
              orderKey: orderKeyBetween(last.orderKey, null),
              lat: first.lat,
              lon: first.lon,
              eleM: first.eleM,
              name: `${first.name || 'Départ'} (boucle)`,
              entityVersion: 1,
            };
            nextPoints = [...nextPoints, closingPt];
            nextSections = rebuildSectionsFromPoints(
              workspace.id,
              activePoints({ ...workspace, points: nextPoints }),
              nextSections,
              nextSport,
              nextOptions,
            );
            // Le dernier jour va jusqu'à la fermeture de la boucle.
            if (lastStageIdx >= 0) {
              nextStages = nextStages.map((s, i) =>
                i === lastStageIdx ? { ...s, endPointId: closingPt.id, entityVersion: s.entityVersion + 1 } : s,
              );
            }
          }
        } else if (op.shapeMode === 'out_and_back') {
          const returnPts = ordered.slice(0, -1).reverse();
          let prevKey = last.orderKey;
          const copies: CollaborativeRoutePoint[] = returnPts.map((src, i) => {
            const k = orderKeyBetween(prevKey, null);
            prevKey = k;
            return {
              id: `pt-ret-${nextSeq}-${i}`,
              workspaceId: workspace.id,
              kind: i === returnPts.length - 1 ? 'finish' : 'via',
              orderKey: k,
              lat: src.lat,
              lon: src.lon,
              eleM: src.eleM,
              name: src.name ? `${src.name} (retour)` : null,
              entityVersion: 1,
            } as CollaborativeRoutePoint;
          });
          nextPoints = [...nextPoints, ...copies];
          const chain = [last, ...copies];
          // Le retour suit le même chemin : chaque tronçon aller est repris à l'envers (D+ et D− échangés).
          const returnSections: CollaborativeRouteSection[] = [];
          for (let k = 0; k < chain.length - 1; k += 1) {
            const outbound = nextSections.find(
              (s) =>
                s.fromPointId === ordered[ordered.length - 2 - k].id &&
                s.toPointId === ordered[ordered.length - 1 - k].id,
            );
            if (outbound) returnSections.push(reverseSectionData(outbound, chain[k], chain[k + 1], fp, { keepCalculated: true }));
          }
          nextSections = rebuildSectionsFromPoints(
            workspace.id,
            activePoints({ ...workspace, points: nextPoints }),
            [...nextSections, ...returnSections],
            nextSport,
            nextOptions,
          );
          const sorted = nextStages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
          if (sorted.length === 1 && lastStageIdx >= 0) {
            nextStages = nextStages.map((s, i) =>
              i === lastStageIdx
                ? { ...s, endPointId: chain[chain.length - 1].id, entityVersion: s.entityVersion + 1 }
                : s,
            );
          } else if (sorted.length >= 2) {
            // Plusieurs jours à l'aller : les mêmes jours, dans l'autre sens, au retour.
            const copyOf = new Map<string, string>();
            ordered.slice(0, -1).forEach((p, i) => copyOf.set(p.id, copies[ordered.length - 2 - i].id));
            copyOf.set(last.id, last.id);
            const lastDate = sorted[sorted.length - 1].dateIso;
            const mirrored: CollaborativeStage[] = sorted
              .slice()
              .reverse()
              .map((st, m) => {
                const day = sorted.length + m + 1;
                const night = m < sorted.length - 1 ? sorted[sorted.length - 2 - m].overnightPlace : null;
                return {
                  ...st,
                  id: `stage-ret-${nextSeq}-${m}`,
                  orderKey: String(day).padStart(3, '0'),
                  dayNumber: day,
                  title: isDefaultDayTitle(st.title) ? `Jour ${day}` : `${st.title} (retour)`,
                  dateIso: lastDate ? shiftIsoDate(lastDate, m + 1) : null,
                  startPointId: copyOf.get(st.endPointId) ?? st.endPointId,
                  endPointId: copyOf.get(st.startPointId) ?? st.startPointId,
                  overnightPlace: night,
                  notes: '',
                  weatherSlice: null,
                  entityVersion: 1,
                };
              });
            nextStages = [...sorted, ...mirrored];
          }
        }
      }
      break;
    }

    case 'add_variant': {
      // Jusqu'à 3 variantes comparables par portée dans le premier périmètre
      nextVariants = [...nextVariants.filter((v) => v.id !== op.variant.id), op.variant].slice(-6);
      break;
    }

    case 'apply_variant': {
      const variant = nextVariants.find((v) => v.id === op.variantId);
      if (variant) {
        // Une variante calculée avant un déplacement de point ne se recolle plus au tracé : refusée, jamais appliquée de travers.
        const pointsNow = activePoints({ ...workspace, points: nextPoints });
        for (const rep of variant.replacements) {
          const target = nextSections.find((s) => s.id === rep.sectionId);
          if (!target) return deny('Variante périmée : le tronçon concerné n’existe plus. Recréez la comparaison.');
          const first = rep.geometry.coordinates[0];
          const last = rep.geometry.coordinates[rep.geometry.coordinates.length - 1];
          const from = pointsNow.find((p) => p.id === target.fromPointId);
          const to = pointsNow.find((p) => p.id === target.toPointId);
          if (
            first &&
            last &&
            from &&
            to &&
            (distanceToKm(from, { lat: first[1], lon: first[0] }) > 0.15 || distanceToKm(to, { lat: last[1], lon: last[0] }) > 0.15)
          ) {
            return deny('Variante périmée : un point a bougé depuis son calcul. Recréez la comparaison.');
          }
        }
        const repBySec = new Map(variant.replacements.map((r) => [r.sectionId, r]));
        nextSections = nextSections.map((sec) => {
          const rep = repBySec.get(sec.id);
          if (!rep) return sec;
          return {
            ...sec,
            geometry: rep.geometry,
            distanceKm: rep.distanceKm,
            durationMin: rep.durationMin,
            ascentM: rep.ascentM,
            descentM: rep.descentM,
            // La surface et le profil d'altitude de l'ancien tracé ne valent plus pour le nouveau : inconnus.
            elevationSamples: undefined,
            surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'unknown' as const, source: null }],
            provenance: rep.provenance,
            warnings: [],
            entityVersion: sec.entityVersion + 1,
          };
        });
        nextVariants = nextVariants.map((v) =>
          v.id === op.variantId ? { ...v, status: 'accepted' } : v,
        );
      }
      break;
    }

    case 'set_sport_profile': {
      const profileChanged =
        op.sport !== workspace.sport ||
        stableHash(op.routingOptions ?? {}) !== stableHash(workspace.routingOptions ?? {});
      nextSport = op.sport;
      nextOptions = op.routingOptions;
      const ordered = activePoints(workspace);
      nextSections = nextSections.map((s) => {
        if (s.mode !== 'routed') return s;
        const fromPt = ordered.find((p) => p.id === s.fromPointId);
        const toPt = ordered.find((p) => p.id === s.toPointId);
        if (!fromPt || !toPt) return s;
        return {
          ...s,
          routingInputHash: computeRoutingFingerprint({
            from: fromPt,
            to: toPt,
            sport: nextSport,
            options: nextOptions,
          }),
          // Le tracé affiché vient de l'ancien profil : il attend le nouveau calcul, et le dit.
          ...(profileChanged
            ? {
                provenance: { ...s.provenance, calculatedAt: null, confidence: 'estimated' as const },
                warnings: ['Profil modifié : tronçon à recalculer'],
              }
            : {}),
          entityVersion: s.entityVersion + 1,
        };
      });
      break;
    }

    case 'revert_to_seq': {
      // Restaure depuis une révision publiée/cible en créant une nouvelle séquence (jamais d'effacement de l'historique).
      const targetRev = op.revisionId
        ? workspace.revisions.find((r) => r.id === op.revisionId)
        : workspace.revisions.find((r) => r.basedOnSeq === op.targetSeq || r.revisionNo === op.targetSeq);
      if (op.revisionId && !targetRev) return deny('Version introuvable : rien n’a été modifié.');
      if (targetRev) {
        // Les points d'aujourd'hui qui n'existaient pas dans cette version sont retirés, jamais effacés :
        // l'historique et le journal restent entiers, le retour est une nouvelle séquence.
        const kept = new Set(targetRev.points.map((p) => p.id));
        const currentVersion = new Map(workspace.points.map((p) => [p.id, p.entityVersion]));
        nextPoints = [
          ...workspace.points
            .filter((p) => !kept.has(p.id))
            .map((p) => (p.deletedAt ? p : { ...p, deletedAt: nowIso, entityVersion: p.entityVersion + 1 })),
          ...targetRev.points.map((p) => ({
            ...p,
            deletedAt: null,
            entityVersion: Math.max(p.entityVersion, currentVersion.get(p.id) ?? 0) + 1,
          })),
        ];
        nextSections = targetRev.sections.map((s) => ({ ...s, entityVersion: s.entityVersion + 1 }));
        nextStages = targetRev.stages.map((st) => ({ ...st, entityVersion: st.entityVersion + 1 }));
      }
      break;
    }

    case 'update_point': {
      if (!nextPoints.some((p) => p.id === op.pointId && !p.deletedAt)) return deny('Point introuvable.');
      nextPoints = nextPoints.map((p) =>
        p.id === op.pointId
          ? {
              ...p,
              name: op.name !== undefined ? (op.name?.trim() ? op.name.trim().slice(0, 120) : null) : p.name,
              note: op.note !== undefined ? (op.note?.trim() ? op.note.trim().slice(0, 500) : null) : p.note,
              entityVersion: p.entityVersion + 1,
            }
          : p,
      );
      break;
    }

    case 'split_section': {
      const secs = orderedSections();
      const sec = secs.find((s) => s.id === op.sectionId);
      if (!sec) return deny('Tronçon introuvable.');
      const pts = activePoints({ ...workspace, points: nextPoints });
      const from = pts.find((p) => p.id === sec.fromPointId);
      const to = pts.find((p) => p.id === sec.toPointId);
      if (!from || !to) return deny('Tronçon introuvable.');
      if (nextPoints.some((p) => p.id === op.pointId)) return deny('Identifiant de point déjà utilisé.');
      const loc = locateOnSections([sec], op.lat, op.lon);
      if (!loc || loc.offsetKm > 0.5) return deny('Ce lieu est trop éloigné du tronçon.');
      const via: CollaborativeRoutePoint = {
        id: op.pointId,
        workspaceId: workspace.id,
        kind: 'via',
        orderKey: orderKeyBetween(from.orderKey, to.orderKey),
        lat: loc.point[1],
        lon: loc.point[0],
        name: op.name ?? null,
        semanticKind: 'waypoint',
        entityVersion: 1,
      };
      const split = splitSectionAt(sec, loc, from, via, to, fp);
      if (!split.ok) return deny(split.reason);
      nextPoints = [...nextPoints, via];
      nextSections = [...nextSections.filter((s) => s !== sec), split.left, split.right];
      realign();
      break;
    }

    case 'merge_sections': {
      const secs = orderedSections();
      const a = secs.find((s) => s.id === op.sectionId);
      const b = secs.find((s) => s.id === op.withSectionId);
      if (!a || !b) return deny('Tronçon introuvable.');
      if (a.toPointId !== b.fromPointId) return deny('Seuls deux tronçons qui se suivent peuvent être fusionnés.');
      const pts = activePoints({ ...workspace, points: nextPoints });
      const from = pts.find((p) => p.id === a.fromPointId);
      const to = pts.find((p) => p.id === b.toPointId);
      if (!from || !to) return deny('Tronçon introuvable.');
      const shared = a.toPointId;
      if (workspace.stages.some((st) => st.startPointId === shared || st.endPointId === shared)) {
        return deny('Ce point sépare deux journées : déplacez d’abord la coupure.');
      }
      const merged = mergeSectionPair(a, b, from, to, fp);
      if (!merged.ok) return deny(merged.reason);
      nextPoints = nextPoints.map((p) =>
        p.id === shared ? { ...p, deletedAt: nowIso, entityVersion: p.entityVersion + 1 } : p,
      );
      nextSections = [...nextSections.filter((s) => s !== a && s !== b), merged.section];
      realign();
      break;
    }

    case 'cut_stage_at': {
      const days = byDay();
      const k = days.findIndex((s) => s.id === op.stageId);
      if (k < 0) return deny('Étape introuvable.');
      if (k === days.length - 1) return deny('La dernière étape n’a pas de coupure à déplacer.');
      const stage = days[k];
      const following = days[k + 1];
      if (stageKind(stage) !== 'walk' || stageKind(following) !== 'walk') {
        return deny('La coupure d’une journée de repos ou d’une étape courte ne se déplace pas.');
      }
      const placed = placePointOnTrack(op.pointId, op.lat, op.lon, op.name ?? null);
      if (!placed.ok) return deny(placed.reason);
      const pts = activePoints({ ...workspace, points: nextPoints });
      const at = (id: string) => pts.findIndex((p) => p.id === id);
      const cutIdx = at(placed.pointId);
      if (cutIdx <= at(stage.startPointId) || cutIdx >= at(following.endPointId)) {
        return deny('La coupure doit rester entre le début de l’étape et la fin de la suivante.');
      }
      const cutPt = pts[cutIdx];
      nextStages = nextStages.map((s) => {
        if (s.id === stage.id) {
          // Une nuit qui n'est plus à la coupure n'est pas gardée : « nuit à trouver », jamais un lieu faux.
          const stays = s.overnightPlace && distanceToKm(s.overnightPlace, cutPt) <= 1;
          return {
            ...s,
            endPointId: cutPt.id,
            overnightPlace: stays ? s.overnightPlace : null,
            entityVersion: s.entityVersion + 1,
          };
        }
        if (s.id === following.id) return { ...s, startPointId: cutPt.id, entityVersion: s.entityVersion + 1 };
        return s;
      });
      break;
    }

    case 'apply_stage_split': {
      const placedIds: string[] = [];
      for (const cut of op.cuts) {
        const placed = placePointOnTrack(cut.pointId, cut.lat, cut.lon, cut.name ?? null);
        if (!placed.ok) return deny(placed.reason);
        placedIds.push(placed.pointId);
      }
      const pts = activePoints({ ...workspace, points: nextPoints });
      if (pts.length < 2) return deny('Au moins deux points sont nécessaires pour découper.');
      const idxs = placedIds.map((id) => pts.findIndex((p) => p.id === id));
      const increasing = idxs.every((v, i) => v > (i === 0 ? 0 : idxs[i - 1]) && v < pts.length - 1);
      if (!increasing) return deny('Les coupures proposées ne se suivent pas sur le tracé.');
      const bounds = [pts[0].id, ...placedIds, pts[pts.length - 1].id];
      const previous = byDay();
      const firstDate = previous[0]?.dateIso ?? null;
      nextStages = bounds.slice(1).map((end, i) => {
        const prev = previous[i];
        const day = i + 1;
        return {
          id: prev?.id ?? `stage-${day}`,
          workspaceId: workspace.id,
          orderKey: String(day).padStart(3, '0'),
          dayNumber: day,
          kind: 'walk' as const,
          title: prev && !isDefaultDayTitle(prev.title) ? prev.title : `Jour ${day}`,
          dateIso: prev?.dateIso ?? (firstDate ? shiftIsoDate(firstDate, i) : null),
          departureTimeLocal: prev?.departureTimeLocal ?? previous[0]?.departureTimeLocal ?? '08:30',
          timezone: prev?.timezone ?? previous[0]?.timezone ?? 'Europe/Paris',
          startPointId: bounds[i],
          endPointId: end,
          overnightPlace: i < op.cuts.length ? op.cuts[i].overnightPlace : null,
          notes: prev?.notes ?? '',
          waterObservations: prev?.waterObservations ?? [],
          weatherSlice: null,
          hazards: prev?.hazards ?? [],
          entityVersion: (prev?.entityVersion ?? 0) + 1,
        };
      });
      break;
    }

    case 'set_stage_schedule': {
      const target = nextStages.find((s) => s.id === op.stageId);
      if (!target) return deny('Étape introuvable.');
      if (op.departureTimeLocal !== undefined && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(op.departureTimeLocal)) {
        return deny('Heure de départ invalide (attendu HH:MM).');
      }
      if (op.dateIso != null && !/^\d{4}-\d{2}-\d{2}$/.test(op.dateIso)) {
        return deny('Date invalide (attendu AAAA-MM-JJ).');
      }
      if (op.dateIso != null && shiftIsoDate(op.dateIso, 0) !== op.dateIso) return deny('Date invalide.');
      if (op.timezone !== undefined) {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: op.timezone });
        } catch {
          return deny('Fuseau horaire inconnu.');
        }
      }
      nextStages = nextStages.map((s) => {
        if (s.id === target.id) {
          return {
            ...s,
            departureTimeLocal: op.departureTimeLocal ?? s.departureTimeLocal,
            dateIso: op.dateIso !== undefined ? op.dateIso : s.dateIso,
            timezone: op.timezone ?? s.timezone,
            entityVersion: s.entityVersion + 1,
          };
        }
        if (op.chainFollowing && op.dateIso && s.dayNumber > target.dayNumber) {
          return { ...s, dateIso: shiftIsoDate(op.dateIso, s.dayNumber - target.dayNumber), entityVersion: s.entityVersion + 1 };
        }
        return s;
      });
      break;
    }

    case 'insert_rest_day': {
      const days = byDay();
      const k = days.findIndex((s) => s.id === op.afterStageId);
      if (k < 0) return deny('Étape introuvable.');
      if (k === days.length - 1) return deny('Une journée de repos se place avant la dernière étape.');
      if (days.some((s) => s.id === op.stageId)) return deny('Identifiant d’étape déjà utilisé.');
      const after = days[k];
      const rest: CollaborativeStage = {
        id: op.stageId,
        workspaceId: workspace.id,
        orderKey: '',
        dayNumber: after.dayNumber + 1,
        kind: 'rest',
        title: 'Jour de repos',
        dateIso: after.dateIso ? shiftIsoDate(after.dateIso, 1) : null,
        departureTimeLocal: after.departureTimeLocal,
        timezone: after.timezone,
        startPointId: after.endPointId,
        endPointId: after.endPointId,
        overnightPlace: after.overnightPlace,
        notes: '',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      };
      const later = days.slice(k + 1).map((s) => ({
        ...s,
        dateIso: s.dateIso ? shiftIsoDate(s.dateIso, 1) : null,
        entityVersion: s.entityVersion + 1,
      }));
      nextStages = normalizeStages([...days.slice(0, k + 1), rest, ...later], activePoints({ ...workspace, points: nextPoints }));
      break;
    }

    case 'insert_short_stage': {
      const days = byDay();
      const k = days.findIndex((s) => s.id === op.afterStageId);
      if (k < 0) return deny('Étape introuvable.');
      if (k === days.length - 1) return deny('Une étape courte se place avant la dernière étape.');
      if (days.some((s) => s.id === op.stageId)) return deny('Identifiant d’étape déjà utilisé.');
      if (nextPoints.some((p) => p.id === op.turnaroundPointId || p.id === op.returnPointId)) {
        return deny('Identifiant de point déjà utilisé.');
      }
      const after = days[k];
      const pts = activePoints({ ...workspace, points: nextPoints });
      const baseIdx = pts.findIndex((p) => p.id === after.endPointId);
      const base = pts[baseIdx];
      const following = pts[baseIdx + 1];
      if (!base || !following) return deny('Point de nuit introuvable.');
      const turnaround: CollaborativeRoutePoint = {
        id: op.turnaroundPointId,
        workspaceId: workspace.id,
        kind: 'via',
        orderKey: orderKeyBetween(base.orderKey, following.orderKey),
        lat: op.lat,
        lon: op.lon,
        name: op.name?.trim() || 'Point de demi-tour',
        semanticKind: 'waypoint',
        entityVersion: 1,
      };
      const back: CollaborativeRoutePoint = {
        id: op.returnPointId,
        workspaceId: workspace.id,
        kind: 'via',
        orderKey: orderKeyBetween(turnaround.orderKey, following.orderKey),
        lat: base.lat,
        lon: base.lon,
        eleM: base.eleM,
        name: `${base.name || 'Nuit'} (retour)`,
        semanticKind: 'waypoint',
        entityVersion: 1,
      };
      // Le tronçon qui repartait de la nuit repart désormais du retour : son tracé n'est pas touché.
      nextSections = nextSections.map((s) =>
        s.fromPointId === base.id && s.toPointId === following.id
          ? {
              ...s,
              id: `sec-${back.id}-${following.id}`,
              fromPointId: back.id,
              routingInputHash: s.mode === 'routed' ? fp(back, following) : s.routingInputHash,
              entityVersion: s.entityVersion + 1,
            }
          : s,
      );
      nextPoints = [...nextPoints, turnaround, back];
      realign();
      const short: CollaborativeStage = {
        id: op.stageId,
        workspaceId: workspace.id,
        orderKey: '',
        dayNumber: after.dayNumber + 1,
        kind: 'short',
        title: 'Étape courte',
        dateIso: after.dateIso ? shiftIsoDate(after.dateIso, 1) : null,
        departureTimeLocal: after.departureTimeLocal,
        timezone: after.timezone,
        startPointId: base.id,
        endPointId: back.id,
        overnightPlace: after.overnightPlace,
        notes: '',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      };
      const later = days.slice(k + 1).map((s) => ({
        ...s,
        startPointId: s.startPointId === base.id ? back.id : s.startPointId,
        dateIso: s.dateIso ? shiftIsoDate(s.dateIso, 1) : null,
        entityVersion: s.entityVersion + 1,
      }));
      nextStages = normalizeStages(
        [...days.slice(0, k + 1), short, ...later],
        activePoints({ ...workspace, points: nextPoints }),
      );
      break;
    }

    case 'remove_stage': {
      const days = byDay();
      const k = days.findIndex((s) => s.id === op.stageId);
      if (k < 0) return deny('Étape introuvable.');
      const target = days[k];
      const kind = stageKind(target);
      if (kind === 'walk') return deny('Seuls un jour de repos ou une étape courte se retirent : déplacez la coupure sinon.');
      let startFix: { from: string; to: string } | null = null;
      if (kind === 'short') {
        const pts = activePoints({ ...workspace, points: nextPoints });
        const baseIdx = pts.findIndex((p) => p.id === target.startPointId);
        const backIdx = pts.findIndex((p) => p.id === target.endPointId);
        if (baseIdx < 0 || backIdx !== baseIdx + 2) return deny('Le tracé de cette étape courte a changé : retirez-la depuis la carte.');
        const turnaround = pts[baseIdx + 1];
        const following = pts[backIdx + 1];
        const removed = new Set([turnaround.id, target.endPointId]);
        nextSections = nextSections
          .filter((s) => !(removed.has(s.fromPointId) && s.toPointId !== following?.id) && !removed.has(s.toPointId))
          .map((s) =>
            following && s.fromPointId === target.endPointId && s.toPointId === following.id
              ? {
                  ...s,
                  id: `sec-${target.startPointId}-${following.id}`,
                  fromPointId: target.startPointId,
                  routingInputHash:
                    s.mode === 'routed' ? fp(pts[baseIdx], following) : s.routingInputHash,
                  entityVersion: s.entityVersion + 1,
                }
              : s,
          );
        nextPoints = nextPoints.map((p) =>
          removed.has(p.id) ? { ...p, deletedAt: nowIso, entityVersion: p.entityVersion + 1 } : p,
        );
        startFix = { from: target.endPointId, to: target.startPointId };
        realign();
      }
      const later = days.slice(k + 1).map((s) => ({
        ...s,
        startPointId: startFix && s.startPointId === startFix.from ? startFix.to : s.startPointId,
        dateIso: s.dateIso ? shiftIsoDate(s.dateIso, -1) : null,
        entityVersion: s.entityVersion + 1,
      }));
      nextStages = normalizeStages(
        [...days.slice(0, k), ...later],
        activePoints({ ...workspace, points: nextPoints }),
      );
      break;
    }

    case 'import_track': {
      if (op.points.length < 2 || op.sections.length !== op.points.length - 1) {
        return deny('Trace importée incomplète : au moins deux points et un tronçon entre chaque.');
      }
      const incoming = op.points
        .slice()
        .sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : a.id.localeCompare(b.id)));
      const chained = incoming
        .slice(0, -1)
        .every((p, i) => op.sections.some((s) => s.fromPointId === p.id && s.toPointId === incoming[i + 1].id));
      if (!chained) return deny('Trace importée incohérente : les tronçons ne suivent pas les points.');
      // Un identifiant repris par la trace remplace l'ancien point : jamais deux points au même identifiant.
      const incomingIds = new Set(incoming.map((p) => p.id));
      nextPoints = [
        ...workspace.points
          .filter((p) => !incomingIds.has(p.id))
          .map((p) => (p.deletedAt ? p : { ...p, deletedAt: nowIso, entityVersion: p.entityVersion + 1 })),
        ...incoming.map((p) => ({ ...p, workspaceId: workspace.id })),
      ];
      nextSections = incoming
        .slice(0, -1)
        .map((p, i) => op.sections.find((s) => s.fromPointId === p.id && s.toPointId === incoming[i + 1].id))
        .filter((s): s is CollaborativeRouteSection => Boolean(s))
        .map((s) => ({ ...s, workspaceId: workspace.id }));
      const firstStage = byDay()[0];
      nextStages = [
        {
          id: firstStage?.id ?? 'stage-1',
          workspaceId: workspace.id,
          orderKey: '001',
          dayNumber: 1,
          kind: 'walk',
          title: firstStage?.title ?? 'Jour 1',
          dateIso: firstStage?.dateIso ?? null,
          departureTimeLocal: firstStage?.departureTimeLocal ?? '08:30',
          timezone: firstStage?.timezone ?? 'Europe/Paris',
          startPointId: incoming[0].id,
          endPointId: incoming[incoming.length - 1].id,
          overnightPlace: null,
          notes: firstStage?.notes ?? '',
          waterObservations: [],
          weatherSlice: null,
          hazards: [],
          entityVersion: (firstStage?.entityVersion ?? 0) + 1,
        },
      ];
      nextSourceOrigin = op.sourceOrigin;
      nextShapeMode = 'one_way';
      break;
    }
  }

  const nextComments = relocateOrFlagComments(workspace.comments, nextPoints, nextSections);
  const candidateWorkspace: RouteWorkspaceState = {
    ...workspace,
    sport: nextSport,
    shapeMode: nextShapeMode,
    routingOptions: nextOptions,
    sourceOrigin: nextSourceOrigin,
    headSeq: nextSeq,
    points: nextPoints,
    sections: nextSections,
    stages: nextStages,
    variants: nextVariants,
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
