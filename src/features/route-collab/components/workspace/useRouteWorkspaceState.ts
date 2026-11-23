import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImportableTrackEntry } from '@/app/api/routes/history/route';
import type { MapBase } from '@/features/compas/engine/mapStyle';
import { readTraceFile } from '@/features/community/v2/create/carnet/gpx';
import type { Detent } from '@/features/explorer-v2/state/types';
import { getCurrentGeoPosition } from '@/lib/native/geolocation';
import { haversineKm } from '@/features/adventure-prep/engine/routing';
import {
  activePoints,
  applyWorkspaceOperation,
  buildElevationProfile,
  computeRoutingFingerprint,
  exportWorkspaceGpx,
  parseGpxToWorkspaceEntities,
  publishWorkspaceRevision,
  workspaceTotals,
} from '../../engine';
import { summarizeWorkspaceForHub } from '../../integrations';
import {
  computeTechnicalTerrainStats,
  fetchRouteKnowledgeBank,
  type LiveWeatherInfo,
  type NearbyLkdvRoute,
  type RouteCorridorPoi,
  type RoutePoiCategory,
} from '../../routeAnalysis';
import {
  commitVerifiedPack,
  duplicateWorkspaceWithProvenance,
  enqueueOfflineOperation,
  finishActivityToCarnet,
  getActiveActivityLink,
  getLastVerifiedPack,
  listOfflineQueue,
  replayOfflineQueue,
  stagePackDownload,
  startActivityFromRevision,
  type CarnetReturnRecord,
} from '../../offlinePackStore';
import { hasRoutePermission } from '../../permissions';
import type {
  ApplyOperationResult,
  CollaborativeKitItem,
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  DomainConflict,
  PresenceEntry,
  RouteOperationInput,
  RouteOperationRecord,
  RouteProposal,
  RouteVariant,
  RouteWorkspaceState,
  ShareLinkConfig,
} from '../../types';
import { resolveDeepLinkTarget } from '../../entry';
import { buildProfileModel, nearestProfileIndex, readProfileAt, type ProfileReadout } from '../../profileLink';
import { planLineDrag, planPointInsertion, type PointRole } from '../../pointInsertion';
import { useOpTracker } from './chrome/useOpTracker';
import { ROLE_LABELS } from './labels';
import { routingQueryParams } from '../../routingProfiles';
import { describeRoutingFailure, type RoutingIssue } from '../../mapStart';
import { useRouteEntry } from './start/RouteEntryContext';
import { isRealTripId } from '../../startPersist';
import { handoffFromRevision, writeHandoff } from '../../depart/activityHandoff';
import { useRouteRealtime } from './useRouteRealtime';
import {
  COMMENT_TARGET_LABEL,
  DEFAULT_SHARE_LINK_HOURS,
  anchorFor,
  commentAnchorLabel,
  conflictProposalTitle,
  firstNameOf,
  nextStageScope,
  type CommentTarget,
  type InvitableCollaborator,
} from '../../team';
import { describeOperation } from '../../undo';
import type { SubDrawerId, RouteCollabWorkspaceProps } from './types';

/** Lecture de sécurité quand Broadcast est ouvert : rattrape un message perdu sans solliciter la base toutes les secondes. */
const REALTIME_SAFETY_POLL_MS = 20_000;

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export function useRouteWorkspaceState({
  initialWorkspace,
  currentUserId,
  currentUserName,
  serverSynced = false,
  shareToken = null,
  forceNoWebGL = false,
  initialSheetOpen = false,
  onWorkspaceChange,
}: RouteCollabWorkspaceProps) {
  const [workspace, setWorkspace] = useState<RouteWorkspaceState>(initialWorkspace);
  const [opLog, setOpLog] = useState<readonly RouteOperationRecord[]>([]);
  // Présence lue sur le serveur (repli) ; la présence affichée est `presence`, plus bas (Broadcast quand il est ouvert).
  const [polledPresence, setPresence] = useState<readonly PresenceEntry[]>([]);

  // État du tiroir Explorer (pilule 3 points -> tiroir principal -> sous-tiroirs)
  const [sheetOpen, setSheetOpen] = useState<boolean>(forceNoWebGL || initialSheetOpen);
  const [detent, setDetent] = useState<Detent>('low');
  const [tabIndex, setTabIndex] = useState<number>(0);
  const [subDrawer, setSubDrawer] = useState<SubDrawerId | null>(null);

  // État carte piloté en haut à droite de la carte (hors tiroirs)
  const [mapBase, setMapBase] = useState<MapBase>('topo');
  const [mapMenuOpen, setMapMenuOpen] = useState<boolean>(false);
  const [fitTrigger, setFitTrigger] = useState<number>(0);
  const [focusCoord, setFocusCoord] = useState<[number, number] | null>(null);
  const [listMode, setListMode] = useState<boolean>(forceNoWebGL);
  const [webglAvailable, setWebglAvailable] = useState<boolean>(!forceNoWebGL);

  // Outils de dessin & d'édition sur carte (identiques à la création Communauté)
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [editingMode, setEditingMode] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<RouteWorkspaceState[]>([]);
  const [redoStack, setRedoStack] = useState<RouteWorkspaceState[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Import depuis Historique (sorties, carnets, randonnées enregistrées)
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyItems, setHistoryItems] = useState<ImportableTrackEntry[] | null>(null);

  // Banque d'informations & statistiques techniques (onglet Analyser & Étapes)
  const [knowledgeLoading, setKnowledgeLoading] = useState<boolean>(false);
  const [knowledgePois, setKnowledgePois] = useState<RouteCorridorPoi[]>([]);
  const [liveWeather, setLiveWeather] = useState<LiveWeatherInfo | null>(null);
  const [nearbyRoutes, setNearbyRoutes] = useState<NearbyLkdvRoute[]>([]);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [knowledgeSources, setKnowledgeSources] = useState<string[]>([]);
  const [focusedPoiId, setFocusedPoiId] = useState<string | null>(null);
  const [poiFilter, setPoiFilter] = useState<'all' | RoutePoiCategory>('all');
  const [analyserSection, setAnalyserSection] = useState<'terrain' | 'milieu' | 'chemin'>(
    'terrain'
  );

  // Équipe : recherche membres LKDV & invitation rapide
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userSearchResults, setUserSearchResults] = useState<
    Array<{
      id: string;
      full_name: string | null;
      location: string | null;
      trust_score: number | null;
    }>
  >([]);
  const [userSearchLoading, setUserSearchLoading] = useState<boolean>(false);
  // 8.1 : collaborateurs du voyage pas encore sur l'itinéraire
  const [invitable, setInvitable] = useState<readonly InvitableCollaborator[]>([]);
  const [invitableLoading, setInvitableLoading] = useState<boolean>(false);
  // 8.9 : le jeton d'un lien de partage n'est renvoyé qu'à la création ; il vit ici, en mémoire, jamais relu.
  const [freshShareToken, setFreshShareToken] = useState<string | null>(null);

  // Départ : vérifications manuelles complémentaires
  const [departChecks, setDepartChecks] = useState<{
    track: boolean;
    weather: boolean;
    safety: boolean;
  }>({ track: true, weather: false, safety: false });
  const [overlayDetail, setOverlayDetail] = useState<
    | { kind: 'day'; stageId: string; precision: 1 | 2 | 3 }
    | { kind: 'point'; pointId: string; stageId?: string; precision: 1 | 2 | 3 }
    | { kind: 'poi'; poi: RouteCorridorPoi; stageId?: string; precision: 1 | 2 }
    | { kind: 'kit'; stageId?: string; precision: 1 | 2 }
    | null
  >(null);

  // Sélections synchronisées Carte <-> Tiroir
  const [selectedStageId, setSelectedStageId] = useState<string | null>(
    initialWorkspace.stages[0]?.id ?? null
  );
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [hoveredCoord, setHoveredCoord] = useState<[number, number] | null>(null);
  const [comparedVariantId, setComparedVariantId] = useState<string | null>(null);

  // Réseau, impacts, conflits, formulaires
  const [online, setOnline] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.navigator.onLine : true
  );
  const [lastImpactText, setLastImpactText] = useState<string | null>(null);
  const [routingBusy, setRoutingBusy] = useState<boolean>(false);
  // Dernier échec réel du routeur (texte + code brut) : la carte le dit tant que des tronçons restent non calculés.
  const [routingIssue, setRoutingIssue] = useState<(RoutingIssue & { sectionId: string }) | null>(null);
  const [activeConflict, setActiveConflict] = useState<{
    conflict: DomainConflict;
    pendingOp: RouteOperationInput;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [gpxInput, setGpxInput] = useState<string>('');
  const [keepOriginalGpx, setKeepOriginalGpx] = useState<boolean>(true);
  const [commentBody, setCommentBody] = useState<string>('');
  const [proposalTitle, setProposalTitle] = useState<string>('');
  const [proposalRationale, setProposalRationale] = useState<string>('');
  const [proposalDraft, setProposalDraft] = useState<{
    operations: readonly RouteOperationInput[];
    summary: string;
  } | null>(null);
  const [stageNotesDraft, setStageNotesDraft] = useState<string>('');
  const [carnetRecord, setCarnetRecord] = useState<CarnetReturnRecord | null>(null);
  const [publishSyncIssue, setPublishSyncIssue] = useState<{ id: number; message: string } | null>(null);
  const [offlineTick, setOfflineTick] = useState<number>(0);
  // Carte (catégorie 2) : relevé des calques par sport (2.7), curseur profil <-> carte (2.6)
  const [knowledgeLoadedAt, setKnowledgeLoadedAt] = useState<string | null>(null);
  const [profileCursor, setProfileCursor] = useState<number | null>(null);
  const entry = useRouteEntry();
  // Suivi des opérations : accusés serveur, file hors ligne, journal des gestes annulables (3.4 à 3.6)
  const opTracker = useOpTracker({ serverSynced, initialHeadSeq: initialWorkspace.headSeq });
  const {
    begin: trackBegin,
    settle: trackSettle,
    acked: trackAcked,
    failed: trackFailed,
    record: trackRecord,
    replayed: trackReplayed,
  } = opTracker;

  const headSeqRef = useRef(workspace.headSeq);
  headSeqRef.current = workspace.headSeq;
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const opLogRef = useRef(opLog);
  opLogRef.current = opLog;

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!lastImpactText) return;
    const timer = window.setTimeout(() => setLastImpactText(null), 2000);
    return () => window.clearTimeout(timer);
  }, [lastImpactText]);

  useEffect(() => {
    if (forceNoWebGL) {
      setWebglAvailable(false);
      setListMode(true);
      setSheetOpen(true);
      return;
    }
    const ok = detectWebGL();
    setWebglAvailable(ok);
    if (!ok) {
      setListMode(true);
      setSheetOpen(true);
    }
  }, [forceNoWebGL]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    setOnline(window.navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const commitState = useCallback(
    (next: RouteWorkspaceState, recordUndo = true) => {
      if (recordUndo) {
        setUndoStack((prev) => [...prev.slice(-49), workspaceRef.current]);
        setRedoStack([]);
      }
      workspaceRef.current = next;
      headSeqRef.current = next.headSeq;
      setWorkspace(next);
      onWorkspaceChange?.(next);
    },
    [onWorkspaceChange]
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setRedoStack((r) => [...r, workspace]);
      setWorkspace(previous);
      onWorkspaceChange?.(previous);
      setStatusMessage('Dernière action annulée.');
      return prev.slice(0, -1);
    });
  }, [onWorkspaceChange, workspace]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setUndoStack((u) => [...u, workspace]);
      setWorkspace(next);
      onWorkspaceChange?.(next);
      setStatusMessage('Action rétablie.');
      return prev.slice(0, -1);
    });
  }, [onWorkspaceChange, workspace]);

  // Synchronisation : Broadcast (8.8) annonce les nouvelles versions et la présence ; la lecture périodique de
  // `/changes` reste le filet (rythme lent quand Broadcast est ouvert, rythme d'origine s'il est indisponible).
  const pollNowRef = useRef<() => void>(() => undefined);
  const realtime = useRouteRealtime({
    enabled: !!serverSynced && online && !shareToken,
    workspaceId: workspace.id,
    userId: currentUserId,
    userName: currentUserName,
    members: workspace.members,
    activeStageId: selectedStageId,
    selectedEntityId: selectedPointId ?? selectedSectionId,
    mode: selectedPointId ? 'editing' : 'viewing',
    headSeq: workspace.headSeq,
    onNewVersion: () => pollNowRef.current(),
  });
  const realtimeLive = realtime.status === 'live';
  // Broadcast ne renvoie pas ses propres messages : on se rajoute, comme le faisait la présence serveur.
  const livePresence = useMemo<readonly PresenceEntry[]>(
    () => [
      {
        userId: currentUserId,
        displayName: currentUserName,
        activeStageId: selectedStageId,
        selectedEntityId: selectedPointId ?? selectedSectionId,
        softLockEntityId: null,
        softLockExpiresAt: null,
        mode: selectedPointId ? 'editing' : 'viewing',
        lastSeenAt: new Date().toISOString(),
      },
      ...realtime.presence,
    ],
    [currentUserId, currentUserName, selectedStageId, selectedPointId, selectedSectionId, realtime.presence]
  );
  const presence: readonly PresenceEntry[] = realtimeLive ? livePresence : polledPresence;
  const announceVersion = realtime.announceVersion;

  useEffect(() => {
    if (!serverSynced || !online) return;
    let active = true;
    const tokenQs = shareToken ? `&token=${encodeURIComponent(shareToken)}` : '';

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/routes/${encodeURIComponent(workspace.id)}/changes?after=${headSeqRef.current}${tokenQs}`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!active) return;
        if (res.status === 403 || res.status === 401) {
          setStatusMessage('Votre accès à cet itinéraire a été révoqué ou a expiré.');
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          headSeq: number;
          workspace: RouteWorkspaceState;
          presence?: PresenceEntry[];
        };
        if (data.workspace) trackAcked(data.workspace.headSeq);
        if (data.presence) setPresence(data.presence);
        if (
          data.workspace &&
          (data.workspace.headSeq !== headSeqRef.current ||
            data.workspace.updatedAt !== workspace.updatedAt)
        ) {
          commitState(data.workspace);
        }
      } catch {
        /* perte réseau gérée proprement */
      }
    };

    pollNowRef.current = () => void poll();
    const timer = window.setInterval(() => void poll(), realtimeLive ? REALTIME_SAFETY_POLL_MS : 1200);
    return () => {
      active = false;
      pollNowRef.current = () => undefined;
      window.clearInterval(timer);
    };
  }, [serverSynced, online, workspace.id, workspace.updatedAt, shareToken, commitState, trackAcked, realtimeLive]);

  // Présence légère (étape active + entité sélectionnée) : repli HTTP, seulement si Broadcast n'est pas ouvert.
  useEffect(() => {
    if (!serverSynced || !online || shareToken || realtimeLive) return;
    void fetch(`/api/routes/${encodeURIComponent(workspace.id)}/presence`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activeStageId: selectedStageId,
        selectedEntityId: selectedPointId ?? selectedSectionId,
        softLockEntityId: selectedPointId,
        mode: selectedPointId ? 'editing' : 'viewing',
      }),
    }).catch(() => undefined);
  }, [
    serverSynced,
    online,
    shareToken,
    realtimeLive,
    workspace.id,
    selectedStageId,
    selectedPointId,
    selectedSectionId,
  ]);

  const currentMember = useMemo(
    () => workspace.members.find((m) => m.userId === currentUserId) ?? null,
    [workspace.members, currentUserId]
  );
  const canEditGeo = !shareToken && hasRoutePermission(currentMember, 'route.edit_geometry');
  const canEditStages = !shareToken && hasRoutePermission(currentMember, 'route.edit_stages');
  const canComment = !shareToken && hasRoutePermission(currentMember, 'route.comment');
  const canPropose = !shareToken && hasRoutePermission(currentMember, 'route.propose');
  const canReview = !shareToken && hasRoutePermission(currentMember, 'route.review');
  const canPublish = !shareToken && hasRoutePermission(currentMember, 'route.publish');
  const canManageMembers = !shareToken && hasRoutePermission(currentMember, 'route.manage_members');

  const orderedPoints = useMemo(() => activePoints(workspace), [workspace]);
  const totals = useMemo(() => workspaceTotals(workspace), [workspace]);
  const elevation = useMemo(() => buildElevationProfile(workspace), [workspace]);
  const selectedStage = useMemo(
    () => workspace.stages.find((s) => s.id === selectedStageId) ?? workspace.stages[0] ?? null,
    [workspace.stages, selectedStageId]
  );
  const selectedPoint = useMemo(
    () => orderedPoints.find((p) => p.id === selectedPointId) ?? orderedPoints[0] ?? null,
    [orderedPoints, selectedPointId]
  );
  const selectedSection = useMemo(
    () =>
      workspace.sections.find((s) => s.id === selectedSectionId) ?? workspace.sections[0] ?? null,
    [workspace.sections, selectedSectionId]
  );
  const comparedVariant = useMemo(
    () => workspace.variants.find((v) => v.id === comparedVariantId) ?? null,
    [workspace.variants, comparedVariantId]
  );
  const flattenedCoords = useMemo(
    () => workspace.sections.flatMap((s) => s.geometry.coordinates),
    [workspace.sections]
  );
  // Profil lié à la carte (2.6) : un seul modèle, lu dans les deux sens (carte → profil, profil → carte).
  const profileModel = useMemo(
    () =>
      buildProfileModel({
        orderedPoints,
        sections: workspace.sections,
        stages: workspace.stages,
      }),
    [orderedPoints, workspace.sections, workspace.stages]
  );
  const profileReadout: ProfileReadout | null = useMemo(
    () =>
      profileCursor == null || profileModel.points.length === 0
        ? null
        : readProfileAt(profileModel, Math.min(profileCursor, profileModel.points.length - 1)),
    [profileCursor, profileModel]
  );
  const cursorFromCoord = useCallback(
    (coord: readonly [number, number] | null) => {
      setProfileCursor(coord ? nearestProfileIndex(profileModel, coord) : null);
    },
    [profileModel]
  );

  useEffect(() => {
    setStageNotesDraft(selectedStage?.notes ?? '');
  }, [selectedStage?.id, selectedStage?.notes]);

  const verifiedPack = useMemo(
    () => getLastVerifiedPack(currentUserId, workspace.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, workspace.id, workspace.updatedAt, workspace.publishedRevisionNo, offlineTick]
  );
  const offlineQueue = useMemo(
    () => listOfflineQueue(currentUserId, workspace.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, workspace.id, workspace.updatedAt, online, offlineTick]
  );
  const activeActivity = useMemo(
    () => getActiveActivityLink(currentUserId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, workspace.updatedAt, offlineTick]
  );

  const openSubDrawer = useCallback((id: SubDrawerId) => {
    setSheetOpen(true);
    setDetent('mid');
    setSubDrawer(id);
  }, []);

  // Liens profonds (1.9) : `?jour=`, `?point=`, `?troncon=` ouvrent l'endroit visé, une seule fois à l'arrivée.
  // Un élément absent de cet itinéraire est annoncé tel quel, jamais remplacé par un autre.
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current) return;
    deepLinkDone.current = true;
    const link = entry.deepLink;
    if (link.day == null && !link.pointId && !link.sectionId) return;
    const ws = workspaceRef.current;
    const { target, missing } = resolveDeepLinkTarget(ws, link);
    if (target?.kind === 'point') {
      const pt = activePoints(ws).find((p) => p.id === target.pointId);
      setSelectedPointId(target.pointId);
      if (target.stageId) setSelectedStageId(target.stageId);
      if (pt) setFocusCoord([pt.lon, pt.lat]);
      openSubDrawer('point');
    } else if (target?.kind === 'section') {
      const sec = ws.sections.find((s) => s.id === target.sectionId);
      const coords = sec?.geometry.coordinates ?? [];
      const mid = coords[Math.floor(coords.length / 2)];
      setSelectedSectionId(target.sectionId);
      if (target.stageId) setSelectedStageId(target.stageId);
      if (mid) setFocusCoord([mid[0], mid[1]]);
      openSubDrawer('section');
    } else if (target?.kind === 'stage') {
      const st = ws.stages.find((s) => s.id === target.stageId);
      const start = st ? activePoints(ws).find((p) => p.id === st.startPointId) : undefined;
      setSelectedStageId(target.stageId);
      if (start) setFocusCoord([start.lon, start.lat]);
      openSubDrawer('stage');
    }
    if (missing.length > 0) {
      const names = missing.map((m) => (m === 'jour' ? `le jour ${link.day}` : m === 'point' ? 'le point' : 'le tronçon'));
      setStatusMessage(`Dans le lien : ${names.join(', ')} introuvable dans cet itinéraire.`);
    }
    // Une seule fois à l'arrivée : le lien décrit l'entrée, pas l'état courant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatImpact = (imp: {
    deltaDistanceKm: number;
    deltaDurationMin: number | null;
    kitItemsToRevalidate: readonly unknown[];
    affectedMembers: readonly { displayName: string }[];
  }): string => {
    const parts: string[] = [];
    if (imp.deltaDistanceKm !== 0) {
      parts.push(`${imp.deltaDistanceKm > 0 ? '+' : ''}${imp.deltaDistanceKm} km`);
    }
    if (imp.deltaDurationMin != null && imp.deltaDurationMin !== 0) {
      parts.push(`${imp.deltaDurationMin > 0 ? '+' : ''}${imp.deltaDurationMin} min`);
    }
    if (imp.kitItemsToRevalidate.length > 0) {
      parts.push(`${imp.kitItemsToRevalidate.length} article(s) du kit à revalider`);
    }
    if (imp.affectedMembers.length > 0) {
      parts.push(`Concernés : ${imp.affectedMembers.map((m) => m.displayName).join(', ')}`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Modification enregistrée.';
  };

  const executeOperation = useCallback(
    async (
      opId: string,
      baseSeq: number,
      operation: RouteOperationInput,
      expectedVersions: Record<string, number>
    ): Promise<ApplyOperationResult> => {
      const currentWs = workspaceRef.current;
      if (serverSynced) {
        const res = await fetch(`/api/routes/${encodeURIComponent(currentWs.id)}/operations`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opId, baseSeq, expectedVersions, operation }),
        });
        const data = (await res.json()) as ApplyOperationResult & { error?: string };
        if (res.status === 401 || res.status === 403) {
          return {
            status: 'denied',
            reason:
              (data as { reason?: string }).reason ?? data.error ?? 'Accès refusé ou révoqué.',
          };
        }
        return data;
      }

      const { result, nextOpLog } = applyWorkspaceOperation(
        currentWs,
        opLogRef.current,
        {
          opId,
          baseSeq,
          actorId: currentUserId,
          actorName: currentUserName,
          operation,
          expectedVersions,
        },
        new Date().toISOString()
      );
      if (result.status === 'accepted') {
        opLogRef.current = nextOpLog;
        setOpLog(nextOpLog);
      }
      return result;
    },
    [serverSynced, currentUserId, currentUserName]
  );

  const runOperation = useCallback(
    async (
      operation: RouteOperationInput,
      expectedVersions: Record<string, number> = {},
      meta: { source?: 'user' | 'undo' | 'derived'; gesture?: string } = {}
    ) => {
      const currentWs = workspaceRef.current;
      const opId = `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      if (!online) {
        enqueueOfflineOperation(currentUserId, {
          opId,
          workspaceId: currentWs.id,
          baseSeq: currentWs.headSeq,
          operation,
          expectedVersions,
          queuedAt: new Date().toISOString(),
        });
        setOfflineTick((v) => v + 1);
        setStatusMessage('Hors ligne : modification ajoutée à la file locale persistante.');
        return false;
      }

      trackBegin();
      try {
        const result = await executeOperation(opId, currentWs.headSeq, operation, expectedVersions);
        if (result.status === 'accepted') {
          commitState(result.workspace);
          setLastImpactText(formatImpact(result.impact));
          trackAcked(result.workspace.headSeq);
          if (serverSynced) announceVersion(result.workspace.headSeq);
          trackRecord({
            operation,
            before: currentWs,
            after: result.workspace,
            undoable: meta.source !== 'undo',
            derived: meta.source === 'derived',
            gesture: meta.gesture,
          });
          return true;
        } else if (result.status === 'already_applied') {
          commitState(result.workspace);
          trackAcked(result.workspace.headSeq);
          return true;
        } else if (result.status === 'conflict') {
          setActiveConflict({ conflict: result.conflicts[0], pendingOp: operation });
          setSheetOpen(true);
          commitState(result.currentWorkspace);
          trackAcked(result.currentWorkspace.headSeq);
        } else if (result.status === 'denied') {
          setStatusMessage(result.reason);
          trackFailed(result.reason);
        } else if (result.status === 'stale_routing_discarded') {
          setStatusMessage(result.reason);
          trackFailed(result.reason);
        }
      } catch {
        enqueueOfflineOperation(currentUserId, {
          opId,
          workspaceId: currentWs.id,
          baseSeq: currentWs.headSeq,
          operation,
          expectedVersions,
          queuedAt: new Date().toISOString(),
        });
        setOfflineTick((v) => v + 1);
        setStatusMessage('Réseau indisponible : opération placée en file locale persistante.');
      } finally {
        trackSettle();
      }
      // Refusée, en conflit ou placée en file : l'appelant sait que l'opération n'est pas passée.
      return false;
    },
    [
      announceVersion,
      commitState,
      currentUserId,
      executeOperation,
      online,
      serverSynced,
      trackAcked,
      trackBegin,
      trackFailed,
      trackRecord,
      trackSettle,
      workspace.headSeq,
      workspace.id,
    ]
  );

  // Recalcul réel via /api/route (Valhalla / Geoapify) + /api/elevation (DEM) avec empreinte d'entrée
  /** Appelle /api/route (snap au réseau routier/sentiers) pour une suite de jalons. */
  const fetchRoutedLegs = async (
    waypoints: ReadonlyArray<readonly [number, number]>,
    ws: RouteWorkspaceState
  ): Promise<{
    provider: string | null;
    legs: Array<{
      geometry: Array<[number, number]>;
      distanceKm: number;
      durationMin: number | null;
    }>;
  } | null> => {
    try {
      const qs = new URLSearchParams({
        points: waypoints.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';'),
        sport: ws.sport,
        snap: '1',
      });
      const o = ws.routingOptions;
      if (o?.ebike) qs.set('ebike', '1');
      if (o?.surfacePref) qs.set('surfacePref', o.surfacePref);
      if (o?.avoidSteps) qs.set('avoidSteps', '1');
      if (o?.avoidFerries) qs.set('avoidFerries', '1');
      const res = await fetch(`/api/route?${qs.toString()}`);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        status?: string;
        provider?: string | null;
        legs?: Array<{
          distanceKm?: number;
          durationMin?: number;
          geometry?:
            Array<[number, number]> | { type: 'LineString'; coordinates: Array<[number, number]> };
        }>;
      };
      if (data.status !== 'ok' || !Array.isArray(data.legs)) return null;
      const legs = data.legs.map((leg) => {
        const g = Array.isArray(leg.geometry)
          ? leg.geometry
          : leg.geometry && 'coordinates' in leg.geometry
            ? leg.geometry.coordinates
            : [];
        return {
          geometry: g,
          distanceKm: leg.distanceKm ?? 0,
          durationMin: leg.durationMin != null ? Math.round(leg.durationMin) : null,
        };
      });
      if (legs.some((l) => l.geometry.length < 2)) return null;
      return { provider: data.provider ?? null, legs };
    } catch {
      return null;
    }
  };

  const handleRealRouteSection = async (sectionId: string, silent = false) => {
    const ws = workspaceRef.current;
    const livePoints = activePoints(ws);
    const sec = ws.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const fromPt = livePoints.find((p) => p.id === sec.fromPointId);
    const toPt = livePoints.find((p) => p.id === sec.toPointId);
    if (!fromPt || !toPt) return;

    const fingerprint = computeRoutingFingerprint({
      from: fromPt,
      to: toPt,
      sport: ws.sport,
      options: ws.routingOptions,
    });
    setRoutingBusy(true);
    try {
      // Profil et options (surface, marches, bacs, assistance) : ceux de l'empreinte, jamais le sport seul.
      const res = await fetch(
        `/api/route?${routingQueryParams(
          [
            [fromPt.lon, fromPt.lat],
            [toPt.lon, toPt.lat],
          ],
          ws.sport,
          ws.routingOptions
        ).toString()}`
      );
      if (!res.ok) {
        // L'erreur réelle du routeur (code HTTP, raison), dite telle quelle ; le tronçon reste une ligne droite non vérifiée.
        let reason: string | null = null;
        try {
          reason = ((await res.json()) as { reason?: string }).reason ?? null;
        } catch {
          /* corps non JSON (limite de débit, passerelle) : seul le code HTTP est connu */
        }
        const issue = describeRoutingFailure({ status: res.status, reason });
        setRoutingIssue({ ...issue, sectionId: sec.id });
        setStatusMessage(issue.text);
        return;
      }
      setRoutingIssue(null);
      const data = (await res.json()) as {
        status?: string;
        provider?: string;
        legs?: Array<{
          distanceKm?: number;
          durationMin?: number;
          geometry?:
            Array<[number, number]> | { type: 'LineString'; coordinates: Array<[number, number]> };
        }>;
      };
      const leg = data.legs?.[0];
      const rawCoords = Array.isArray(leg?.geometry)
        ? leg.geometry
        : leg?.geometry && 'coordinates' in leg.geometry
          ? leg.geometry.coordinates
          : null;
      if (data.status !== 'ok' || !rawCoords || rawCoords.length < 2) {
        const issue = describeRoutingFailure({ status: res.status, reason: data.status ?? 'réponse sans tracé' });
        setRoutingIssue({ ...issue, sectionId: sec.id });
        setStatusMessage(issue.text);
        return;
      }

      let ascentM = sec.ascentM;
      let descentM = sec.descentM;
      let elevationSamples: Array<number | null> | undefined;
      try {
        const sampleCount = Math.min(32, rawCoords.length);
        const sampled: Array<[number, number]> = [];
        for (let i = 0; i < sampleCount; i += 1) {
          const idx = Math.round((i / Math.max(1, sampleCount - 1)) * (rawCoords.length - 1));
          sampled.push(rawCoords[idx]);
        }
        const eleParam = sampled
          .map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`)
          .join(';');
        const eleRes = await fetch(`/api/elevation?points=${encodeURIComponent(eleParam)}`);
        if (eleRes.ok) {
          const eleJson = (await eleRes.json()) as {
            status?: string;
            elevations?: Array<number | null>;
          };
          if (
            eleJson.status === 'ok' &&
            Array.isArray(eleJson.elevations) &&
            eleJson.elevations.length >= 2
          ) {
            elevationSamples = eleJson.elevations;
            let up = 0;
            let down = 0;
            for (let i = 1; i < eleJson.elevations.length; i += 1) {
              const a = eleJson.elevations[i - 1];
              const b = eleJson.elevations[i];
              if (typeof a === 'number' && typeof b === 'number') {
                if (b > a) up += b - a;
                else down += a - b;
              }
            }
            ascentM = Math.round(up);
            descentM = Math.round(down);
          }
        }
      } catch {
        /* altitude indisponible : on reste honnête sans inventer */
      }

      const accepted = await runOperation(
        {
          type: 'apply_routing_result',
          sectionId: sec.id,
          routingInputHash: fingerprint,
          geometry: { type: 'LineString', coordinates: rawCoords },
          distanceKm: Number((leg?.distanceKm ?? sec.distanceKm).toFixed(2)),
          durationMin: leg?.durationMin != null ? Math.round(leg.durationMin) : sec.durationMin,
          ascentM,
          descentM,
          elevationSamples,
          provenance: {
            provider: data.provider ?? 'valhalla',
            calculatedAt: new Date().toISOString(),
            profile: ws.sport,
            confidence: 'verified',
          },
        },
        {},
        // Recollage silencieux = suite d'un geste (ajout, déplacement) : annulé avec lui.
        { source: silent ? 'derived' : 'user' }
      );
      // Résultat rejeté (tronçon modifié pendant le calcul) : le message du moteur reste affiché, jamais écrasé.
      if (!accepted) return;
      setStatusMessage(
        silent
          ? 'Tronçon recollé au réseau.'
          : `Section recalculée via ${data.provider ?? 'routeur'} (${(leg?.distanceKm ?? sec.distanceKm).toFixed(2)} km, ${rawCoords.length} pts${ascentM != null ? `, D+ ${ascentM} m` : ''}).`
      );
    } catch {
      const issue = describeRoutingFailure({ network: true });
      setRoutingIssue({ ...issue, sectionId: sec.id });
      setStatusMessage(issue.text);
    } finally {
      setRoutingBusy(false);
    }
  };
  const realRouteRef = useRef(handleRealRouteSection);
  realRouteRef.current = handleRealRouteSection;

  const handleReplayOffline = async () => {
    const res = await replayOfflineQueue(currentUserId, workspace.id, async (queued) => {
      const r = await executeOperation(queued.opId, queued.baseSeq, queued.operation, {
        ...queued.expectedVersions,
      });
      if (r.status === 'accepted' || r.status === 'already_applied') {
        commitState(r.workspace);
        trackAcked(r.workspace.headSeq);
      }
      return r;
    });
    trackReplayed({
      applied: res.appliedCount,
      conflicts: res.conflicts.length,
      rejected: res.rejected.length,
    });
    setOfflineTick((v) => v + 1);
    setStatusMessage(
      `Synchronisation : ${res.appliedCount} appliquée(s), ${res.conflicts.length} conflit(s), ${res.rejected.length} refusée(s).`
    );
  };

  const handleImportGpx = () => {
    const parsed = parseGpxToWorkspaceEntities({
      gpxXml: gpxInput,
      workspaceId: workspace.id,
      keepOriginalGeometry: keepOriginalGpx,
    });
    if (!parsed.ok) {
      setStatusMessage(parsed.error);
      return;
    }
    commitState({
      ...workspace,
      sourceOrigin: {
        kind: 'gpx_import',
        originalGpxXml: parsed.originalGpxXml,
        importedAt: new Date().toISOString(),
        attribution: 'Import GPX utilisateur',
      },
      points: parsed.points,
      sections: parsed.sections,
      headSeq: workspace.headSeq + 1,
      updatedAt: new Date().toISOString(),
    });
    setFitTrigger((n) => n + 1);
    setStatusMessage(
      keepOriginalGpx
        ? 'GPX importé en mode « garder ma trace » (géométrie et original préservés).'
        : 'GPX importé.'
    );
  };

  const handleDownloadGpx = (stageId?: string) => {
    const xml = exportWorkspaceGpx(workspace, stageId);
    if (typeof window === 'undefined') return;
    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${stageId ? `-${stageId}` : ''}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage(
      stageId ? `Export GPX de l’étape téléchargé.` : 'Export GPX complet téléchargé.'
    );
  };

  /**
   * Après une publication réussie (10.1, 10.6) : le tracé du Compas (`routeDraft`) et le budget prévu suivent la
   * version publiée. Non bloquant : un échec est annoncé dans l'îlot avec « Réessayer », la publication reste valide.
   * 401/403 du budget : la personne n'a pas la gestion du budget, il n'y a rien à annoncer.
   */
  const syncPublishedFollowUps = useCallback(async (tripId: string) => {
    if (!isRealTripId(tripId)) return;
    const post = async (url: string) => {
      try {
        return await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId }),
        });
      } catch {
        return null;
      }
    };
    const [draft, budget] = await Promise.all([post('/api/itineraire/sync-draft'), post('/api/itineraire/budget-sync')]);
    const draftFailed = !draft || !draft.ok;
    const budgetFailed = !budget ? true : !budget.ok && budget.status !== 401 && budget.status !== 403;
    if (!draftFailed && !budgetFailed) return;
    const message = draftFailed && budgetFailed
      ? 'Tracé du Compas et budget non mis à jour · réessayer'
      : draftFailed
        ? 'Tracé du Compas non mis à jour · réessayer'
        : 'Budget prévu non mis à jour · réessayer';
    setPublishSyncIssue({ id: Date.now(), message });
  }, []);

  const retryPublishSync = useCallback(() => {
    setPublishSyncIssue(null);
    void syncPublishedFollowUps(workspace.tripId);
  }, [syncPublishedFollowUps, workspace.tripId]);

  const handlePublish = async (customSummary?: string) => {
    const summary = customSummary?.trim() || `Publication v${(workspace.publishedRevisionNo ?? 0) + 1}`;
    if (serverSynced) {
      const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedHeadSeq: workspace.headSeq, summary }),
      });
      const data = (await res.json()) as {
        status?: string;
        reason?: string;
        revision?: { revisionNo: number };
        workspace?: RouteWorkspaceState;
      };
      if (!res.ok || data.status !== 'published' || !data.workspace) {
        setStatusMessage(data.reason ?? 'Publication bloquée : vérifiez la dernière séquence.');
        return;
      }
      commitState(data.workspace);
      trackAcked(data.workspace.headSeq);
      setStatusMessage(`Version ${data.revision?.revisionNo} publiée et figée.`);
      void syncPublishedFollowUps(data.workspace.tripId);
      return;
    }

    const res = publishWorkspaceRevision({
      workspace,
      actorId: currentUserId,
      actorName: currentUserName,
      expectedHeadSeq: workspace.headSeq,
      summary,
      nowIso: new Date().toISOString(),
    });
    if (res.status === 'blocked') {
      setStatusMessage(res.reason);
      return;
    }
    commitState(res.workspace);
    setStatusMessage(`Version ${res.revision.revisionNo} publiée et figée.`);
  };

  const handleDownloadPack = async (simulateInterruption = false) => {
    const latestRev = workspace.revisions[workspace.revisions.length - 1];
    const latestPack = workspace.packs[workspace.packs.length - 1];
    if (!latestRev || !latestPack) {
      setStatusMessage('Publiez d’abord une version avant de télécharger le pack.');
      return;
    }
    stagePackDownload(currentUserId, latestPack, 1, 2);
    if (simulateInterruption || !online) {
      setOfflineTick((v) => v + 1);
      setStatusMessage(
        verifiedPack
          ? `Téléchargement v${latestPack.revisionNo} interrompu — la copie complète v${verifiedPack.manifest.revisionNo} reste utilisable hors ligne.`
          : 'Téléchargement interrompu hors ligne.'
      );
      return;
    }
    const committed = commitVerifiedPack(
      currentUserId,
      latestPack,
      latestRev,
      new Date().toISOString()
    );
    if (!committed.ok) {
      setStatusMessage(committed.reason);
      return;
    }
    if (serverSynced) {
      await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/packs`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          downloadedRevisionNo: latestRev.revisionNo,
          preparedRevisionNo: latestRev.revisionNo,
          status: 'ready',
          verifiedLocalAt: committed.pack.verifiedAt,
        }),
      }).catch(() => undefined);
    }
    setOfflineTick((v) => v + 1);
    setStatusMessage(`Pack v${latestRev.revisionNo} téléchargé et vérifié localement.`);
  };

  /** Un commentaire se pose sur un point, un tronçon ou un jour (8.7) ; par défaut, sur le point actif. */
  const handleAddComment = async (anchorPointId?: string, target: CommentTarget = 'point') => {
    if (!commentBody.trim() || !canComment) return;
    const anchor = anchorFor(workspace, target, {
      pointId: anchorPointId ?? selectedPointId ?? orderedPoints[0]?.id,
      sectionId: selectedSectionId,
      stageId: selectedStage?.id,
    });
    if (!anchor) {
      setStatusMessage(`Choisissez d’abord ${COMMENT_TARGET_LABEL[target]} à commenter.`);
      return;
    }
    const where = commentAnchorLabel({ anchor }, workspace);

    if (serverSynced) {
      const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody.trim(), anchor }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
        announceVersion(data.workspace?.headSeq ?? workspace.headSeq, 'discussion');
        setCommentBody('');
        setStatusMessage(`Commentaire posé : ${where}.`);
      } else {
        setStatusMessage('Commentaire refusé : vérifiez vos droits ou réessayez.');
      }
      return;
    }

    const nextComment = {
      id: `cmt-${Date.now().toString(36)}`,
      workspaceId: workspace.id,
      createdBy: currentUserId,
      authorName: currentUserName,
      body: commentBody.trim(),
      anchor,
      baseRevisionNo: workspace.publishedRevisionNo ?? 0,
      status: 'open' as const,
      createdAt: new Date().toISOString(),
    };
    commitState({
      ...workspace,
      comments: [...workspace.comments, nextComment],
      updatedAt: new Date().toISOString(),
    });
    setCommentBody('');
    setStatusMessage(`Commentaire posé : ${where}.`);
  };

  /** Replace un commentaire dont l'ancre a disparu sur la cible choisie (point, tronçon ou jour sélectionné). */
  const handleRelocateComment = async (commentId: string, target: CommentTarget = 'point') => {
    const newAnchor = anchorFor(workspace, target, {
      pointId: selectedPoint?.id ?? orderedPoints[0]?.id,
      sectionId: selectedSectionId,
      stageId: selectedStage?.id,
    });
    if (!newAnchor) {
      setStatusMessage(`Choisissez d’abord ${COMMENT_TARGET_LABEL[target]} où le replacer.`);
      return;
    }
    const where = commentAnchorLabel({ anchor: newAnchor }, workspace);
    if (serverSynced) {
      const res = await fetch(
        `/api/routes/${encodeURIComponent(workspace.id)}/comments/${encodeURIComponent(commentId)}/relocate`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newAnchor }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
        announceVersion(data.workspace?.headSeq ?? workspace.headSeq, 'discussion');
        setStatusMessage(`Commentaire replacé : ${where}.`);
      }
      return;
    }
    commitState({
      ...workspace,
      comments: workspace.comments.map((c) =>
        c.id === commentId ? { ...c, anchor: newAnchor, status: 'open' as const } : c
      ),
      updatedAt: new Date().toISOString(),
    });
    setStatusMessage(`Commentaire replacé : ${where}.`);
  };

  /**
   * Publie une proposition. Sans brouillon, on garde le geste historique (déplacer le point médian) ; avec un
   * brouillon (par exemple « Ma version » issue d'un conflit), ce sont ses opérations réelles qui sont proposées.
   */
  const submitProposal = async (title: string, rationale: string, operations: RouteOperationInput[]) => {
    if (serverSynced) {
      const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/proposals`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, rationale: rationale || 'Variante proposée', operations }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
        announceVersion(data.workspace?.headSeq ?? workspace.headSeq, 'discussion');
        setProposalTitle('');
        setProposalRationale('');
        setProposalDraft(null);
        setStatusMessage('Proposition publiée pour relecture.');
        return true;
      }
      setStatusMessage('Proposition refusée : vérifiez vos droits ou réessayez.');
      return false;
    }

    const prop: RouteProposal = {
      id: `prop-${Date.now().toString(36)}`,
      workspaceId: workspace.id,
      baseSeq: workspace.headSeq,
      createdBy: currentUserId,
      authorName: currentUserName,
      title,
      rationale: rationale || 'Variante proposée',
      scopeEntityIds: Array.from(
        new Set(operations.flatMap((op) => ('pointId' in op ? [op.pointId] : 'sectionId' in op ? [op.sectionId] : [])))
      ),
      operations,
      impactPreview: null,
      status: 'open',
      votes: {},
      createdAt: new Date().toISOString(),
    };
    commitState({
      ...workspace,
      proposals: [...workspace.proposals, prop],
      updatedAt: new Date().toISOString(),
    });
    setProposalTitle('');
    setProposalRationale('');
    setProposalDraft(null);
    setStatusMessage('Proposition publiée pour relecture.');
    return true;
  };

  const handleCreateProposal = async () => {
    if (!proposalTitle.trim() || !canPropose || orderedPoints.length === 0) return;
    let operations: RouteOperationInput[];
    if (proposalDraft) {
      operations = [...proposalDraft.operations];
    } else {
      const target = orderedPoints[Math.floor(orderedPoints.length / 2)];
      operations = [
        {
          type: 'move_point',
          pointId: target.id,
          lat: Number((target.lat + 0.004).toFixed(5)),
          lon: Number((target.lon + 0.004).toFixed(5)),
        },
      ];
    }
    await submitProposal(proposalTitle.trim(), proposalRationale.trim(), operations);
  };

  /** 8.5 « Proposer » : ma version du conflit devient une proposition à relire, au lieu d'écraser ou de s'effacer. */
  const handleProposeFromConflict = () => {
    if (!activeConflict) return;
    if (!canPropose) {
      setStatusMessage('Vous n’avez pas le droit de proposer sur cet itinéraire.');
      return;
    }
    const op = activeConflict.pendingOp;
    setProposalDraft({ operations: [op], summary: describeOperation(op, workspace) });
    setProposalTitle(conflictProposalTitle(op, workspace));
    setProposalRationale('Nous avons modifié le même point en même temps.');
    setActiveConflict(null);
    openSubDrawer('proposals');
  };

  const handleVoteProposal = async (proposalId: string, vote: 'up' | 'down') => {
    if (serverSynced) {
      const res = await fetch(
        `/api/routes/${encodeURIComponent(workspace.id)}/proposals/${encodeURIComponent(proposalId)}/vote`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vote }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
        announceVersion(data.workspace?.headSeq ?? workspace.headSeq, 'discussion');
      }
      return;
    }
    commitState({
      ...workspace,
      proposals: workspace.proposals.map((p) =>
        p.id === proposalId ? { ...p, votes: { ...p.votes, [currentUserId]: vote } } : p
      ),
    });
  };

  const handleDecideProposal = async (proposal: RouteProposal, decision: 'accept' | 'reject') => {
    if (serverSynced) {
      const res = await fetch(
        `/api/routes/${encodeURIComponent(workspace.id)}/proposals/${encodeURIComponent(proposal.id)}/decide`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, expectedHeadSeq: workspace.headSeq }),
        }
      );
      const data = (await res.json()) as { workspace?: RouteWorkspaceState; error?: string };
      if (!res.ok) {
        setStatusMessage(data.error ?? 'Impossible de traiter la proposition.');
        return;
      }
      if (data.workspace) {
        commitState(data.workspace);
        announceVersion(data.workspace.headSeq, data.workspace.headSeq > workspace.headSeq ? 'operation' : 'discussion');
      }
      setStatusMessage(
        decision === 'accept' ? 'Proposition acceptée et appliquée.' : 'Proposition refusée.'
      );
      return;
    }

    if (decision === 'reject') {
      commitState({
        ...workspace,
        proposals: workspace.proposals.map((pr) =>
          pr.id === proposal.id ? { ...pr, status: 'rejected' } : pr
        ),
      });
      setStatusMessage('Proposition refusée.');
      return;
    }

    let working = workspace;
    let log = opLog;
    for (let i = 0; i < proposal.operations.length; i += 1) {
      const res = applyWorkspaceOperation(
        working,
        log,
        {
          opId: `prop-${proposal.id}-${i}`,
          baseSeq: working.headSeq,
          actorId: currentUserId,
          actorName: currentUserName,
          operation: proposal.operations[i],
        },
        new Date().toISOString()
      );
      if (res.result.status === 'accepted') {
        working = res.result.workspace;
        log = res.nextOpLog;
      }
    }
    setOpLog(log);
    commitState({
      ...working,
      proposals: working.proposals.map((pr) =>
        pr.id === proposal.id ? { ...pr, status: 'accepted' } : pr
      ),
    });
    setStatusMessage('Proposition acceptée et appliquée sur la carte.');
  };

  const handleCreateDetourVariant = async () => {
    const sec = workspace.sections[0];
    if (!sec) return;
    const coords = sec.geometry.coordinates;
    const start = coords[0];
    const end = coords[coords.length - 1];
    const mid: [number, number] = [
      Number(((start[0] + end[0]) / 2 + 0.012).toFixed(5)),
      Number(((start[1] + end[1]) / 2 + 0.008).toFixed(5)),
    ];
    const variant: RouteVariant = {
      id: `var-${Date.now().toString(36)}`,
      baseRevisionNo: workspace.publishedRevisionNo ?? 0,
      scope: 'section',
      title: `Détour panorama (+2,1 km)`,
      replacements: [
        {
          sectionId: sec.id,
          geometry: { type: 'LineString', coordinates: [start, mid, end] },
          distanceKm: Number((sec.distanceKm + 2.1).toFixed(2)),
          durationMin: (sec.durationMin ?? 120) + 35,
          ascentM: sec.ascentM != null ? sec.ascentM + 160 : null,
          descentM: sec.descentM != null ? sec.descentM + 160 : null,
          surfaceKnownRatio: 0.75,
          provenance: {
            provider: 'variante-compas',
            calculatedAt: new Date().toISOString(),
            profile: workspace.sport,
            confidence: 'estimated',
          },
        },
      ],
      deltaDistanceKm: 2.1,
      deltaAscentM: 160,
      deltaDurationMin: 35,
      status: 'draft',
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
    };
    await runOperation({ type: 'add_variant', variant });
    setComparedVariantId(variant.id);
    setStatusMessage('Variante ajoutée et superposée en pointillé indigo sur la carte.');
  };

  const handleAssignKitItem = async (itemId: string, userId: string | null) => {
    if (serverSynced) {
      const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/kit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', itemId, assigneeUserId: userId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
      }
      return;
    }
    const member = workspace.members.find((m) => m.userId === userId);
    const nextKit: CollaborativeKitItem[] = workspace.kitItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            assigneeUserId: userId,
            assigneeName: member?.displayName ?? null,
            status: userId ? 'confirmed' : 'unassigned',
          }
        : item
    );
    commitState({ ...workspace, kitItems: nextKit, updatedAt: new Date().toISOString() });
  };

  const handleRevalidateKitItem = async (itemId: string) => {
    if (serverSynced) {
      const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/kit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revalidate', itemId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
      }
      return;
    }
    const nextKit: CollaborativeKitItem[] = workspace.kitItems.map((item) =>
      item.id === itemId ? { ...item, status: 'confirmed', revalidationReason: null } : item
    );
    commitState({ ...workspace, kitItems: nextKit, updatedAt: new Date().toISOString() });
  };

  /**
   * 8.9 Lien de lecture : 48 h par défaut, zone de départ privée masquée, révocation immédiate. Le jeton n'est renvoyé
   * qu'une fois, à la création : on le garde ici (mémoire de la page) pour l'afficher juste après, jamais ensuite.
   */
  const handleManageShareLink = async (action: 'create' | 'revoke') => {
    if (!canManageMembers) return;
    if (serverSynced) {
      const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'share_link',
          action,
          expiresInHours: DEFAULT_SHARE_LINK_HOURS,
          hidePrivateStartRadiusM: 300,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState; shareLink?: ShareLinkConfig | null };
        if (data.workspace) commitState(data.workspace);
        setFreshShareToken(action === 'create' && data.shareLink?.token ? data.shareLink.token : null);
        setStatusMessage(
          action === 'create'
            ? 'Lien lecture seule généré (48 h, zone de départ privée masquée). Copiez-le maintenant : il ne sera plus affiché.'
            : 'Lien de partage révoqué immédiatement.'
        );
      } else {
        setStatusMessage('Le lien n’a pas pu être modifié : réessayez.');
      }
      return;
    }
    const localToken = `lk-${Date.now().toString(36)}`;
    commitState({
      ...workspace,
      shareLink:
        action === 'create'
          ? {
              token: localToken,
              audience: 'external_viewer',
              expiresAt: new Date(Date.now() + DEFAULT_SHARE_LINK_HOURS * 3600_000).toISOString(),
              revokedAt: null,
              hidePrivateStartRadiusM: 300,
              createdBy: currentUserId,
              createdAt: new Date().toISOString(),
            }
          : workspace.shareLink
            ? { ...workspace.shareLink, revokedAt: new Date().toISOString() }
            : null,
      updatedAt: new Date().toISOString(),
    });
    setFreshShareToken(action === 'create' ? localToken : null);
    setStatusMessage(
      action === 'create'
        ? 'Lien lecture seule généré (48 h, zone de départ privée masquée).'
        : 'Lien de partage révoqué.'
    );
  };

  const handleStartActivity = () => {
    const rev = verifiedPack?.revision ?? workspace.revisions[workspace.revisions.length - 1];
    if (!rev) {
      setStatusMessage('Publiez d’abord une version ou téléchargez un pack avant de démarrer.');
      return;
    }
    const nowIso = new Date().toISOString();
    startActivityFromRevision(currentUserId, rev, nowIso);
    // 9.8 : le cockpit (suivi en direct, contact de sécurité) joint cette version et ce sac à la sortie enregistrée.
    const handoffOk = isRealTripId(workspace.tripId) && writeHandoff(handoffFromRevision(workspace.tripId, rev, nowIso));
    setOfflineTick((v) => v + 1);
    setStatusMessage(
      handoffOk
        ? `Activité démarrée avec la version ${rev.revisionNo} et le sac figé : la sortie les gardera.`
        : `Activité démarrée avec la version ${rev.revisionNo} (voyage non rattaché : la sortie ne gardera pas ce lien).`
    );
  };

  /** 9.3 : plusieurs attributions d'un coup (une seule écriture : pas d'attribution perdue par un état périmé). */
  const handleAssignKitItems = async (assignments: readonly { itemId: string; userId: string }[]) => {
    if (assignments.length === 0) return;
    if (serverSynced) {
      let latest: RouteWorkspaceState | null = null;
      for (const a of assignments) {
        const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/kit`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'assign', itemId: a.itemId, assigneeUserId: a.userId }),
        });
        if (!res.ok) {
          setStatusMessage('Une partie des attributions n’a pas pu être enregistrée · réessayer');
          break;
        }
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) latest = data.workspace;
      }
      if (latest) commitState(latest);
      return;
    }
    const byItem = new Map(assignments.map((a) => [a.itemId, a.userId]));
    const nextKit: CollaborativeKitItem[] = workspace.kitItems.map((item) => {
      const userId = byItem.get(item.id);
      if (!userId) return item;
      const member = workspace.members.find((m) => m.userId === userId);
      return { ...item, assigneeUserId: userId, assigneeName: member?.displayName ?? null, status: 'confirmed' };
    });
    commitState({ ...workspace, kitItems: nextKit, updatedAt: new Date().toISOString() });
  };

  /** 9.1 : ajoute au sac de l'itinéraire des objets du voyage ; serveur (`/api/routes/[id]/kit`) ou local. */
  const handleAddKitItems = async (items: readonly CollaborativeKitItem[]) => {
    if (items.length === 0) return;
    if (serverSynced) {
      let latest: RouteWorkspaceState | null = null;
      for (const newItem of items) {
        const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/kit`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', newItem }),
        });
        if (!res.ok) {
          setStatusMessage('Une partie du sac n’a pas pu être ajoutée · réessayer');
          break;
        }
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) latest = data.workspace;
      }
      if (latest) commitState(latest);
      return;
    }
    commitState({ ...workspace, kitItems: [...workspace.kitItems, ...items], updatedAt: new Date().toISOString() });
  };

  const handleFinishToCarnet = () => {
    const carnetId = `carnet-${workspace.id}-${Date.now().toString(36)}`;
    const coords = workspace.sections.flatMap((s) => s.geometry.coordinates);
    const rec = finishActivityToCarnet({
      userId: currentUserId,
      carnetId,
      recordedDistanceKm: totals.distanceKm,
      recordedAscentM: totals.ascentM,
      recordedCoords: coords,
      nowIso: new Date().toISOString(),
    });
    if (rec) {
      setCarnetRecord(rec);
      setOfflineTick((v) => v + 1);
      setStatusMessage(`Carnet enregistré (version suivie v${rec.plannedRevisionNo}).`);
    }
  };

  const handleDuplicateFromCarnet = (session?: { sessionId: string; startedAt: string } | null) => {
    const copy = duplicateWorkspaceWithProvenance({
      sourceWorkspace: workspace,
      newWorkspaceId: `ws-copy-${Date.now().toString(36)}`,
      // Même voyage : un brouillon n'est jamais rattaché à un voyage inventé.
      newTripId: workspace.tripId,
      sourceSessionId: session?.sessionId ?? null,
      sourceSessionDate: session?.startedAt ?? null,
      ownerId: currentUserId,
      ownerName: currentUserName,
      nowIso: new Date().toISOString(),
    });
    commitState(copy);
    setCarnetRecord(null);
    setSubDrawer(null);
    setTabIndex(0);
    setStatusMessage('Nouveau brouillon indépendant créé avec provenance conservée.');
  };

  const kitToRevalidateCount = workspace.kitItems.filter(
    (k) => k.status === 'needs_revalidation'
  ).length;
  const openProposalsCount = workspace.proposals.filter((p) => p.status === 'open').length;
  const orphanCommentsCount = workspace.comments.filter(
    (c) => c.status === 'needs_relocation'
  ).length;
  const totalWarnings = workspace.sections.reduce((acc, s) => acc + s.warnings.length, 0);
  const manualSectionsCount = workspace.sections.filter((s) => s.mode === 'manual').length;
  const hubSummary = useMemo(() => summarizeWorkspaceForHub(workspace), [workspace]);
  const terrainStats = useMemo(() => computeTechnicalTerrainStats(workspace), [workspace]);

  const elevationStats = useMemo(() => {
    const valid = elevation.samples
      .map((s) => s.elevationM)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (valid.length < 2) {
      return {
        hasElevation: false,
        minEleM: null as number | null,
        maxEleM: null as number | null,
      };
    }
    return {
      hasElevation: true,
      minEleM: Math.round(Math.min(...valid)),
      maxEleM: Math.round(Math.max(...valid)),
    };
  }, [elevation]);

  const refreshKnowledgeBank = useCallback(async () => {
    setKnowledgeLoading(true);
    try {
      const data = await fetchRouteKnowledgeBank(workspace);
      setKnowledgePois(data.pois);
      setLiveWeather(data.weather);
      setNearbyRoutes(data.nearbyRoutes);
      setPlaceLabel(data.placeLabel);
      setKnowledgeSources(data.sources);
      setKnowledgeLoadedAt(new Date().toISOString());
    } finally {
      setKnowledgeLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (
      sheetOpen &&
      (tabIndex === 1 || tabIndex === 2 || tabIndex === 4) &&
      knowledgePois.length === 0 &&
      !liveWeather &&
      !knowledgeLoading
    ) {
      void refreshKnowledgeBank();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, tabIndex]);

  const handleSplitIntoDays = async (targetDays: number) => {
    const safeDays = Math.max(1, Math.min(20, Math.round(targetDays)));
    // Points d'étape ajoutés + découpage = un seul geste pour « Annuler ».
    const splitGesture = `split-${Date.now().toString(36)}`;
    const pts = activePoints(workspaceRef.current);
    if (pts.length < 2) {
      setStatusMessage('Ajoutez au moins 2 points pour découper en journées.');
      return;
    }
    if (safeDays > pts.length - 1) {
      const needed = safeDays - (pts.length - 1);
      const track =
        flattenedCoords.length >= 2
          ? flattenedCoords
          : pts.map((p) => [p.lon, p.lat] as [number, number]);
      const start = track[0];
      const end = track[track.length - 1];
      let afterId = pts[0].id;
      for (let i = 1; i <= needed; i += 1) {
        const ratio = i / (needed + 1);
        const [lon, lat] =
          track.length > safeDays
            ? track[Math.min(track.length - 1, Math.max(0, Math.floor(ratio * (track.length - 1))))]
            : [
                Number((start[0] + (end[0] - start[0]) * ratio).toFixed(5)),
                Number((start[1] + (end[1] - start[1]) * ratio).toFixed(5)),
              ];
        const ptId = `pt-split-${Date.now().toString(36)}-${i}`;
        await runOperation(
          {
            type: 'insert_point',
            pointId: ptId,
            afterPointId: afterId,
            lat,
            lon,
            name: `Étape ${i + 1}`,
          },
          {},
          { gesture: splitGesture }
        );
        afterId = ptId;
      }
    }
    await runOperation({ type: 'split_days', targetDays: safeDays }, {}, { gesture: splitGesture });
    setStatusMessage(`Itinéraire modulé en ${safeDays} journée(s).`);
  };

  const handleSearchLkdvUsers = async (query: string) => {
    setUserSearchQuery(query);
    if (query.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const res = await fetch(
        `/api/users/search?scope=all&q=${encodeURIComponent(query.trim())}&limit=8`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          users?: Array<{
            id: string;
            full_name: string | null;
            location: string | null;
            trust_score: number | null;
          }>;
        };
        setUserSearchResults(Array.isArray(data.users) ? data.users : []);
      } else {
        setUserSearchResults([]);
      }
    } catch {
      setUserSearchResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  };

  /** Réponse d'une action sur les membres : relit l'état, prévient les autres, dit l'échec en clair. */
  const postMemberAction = async (body: Record<string, unknown>, okMessage: string): Promise<boolean> => {
    const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/members`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'member', ...body }),
    });
    const data = (await res.json().catch(() => ({}))) as { workspace?: RouteWorkspaceState; error?: string };
    if (!res.ok) {
      setStatusMessage(data.error ?? 'Modification de l’équipe refusée.');
      return false;
    }
    if (data.workspace) commitState(data.workspace);
    announceVersion(data.workspace?.headSeq ?? workspace.headSeq, 'team');
    setStatusMessage(okMessage);
    return true;
  };

  const handleMemberRoleAction = async (
    userId: string,
    role: 'co_organizer' | 'editor' | 'contributor' | 'participant',
    displayName?: string
  ) => {
    if (!canManageMembers) return;
    if (serverSynced) {
      // Corps aligné sur le schéma serveur (`kind: 'member'`, `targetUserId`) : l'ancien `kind: 'role'` était refusé en 400.
      await postMemberAction(
        { targetUserId: userId, role, displayName },
        `Droits mis à jour (${ROLE_LABELS[role] ?? role}).`
      );
      return;
    }
    const existing = workspace.members.find((m) => m.userId === userId);
    const nextMembers = existing
      ? workspace.members.map((m) => (m.userId === userId ? { ...m, role, revokedAt: null } : m))
      : [
          ...workspace.members,
          {
            userId,
            displayName: displayName || userId,
            role,
            revokedAt: null,
          },
        ];
    commitState({ ...workspace, members: nextMembers, updatedAt: new Date().toISOString() });
    setStatusMessage(
      `${displayName || userId} ajouté(e) en tant que ${ROLE_LABELS[role] ?? role}.`
    );
  };

  const handleRevokeMember = async (userId: string) => {
    if (!canManageMembers) return;
    if (serverSynced) {
      await postMemberAction({ targetUserId: userId, revoke: true }, 'Accès révoqué.');
      return;
    }
    commitState({
      ...workspace,
      members: workspace.members.map((m) =>
        m.userId === userId ? { ...m, revokedAt: new Date().toISOString() } : m
      ),
      updatedAt: new Date().toISOString(),
    });
    setStatusMessage('Accès révoqué.');
  };

  /**
   * 8.3 Confier un jour à quelqu'un (ou le lui retirer) : stocké dans `stageScopeIds` du membre. Une portée non vide
   * limite aussi ses modifications de tracé à ces jours (`hasRoutePermission`) : l'interface le dit avant.
   */
  const handleAssignStage = async (userId: string, stageId: string, assigned: boolean) => {
    if (!canManageMembers) return;
    const member = workspace.members.find((m) => m.userId === userId && !m.revokedAt);
    const stage = workspace.stages.find((s) => s.id === stageId);
    if (!member || !stage) return;
    const stageScopeIds = nextStageScope(member.stageScopeIds, stageId, assigned);
    const sentence = assigned
      ? `Jour ${stage.dayNumber} confié à ${firstNameOf(member.displayName)}.`
      : `Jour ${stage.dayNumber} retiré à ${firstNameOf(member.displayName)}.`;
    if (serverSynced) {
      await postMemberAction({ targetUserId: userId, stageScopeIds }, sentence);
      return;
    }
    commitState({
      ...workspace,
      members: workspace.members.map((m) => (m.userId === userId ? { ...m, stageScopeIds } : m)),
      updatedAt: new Date().toISOString(),
    });
    setStatusMessage(sentence);
  };

  /** 8.1 Les invitables sont les collaborateurs du voyage, lus par l'API (RLS), pas une recherche dans toute la base. */
  const loadInvitable = useCallback(async () => {
    if (!serverSynced || shareToken) {
      setInvitable([]);
      return;
    }
    setInvitableLoading(true);
    try {
      const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/members`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { invitable?: InvitableCollaborator[] };
        setInvitable(Array.isArray(data.invitable) ? data.invitable : []);
      } else {
        setInvitable([]);
      }
    } catch {
      setInvitable([]);
    } finally {
      setInvitableLoading(false);
    }
  }, [serverSynced, shareToken, workspace.id]);

  const applyImportedCoordinates = useCallback(
    (
      coords: readonly [number, number][],
      title: string,
      mode: 'manual' | 'imported_preserved',
      providerLabel: string
    ) => {
      if (coords.length < 2) return;
      const nowIso = new Date().toISOString();
      let distKm = 0;
      for (let i = 1; i < coords.length; i += 1) {
        distKm += haversineKm(
          { lat: coords[i - 1][1], lon: coords[i - 1][0] },
          { lat: coords[i][1], lon: coords[i][0] }
        );
      }
      const startPt: CollaborativeRoutePoint = {
        id: `pt-start-${Date.now().toString(36)}`,
        workspaceId: workspace.id,
        kind: 'start',
        orderKey: 'A',
        lat: coords[0][1],
        lon: coords[0][0],
        name: 'Départ',
        entityVersion: 1,
      };
      const endPt: CollaborativeRoutePoint = {
        id: `pt-end-${Date.now().toString(36)}`,
        workspaceId: workspace.id,
        kind: 'finish',
        orderKey: 'Z',
        lat: coords[coords.length - 1][1],
        lon: coords[coords.length - 1][0],
        name: 'Arrivée',
        entityVersion: 1,
      };
      const isCycling =
        workspace.sport === 'vtt' || workspace.sport === 'gravel' || workspace.sport === 'route';
      const sec: CollaborativeRouteSection = {
        id: `sec-${Date.now().toString(36)}`,
        workspaceId: workspace.id,
        fromPointId: startPt.id,
        toPointId: endPt.id,
        mode,
        geometry: { type: 'LineString', coordinates: [...coords] },
        distanceKm: Number(distKm.toFixed(2)),
        durationMin: Math.round((distKm / (isCycling ? 16 : 4.2)) * 60),
        ascentM: null,
        descentM: null,
        surfaceSegments: [],
        routingInputHash: null,
        provenance: {
          provider: providerLabel,
          calculatedAt: nowIso,
          profile: workspace.sport,
          confidence: 'estimated',
        },
        warnings: [],
        entityVersion: 1,
      };
      commitState({
        ...workspace,
        title: workspace.title === 'Nouvel itinéraire collaboratif' ? title : workspace.title,
        points: [startPt, endPt],
        sections: [sec],
        headSeq: workspace.headSeq + 1,
        updatedAt: nowIso,
      });
      setFitTrigger((n) => n + 1);
      setKnowledgePois([]);
    },
    [commitState, workspace]
  );

  const handleFreehandDrawComplete = useCallback(
    (coords: readonly [number, number][]) => {
      setDrawingMode(false);
      setSheetOpen(true);
      if (coords.length < 2) return;
      const ws = workspaceRef.current;

      // 1) Échantillonne ≤ 12 jalons répartis sur la distance du geste (début & fin inclus)
      const cum: number[] = [0];
      for (let i = 1; i < coords.length; i += 1) {
        cum.push(
          cum[i - 1] +
            haversineKm(
              { lat: coords[i - 1][1], lon: coords[i - 1][0] },
              { lat: coords[i][1], lon: coords[i][0] }
            )
        );
      }
      const total = cum[cum.length - 1];
      const wpCount = Math.max(2, Math.min(12, Math.ceil(total / 0.4) + 1));
      const waypoints: Array<[number, number]> = [];
      let cursor = 0;
      for (let k = 0; k < wpCount; k += 1) {
        const target = (total * k) / (wpCount - 1);
        while (cursor < coords.length - 1 && cum[cursor] < target) cursor += 1;
        const c = coords[k === wpCount - 1 ? coords.length - 1 : cursor];
        const prev = waypoints[waypoints.length - 1];
        if (!prev || prev[0] !== c[0] || prev[1] !== c[1]) waypoints.push([c[0], c[1]]);
      }
      if (waypoints.length < 2) {
        applyImportedCoordinates(coords, ws.title, 'manual', 'trace-manuelle');
        return;
      }

      setRoutingBusy(true);
      setStatusMessage('Ajustement du tracé sur les routes et sentiers…');
      void (async () => {
        try {
          const routed = await fetchRoutedLegs(waypoints, ws);
          if (!routed || routed.legs.length !== waypoints.length - 1) {
            applyImportedCoordinates(coords, ws.title, 'manual', 'trace-manuelle');
            setStatusMessage(
              'Routeur indisponible : tracé libre conservé tel que dessiné (non collé aux routes).'
            );
            return;
          }
          const nowIso = new Date().toISOString();
          const stamp = Date.now().toString(36);
          const snapped: Array<[number, number]> = routed.legs.map((leg) => leg.geometry[0]);
          const lastGeom = routed.legs[routed.legs.length - 1].geometry;
          snapped.push(lastGeom[lastGeom.length - 1]);
          const pts: CollaborativeRoutePoint[] = waypoints.map((_, i) => ({
            id: `pt-${stamp}-${i}`,
            workspaceId: ws.id,
            kind: i === 0 ? 'start' : i === waypoints.length - 1 ? 'finish' : 'via',
            orderKey:
              i === 0 ? 'A' : i === waypoints.length - 1 ? 'Z' : String.fromCharCode(66 + i),
            lat: snapped[i][1],
            lon: snapped[i][0],
            name: i === 0 ? 'Départ' : i === waypoints.length - 1 ? 'Arrivée' : `Passage ${i}`,
            entityVersion: 1,
          }));
          const secs: CollaborativeRouteSection[] = routed.legs.map((leg, i) => ({
            id: `sec-${stamp}-${i}`,
            workspaceId: ws.id,
            fromPointId: pts[i].id,
            toPointId: pts[i + 1].id,
            mode: 'routed',
            geometry: { type: 'LineString', coordinates: leg.geometry },
            distanceKm: Number(leg.distanceKm.toFixed(2)),
            durationMin: leg.durationMin,
            ascentM: null,
            descentM: null,
            surfaceSegments: [],
            routingInputHash: computeRoutingFingerprint({
              from: pts[i],
              to: pts[i + 1],
              sport: ws.sport,
              options: ws.routingOptions,
            }),
            provenance: {
              provider: routed.provider ?? 'valhalla',
              calculatedAt: nowIso,
              profile: ws.sport,
              confidence: 'verified',
            },
            warnings: [],
            entityVersion: 1,
          }));
          commitState({
            ...ws,
            points: pts,
            sections: secs,
            headSeq: ws.headSeq + 1,
            updatedAt: nowIso,
          });
          setFitTrigger((n) => n + 1);
          setKnowledgePois([]);
          const km = secs.reduce((a, s) => a + s.distanceKm, 0);
          setStatusMessage(
            `Tracé collé au réseau via ${routed.provider ?? 'routeur'} (${km.toFixed(1)} km, ${pts.length} jalons).`
          );
        } finally {
          setRoutingBusy(false);
        }
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyImportedCoordinates, commitState]
  );

  /** Recolle automatiquement au réseau les tronçons touchés par un point déplacé ou ajouté. */
  const snapSectionsAroundPoint = useCallback(async (pointId: string) => {
    const ws = workspaceRef.current;
    const ids = ws.sections
      .filter(
        (s) =>
          s.mode !== 'imported_preserved' && (s.fromPointId === pointId || s.toPointId === pointId)
      )
      .map((s) => s.id);
    for (const id of ids) {
      await realRouteRef.current(id, true);
    }
  }, []);

  const handleDragPoint = useCallback(
    (pointId: string, lat: number, lon: number) => {
      const pt = activePoints(workspaceRef.current).find((p) => p.id === pointId);
      if (!pt) return;
      void (async () => {
        await runOperation(
          { type: 'move_point', pointId, lat, lon },
          { [pointId]: pt.entityVersion }
        );
        await snapSectionsAroundPoint(pointId);
      })();
    },
    [runOperation, snapSectionsAroundPoint]
  );

  /**
   * Pose un point (2.2, 2.3) : toucher = point de passage, appui long = Arrêt, Fin d'étape ou Repère.
   * Le point s'insère dans le tronçon voisin s'il est posé près du tracé (`thresholdM`), sinon en fin de liste.
   * Tout le geste est annulable d'un seul « Annuler ».
   */
  const placePoint = useCallback(
    async (req: { role: PointRole; lat: number; lon: number; thresholdM: number; name?: string }) => {
      const ws = workspaceRef.current;
      const pointId = `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      const plan = planPointInsertion(ws, { pointId, ...req });
      if (!plan.ok) {
        setStatusMessage(plan.reason);
        return false;
      }
      const gesture = `place-${pointId}`;
      let allOk = true;
      for (const op of plan.ops) {
        const ok = await runOperation(op, {}, { gesture });
        if (!ok) {
          allOk = false;
          // Hors ligne, chaque opération est mise en file : on les met toutes, dans l'ordre.
          if (online) break;
        }
      }
      if (!allOk) return false;
      setSelectedPointId(pointId);
      setFocusCoord([plan.lon, plan.lat]);
      if (plan.needsRouting) await snapSectionsAroundPoint(pointId);
      return true;
    },
    [online, runOperation, snapSectionsAroundPoint]
  );

  /** Glisser une ligne (2.4) : le point déposé s'insère dans le tronçon glissé, puis les deux moitiés sont recollées au réseau. */
  const dragSectionLine = useCallback(
    async (sectionId: string, lat: number, lon: number) => {
      const ws = workspaceRef.current;
      const pointId = `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      const plan = planLineDrag(ws, sectionId, pointId, lat, lon);
      if (!plan) {
        setStatusMessage('Ce tronçon ne peut pas être déformé ici.');
        return false;
      }
      const gesture = `drag-${pointId}`;
      for (const op of plan.ops) {
        const ok = await runOperation(op, {}, { gesture });
        if (!ok) return false;
      }
      setSelectedPointId(pointId);
      await snapSectionsAroundPoint(pointId);
      return true;
    },
    [runOperation, snapSectionsAroundPoint]
  );

  const handleCenterMyPosition = async () => {
    try {
      const pos = await getCurrentGeoPosition({ enableHighAccuracy: true, timeout: 10_000 });
      setFocusCoord([pos.longitude, pos.latitude]);
      setStatusMessage(
        `Carte centrée sur votre position (${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}).`
      );
    } catch {
      setStatusMessage('Position GPS indisponible sur cet appareil.');
    }
  };

  const handleLoadHistory = async () => {
    setHistoryOpen((v) => !v);
    if (historyItems !== null) return;
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/routes/history', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { items?: ImportableTrackEntry[] };
        setHistoryItems(Array.isArray(data.items) ? data.items : []);
      } else {
        setHistoryItems([]);
      }
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleImportHistoryEntry = (entry: ImportableTrackEntry) => {
    applyImportedCoordinates(
      entry.coordinates,
      entry.title,
      'imported_preserved',
      `import-${entry.kind}`
    );
    setHistoryOpen(false);
    setStatusMessage(`Tracé « ${entry.title} » importé (${entry.coordinates.length} pts).`);
  };

  const handleFileImport = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const pts = await readTraceFile(file);
      if (pts.length < 2) {
        setStatusMessage('Fichier invalide ou contenant moins de 2 points.');
        return;
      }
      applyImportedCoordinates(
        pts,
        file.name.replace(/\.(gpx|geojson|json)$/i, ''),
        'imported_preserved',
        'import-gpx'
      );
      setStatusMessage(`Fichier ${file.name} importé (${pts.length} pts).`);
    } catch {
      setStatusMessage('Impossible de lire ce fichier GPX/GeoJSON.');
    }
  };

  const handleRemoveLastSegment = () => {
    if (orderedPoints.length <= 2) {
      setStatusMessage(
        'Un itinéraire nécessite au moins 2 points (utilisez Effacer pour repartir à zéro).'
      );
      return;
    }
    const last = orderedPoints[orderedPoints.length - 1];
    void runOperation(
      { type: 'delete_point', pointId: last.id },
      { [last.id]: last.entityVersion }
    );
  };

  const handleClearTrack = () => {
    const first = orderedPoints[0];
    const baseLat = first?.lat ?? 45.052;
    const baseLon = first?.lon ?? 5.512;
    commitState({
      ...workspace,
      points: [
        {
          id: `pt-start-${Date.now().toString(36)}`,
          workspaceId: workspace.id,
          kind: 'start',
          orderKey: 'A',
          lat: baseLat,
          lon: baseLon,
          name: 'Départ',
          entityVersion: 1,
        },
        {
          id: `pt-end-${Date.now().toString(36)}`,
          workspaceId: workspace.id,
          kind: 'finish',
          orderKey: 'Z',
          lat: Number((baseLat + 0.005).toFixed(5)),
          lon: Number((baseLon + 0.005).toFixed(5)),
          name: 'Arrivée',
          entityVersion: 1,
        },
      ],
      sections: [],
      headSeq: workspace.headSeq + 1,
      updatedAt: new Date().toISOString(),
    });
    setStatusMessage('Tracé effacé. Dessinez sur la carte ou ajoutez des points.');
  };

  const poiCounts = useMemo(() => {
    const counts: Record<RoutePoiCategory, number> = {
      water: 0,
      shelter: 0,
      summit: 0,
      food_lodging: 0,
      access: 0,
      other: 0,
    };
    for (const p of knowledgePois) counts[p.category] += 1;
    return counts;
  }, [knowledgePois]);

  const filteredKnowledgePois = useMemo(
    () =>
      poiFilter === 'all' ? knowledgePois : knowledgePois.filter((p) => p.category === poiFilter),
    [knowledgePois, poiFilter]
  );

  return {
    currentUserId,
    currentUserName,
    serverSynced,
    shareToken,
    workspace,
    presence,
    opTracker,
    sheetOpen,
    setSheetOpen,
    detent,
    setDetent,
    tabIndex,
    setTabIndex,
    subDrawer,
    setSubDrawer,
    mapBase,
    setMapBase,
    mapMenuOpen,
    setMapMenuOpen,
    fitTrigger,
    setFitTrigger,
    focusCoord,
    setFocusCoord,
    listMode,
    setListMode,
    webglAvailable,
    setWebglAvailable,
    drawingMode,
    setDrawingMode,
    editingMode,
    setEditingMode,
    undoStack,
    redoStack,
    fileInputRef,
    historyOpen,
    setHistoryOpen,
    historyLoading,
    historyItems,
    knowledgeLoading,
    knowledgePois,
    liveWeather,
    nearbyRoutes,
    placeLabel,
    knowledgeSources,
    focusedPoiId,
    setFocusedPoiId,
    poiFilter,
    setPoiFilter,
    analyserSection,
    setAnalyserSection,
    userSearchQuery,
    userSearchResults,
    userSearchLoading,
    departChecks,
    setDepartChecks,
    overlayDetail,
    setOverlayDetail,
    selectedStageId,
    setSelectedStageId,
    selectedPointId,
    setSelectedPointId,
    selectedSectionId,
    setSelectedSectionId,
    hoveredCoord,
    setHoveredCoord,
    comparedVariantId,
    setComparedVariantId,
    online,
    setOnline,
    lastImpactText,
    setLastImpactText,
    routingBusy,
    routingIssue,
    activeConflict,
    setActiveConflict,
    statusMessage,
    setStatusMessage,
    gpxInput,
    setGpxInput,
    keepOriginalGpx,
    setKeepOriginalGpx,
    commentBody,
    setCommentBody,
    proposalTitle,
    setProposalTitle,
    proposalRationale,
    setProposalRationale,
    stageNotesDraft,
    setStageNotesDraft,
    carnetRecord,
    canEditGeo,
    canEditStages,
    canComment,
    canPropose,
    canReview,
    canPublish,
    canManageMembers,
    orderedPoints,
    totals,
    elevation,
    selectedStage,
    selectedPoint,
    selectedSection,
    comparedVariant,
    flattenedCoords,
    verifiedPack,
    offlineQueue,
    activeActivity,
    kitToRevalidateCount,
    openProposalsCount,
    orphanCommentsCount,
    totalWarnings,
    manualSectionsCount,
    hubSummary,
    terrainStats,
    elevationStats,
    poiCounts,
    filteredKnowledgePois,
    handleUndo,
    handleRedo,
    openSubDrawer,
    runOperation,
    /** Atelier le plus récent, y compris juste après une opération (le rendu n'a pas encore eu lieu). */
    getWorkspace: () => workspaceRef.current,
    handleRealRouteSection,
    handleReplayOffline,
    handleImportGpx,
    handleDownloadGpx,
    handlePublish,
    publishSyncIssue,
    retryPublishSync,
    handleDownloadPack,
    handleAddComment,
    handleRelocateComment,
    handleCreateProposal,
    handleVoteProposal,
    handleDecideProposal,
    handleCreateDetourVariant,
    handleAssignKitItem,
    handleRevalidateKitItem,
    handleManageShareLink,
    handleStartActivity,
    handleAddKitItems,
    handleAssignKitItems,
    handleFinishToCarnet,
    handleDuplicateFromCarnet,
    refreshKnowledgeBank,
    handleSplitIntoDays,
    handleSearchLkdvUsers,
    handleMemberRoleAction,
    handleRevokeMember,
    handleAssignStage,
    invitable,
    invitableLoading,
    loadInvitable,
    freshShareToken,
    realtimeStatus: realtime.status,
    proposalDraft,
    setProposalDraft,
    handleProposeFromConflict,
    handleFreehandDrawComplete,
    snapSectionsAroundPoint,
    handleDragPoint,
    placePoint,
    dragSectionLine,
    knowledgeLoadedAt,
    profileModel,
    profileCursor,
    setProfileCursor,
    profileReadout,
    cursorFromCoord,
    handleCenterMyPosition,
    handleLoadHistory,
    handleImportHistoryEntry,
    handleFileImport,
    handleRemoveLastSegment,
    handleClearTrack,
  };
}

/** Tout ce qu'exposent l'état et les handlers du Compas itinéraire (consommé via le contexte). */
export type RouteWorkspaceApi = ReturnType<typeof useRouteWorkspaceState>;
