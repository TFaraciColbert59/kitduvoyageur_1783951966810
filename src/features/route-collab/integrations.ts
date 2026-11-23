import type { RouteRevisionSnapshot as ClubRouteRevisionSnapshot } from '@/features/clubs/types';
import type { TrailMessageMeta } from '@/features/messaging/types/messaging.types';
import { MAX_ROUTE_WAYPOINTS } from '@/features/adventure-prep/routeProfiles';
import {
  MAX_REVISION_GEOMETRY_POINTS,
  lineStringFromSections,
  routeGeometryDistanceKm,
  simplifyRouteGeometry,
  type RouteRevision,
  type RouteRevisionPoint,
  type RouteSection,
} from '@/features/adventure-prep/routeRevision';
import { workspaceTotals } from './engine';
import { buildItineraryHref } from './insights/deepLinks';
import type { CarnetReturnRecord } from './offlinePackStore';
import { activePointsOf } from './pointOrder';
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

/* =============================================================================
   Un seul tracé par voyage (P4 / 10.1)

   Règle de vérité : quand un espace d'itinéraire est PUBLIÉ pour un voyage, sa version publiée gagne.
   `trips.metadata.compas.routeDraft` n'est alors qu'une copie dérivée de cette version (lecture seule
   côté éditeur du Compas, qui propose « Ouvrir dans l'itinéraire »). Une seule écriture passe par
   `writeTripRouteDraft` (features/compas/server/routeDraftWrite.ts), la même que `compasSaveRouteDraftAction`.
   La lecture inverse (routeDraft → espace) est `compasDraft.ts`.
   ============================================================================= */

/** Moteur inscrit sur un routeDraft dérivé d'une version publiée (reconnaît la copie, évite les réécritures). */
export const PUBLISHED_ROUTE_ENGINE = 'lkdv-route-collab/published';

/** Version publiée de l'espace (celle que le HUB, le Compas et les Clubs lisent), ou `null`. */
export function publishedRevisionOf(workspace: RouteWorkspaceState): RouteRevisionSnapshot | null {
  if (workspace.publishedRevisionNo == null && !workspace.publishedRevisionId) return null;
  const byId = workspace.publishedRevisionId
    ? workspace.revisions.find((r) => r.id === workspace.publishedRevisionId)
    : undefined;
  const byNo = workspace.revisions.find(
    (r) => r.kind === 'published' && r.revisionNo === workspace.publishedRevisionNo,
  );
  return byId ?? byNo ?? null;
}

/** L'espace publié le plus récent d'un voyage (plusieurs espaces par voyage possibles : le dernier publié gagne). */
export function pickPublishedWorkspaceForTrip(
  workspaces: readonly RouteWorkspaceState[],
  tripId: string,
): RouteWorkspaceState | null {
  let best: { ws: RouteWorkspaceState; at: string } | null = null;
  for (const ws of workspaces) {
    if (ws.tripId !== tripId) continue;
    const rev = publishedRevisionOf(ws);
    if (!rev) continue;
    if (!best || rev.createdAt > best.at) best = { ws, at: rev.createdAt };
  }
  return best?.ws ?? null;
}

/** Réduit une liste de points à `max` en gardant départ, arrivée et un échantillon régulier des passages. */
function limitIndices(count: number, max: number): number[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const out = new Set<number>([0, count - 1]);
  const step = (count - 1) / (max - 1);
  for (let i = 1; i < max - 1; i += 1) out.add(Math.round(i * step));
  return [...out].sort((a, b) => a - b);
}

/**
 * Version publiée → `RouteRevision` (le `routeDraft` du Compas). Pur et déterministe : mêmes entrées, même
 * sortie (donc idempotent). Les tronçons `routed` restent calculés, `manual` et `imported_preserved`
 * deviennent `manual` (le Compas ne connaît pas d'autre mode : on ne les fait jamais passer pour un chemin
 * calculé). L'éditeur du Compas porte au plus 12 points : au-delà, on garde départ, arrivée et un
 * échantillon régulier, sans découpage en tronçons (la ligne entière reste exacte) et on le dit.
 * `null` si la version publiée n'a pas de tracé exploitable.
 */
export function publishedRevisionToRouteDraft(
  revision: Pick<RouteRevisionSnapshot, 'id' | 'revisionNo' | 'createdAt' | 'points' | 'sections'>,
  sport: RouteRevision['sport'],
): RouteRevision | null {
  const ordered = activePointsOf({ points: revision.points });
  if (ordered.length < 2) return null;
  const sectionByFrom = new Map(revision.sections.map((s) => [s.fromPointId, s]));

  // Tronçons consécutifs entre points actifs ; un trou rend le découpage inutilisable (on garde la ligne).
  const chain: Array<(typeof revision.sections)[number]> = [];
  let contiguous = true;
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const s = sectionByFrom.get(ordered[i].id);
    if (!s || s.toPointId !== ordered[i + 1].id) {
      contiguous = false;
      break;
    }
    chain.push(s);
  }

  const warnings: string[] = [];
  const keep = limitIndices(ordered.length, MAX_ROUTE_WAYPOINTS);
  const reduced = keep.length < ordered.length;
  if (reduced) warnings.push(`Tracé réduit à ${keep.length} points pour l'éditeur du Compas (${ordered.length} dans l'itinéraire).`);

  const points: RouteRevisionPoint[] = keep.map((idx, n) => {
    const p = ordered[idx];
    return {
      id: p.id.slice(0, 40),
      lat: p.lat,
      lon: p.lon,
      kind: n === 0 ? 'start' : n === keep.length - 1 ? 'end' : 'via',
      ...(p.name ? { name: p.name.slice(0, 80) } : {}),
      ...(p.semanticKind ? { semanticKind: p.semanticKind } : {}),
      ...(p.note ? { note: p.note.slice(0, 280) } : {}),
    };
  });

  const coordsOf = (s: (typeof revision.sections)[number]) =>
    s.geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]);
  const sections: RouteSection[] =
    contiguous && !reduced
      ? chain.map((s, i) => {
          const manual = s.mode !== 'routed';
          const geometry = { type: 'LineString' as const, coordinates: coordsOf(s) };
          return {
            id: s.id.slice(0, 80),
            mode: manual ? ('manual' as const) : ('routed' as const),
            fromIndex: i,
            toIndex: i + 1,
            geometry,
            distanceKm: manual ? Number(routeGeometryDistanceKm(geometry).toFixed(3)) : s.distanceKm,
            durationMin: manual ? null : s.durationMin,
            provider: manual ? null : (s.provenance.provider ?? null),
          };
        })
      : [];

  const lineSource = contiguous && chain.length > 0 ? chain : revision.sections;
  const rawLine =
    sections.length > 0
      ? lineStringFromSections(sections)
      : {
          type: 'LineString' as const,
          coordinates: lineSource.flatMap((s) => coordsOf(s)),
        };
  if (rawLine.coordinates.length < 2) return null;
  const geometry = simplifyRouteGeometry(rawLine, Math.min(MAX_REVISION_GEOMETRY_POINTS, 5000));

  const distanceKm = Number(
    (contiguous ? chain : revision.sections).reduce((acc, s) => acc + s.distanceKm, 0).toFixed(2),
  );
  const durations = (contiguous ? chain : revision.sections).map((s) => s.durationMin);
  const durationMin = durations.length > 0 && durations.every((d) => d != null)
    ? Math.round(durations.reduce<number>((a, d) => a + (d ?? 0), 0))
    : null;
  const providers = new Set(revision.sections.map((s) => s.provenance.provider).filter((p): p is string => Boolean(p)));

  return {
    // Identité de la version : une même version publiée donne le même id (idempotence de l'écriture).
    id: `rev-${revision.id}`.slice(0, 80),
    version: Math.min(Math.max(1, Math.trunc(revision.revisionNo)), 10_000),
    sport,
    engine: PUBLISHED_ROUTE_ENGINE,
    savedAt: revision.createdAt,
    points,
    geometry,
    sections,
    distanceKm,
    durationMin,
    provider: providers.size === 1 ? [...providers][0].slice(0, 40) : null,
    warnings,
  };
}

/** Faut-il (ré)écrire le routeDraft ? Non si la copie courante vient déjà de cette version publiée. */
export function routeDraftNeedsSync(current: Pick<RouteRevision, 'id' | 'engine'> | null, next: Pick<RouteRevision, 'id'>): boolean {
  return !(current && current.engine === PUBLISHED_ROUTE_ENGINE && current.id === next.id);
}

/* =============================================================================
   Le HUB lit la version publiée (10.3)
   ============================================================================= */

export interface PublishedRouteHubSummary {
  readonly workspaceId: string;
  readonly tripId: string;
  readonly title: string;
  readonly revisionNo: number;
  readonly publishedAt: string;
  readonly publishedByName: string;
  /** Chiffres de la VERSION PUBLIÉE (pas du brouillon en cours). */
  readonly distanceKm: number;
  readonly stagesCount: number;
  /** Objets du sac à revérifier depuis la dernière publication. */
  readonly kitRevalidationCount: number;
  readonly participantsReadyCount: number;
  readonly participantsTotalCount: number;
  /** Le brouillon a avancé depuis la version publiée : le HUB montre la version publiée, pas le brouillon. */
  readonly hasNewerDraft: boolean;
  /** Ouvre l'atelier sur ce voyage : « Modifier dans le Compas ». */
  readonly href: string;
}

/** Résumé HUB d'un espace, lu sur sa version publiée ; `null` s'il n'en a pas. */
export function summarizePublishedRouteForHub(workspace: RouteWorkspaceState): PublishedRouteHubSummary | null {
  const rev = publishedRevisionOf(workspace);
  if (!rev) return null;
  const distanceKm = Number(rev.sections.reduce((acc, s) => acc + s.distanceKm, 0).toFixed(2));
  const kitRevalidationCount = workspace.kitItems.filter((i) => i.status === 'needs_revalidation').length;
  const participantsReadyCount = workspace.participantPacks.filter(
    (p) => p.status === 'ready' && p.downloadedRevisionNo === rev.revisionNo,
  ).length;
  return {
    workspaceId: workspace.id,
    tripId: workspace.tripId,
    title: workspace.title,
    revisionNo: rev.revisionNo,
    publishedAt: rev.createdAt,
    publishedByName: rev.createdByName,
    distanceKm,
    stagesCount: rev.stages.length,
    kitRevalidationCount,
    participantsReadyCount,
    participantsTotalCount: workspace.participantPacks.length,
    hasNewerDraft: workspace.headSeq > rev.basedOnSeq,
    href: workspace.tripId ? buildItineraryHref({ tripId: workspace.tripId }) : `/compas/itineraire?workspaceId=${encodeURIComponent(workspace.id)}`,
  };
}
