import type { RouteRevisionSnapshot as ClubRouteRevisionSnapshot } from '@/features/clubs/types';
import type { TrailMessageMeta } from '@/features/messaging/types/messaging.types';
import { workspaceTotals } from './engine';
import type { CarnetReturnRecord } from './offlinePackStore';
import type {
  CollaborativeKitItem,
  RouteRevisionSnapshot,
  RouteWorkspaceState,
} from './types';

/**
 * Pont Clubs : associe une révision publiée immuable à une sortie de club (C3.3 / C3.5).
 * Ne confère aucun droit d'édition (`route.edit_geometry`) aux inscrits RSVP.
 */
export function toClubRouteRevisionSnapshot(
  revision: RouteRevisionSnapshot,
  eventId: string,
  checksum: string,
  requiresParticipantDecision = true,
): ClubRouteRevisionSnapshot {
  const distKm = revision.sections.reduce((acc, s) => acc + s.distanceKm, 0);
  const elevM = revision.sections.reduce((acc, s) => acc + (s.ascentM ?? 0), 0);
  return {
    eventId,
    routeId: revision.workspaceId,
    revision: revision.revisionNo,
    checksum,
    distanceM: Math.round(distKm * 1000),
    elevationGainM: Math.round(elevM),
    updatedBy: revision.createdBy,
    updatedAt: revision.createdAt,
    requiresParticipantDecision,
  };
}

/**
 * Pont Messagerie : produit un payload `TrailMessageMeta` relié à la bonne version
 * et au jeton de partage autorisé (C4.4).
 */
export function toTrailMessageMeta(workspace: RouteWorkspaceState): TrailMessageMeta {
  const totals = workspaceTotals(workspace);
  const coords = workspace.sections.flatMap((s) => s.geometry.coordinates);
  return {
    kind: 'trail',
    id: workspace.id,
    name: workspace.title,
    distance_km: totals.distanceKm,
    elevation_gain_m: totals.ascentM,
    workspace_id: workspace.id,
    revision_no: workspace.publishedRevisionNo,
    share_token: workspace.shareLink && !workspace.shareLink.revokedAt ? workspace.shareLink.token : null,
    geojson: coords.length >= 2 ? { type: 'LineString', coordinates: coords } : undefined,
  };
}

/**
 * Pont Inventaire : réutilise un objet personnel par son identifiant sans dupliquer
 * sa définition locale (K1.4 / K4.2).
 */
export function inventoryItemToCollabKitItem(input: {
  inventoryItemId: string;
  name: string;
  category: string;
  weightGrams: number | null;
  quantity?: number;
  ownerUserId: string;
  ownerDisplayName: string;
  shared?: boolean;
  dependsOn?: readonly ('overnight' | 'water' | 'weather' | 'duration' | 'distance')[];
}): CollaborativeKitItem {
  return {
    id: `kit-${input.inventoryItemId}`,
    inventoryItemId: input.inventoryItemId,
    name: input.name,
    category: input.category,
    weightGrams: input.weightGrams,
    quantity: input.quantity ?? 1,
    shared: input.shared ?? false,
    assigneeUserId: input.ownerUserId,
    assigneeName: input.ownerDisplayName,
    dependsOn: input.dependsOn ?? [],
    status: 'confirmed',
  };
}

/**
 * Pont Hub : résumé léger du plan, de la version de départ et des vérifications matériel.
 */
export function summarizeWorkspaceForHub(workspace: RouteWorkspaceState): {
  workspaceId: string;
  title: string;
  publishedRevisionNo: number | null;
  totalDistanceKm: number;
  stagesCount: number;
  kitRevalidationCount: number;
  participantsReadyCount: number;
  participantsTotalCount: number;
  href: string;
} {
  const totals = workspaceTotals(workspace);
  const kitRevalidationCount = workspace.kitItems.filter(
    (i) => i.status === 'needs_revalidation',
  ).length;
  const participantsReadyCount = workspace.participantPacks.filter(
    (p) => p.status === 'ready' && p.downloadedRevisionNo === workspace.publishedRevisionNo,
  ).length;
  return {
    workspaceId: workspace.id,
    title: workspace.title,
    publishedRevisionNo: workspace.publishedRevisionNo,
    totalDistanceKm: totals.distanceKm,
    stagesCount: workspace.stages.length,
    kitRevalidationCount,
    participantsReadyCount,
    participantsTotalCount: workspace.participantPacks.length,
    href: `/compas/itineraire?workspaceId=${encodeURIComponent(workspace.id)}`,
  };
}

/**
 * Pont Carnet : compare le plan figé au départ (révision N + kit snapshot)
 * avec la trace réellement enregistrée, sans jamais être altéré par une publication N+1.
 */
export function buildCarnetComparisonView(
  record: CarnetReturnRecord,
  workspace: RouteWorkspaceState,
): {
  plannedRevisionNo: number;
  latestPublishedRevisionNo: number | null;
  plannedDistanceKm: number | null;
  recordedDistanceKm: number;
  deltaDistanceKm: number | null;
  kitItemsCount: number;
  kitTotalWeightGrams: number;
  unchangedByNewerRevision: boolean;
} {
  const rev = workspace.revisions.find((r) => r.id === record.plannedRevisionId);
  const plannedDistanceKm = rev
    ? Number(rev.sections.reduce((acc, s) => acc + s.distanceKm, 0).toFixed(2))
    : null;
  const kitTotalWeightGrams = record.kitSnapshot.reduce(
    (acc, item) => acc + (item.weightGrams ?? 0) * item.quantity,
    0,
  );
  return {
    plannedRevisionNo: record.plannedRevisionNo,
    latestPublishedRevisionNo: workspace.publishedRevisionNo,
    plannedDistanceKm,
    recordedDistanceKm: record.recordedDistanceKm,
    deltaDistanceKm:
      plannedDistanceKm != null
        ? Number((record.recordedDistanceKm - plannedDistanceKm).toFixed(2))
        : null,
    kitItemsCount: record.kitSnapshot.length,
    kitTotalWeightGrams,
    unchangedByNewerRevision:
      workspace.publishedRevisionNo == null ||
      workspace.publishedRevisionNo >= record.plannedRevisionNo,
  };
}
