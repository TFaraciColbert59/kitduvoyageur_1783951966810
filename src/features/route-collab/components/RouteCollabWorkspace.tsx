'use client';

import '@/styles/explorer-v2.css';
import './routeCollab.css';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Grip,
  Layers,
  LocateFixed,
  PenLine,
  Plus,
  Redo2,
  RefreshCw,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import type { ImportableTrackEntry } from '@/app/api/routes/history/route';
import { ATLAS_TILES } from '@/components/map/engine/createMapStyle';
import type { MapBase } from '@/features/compas/engine/mapStyle';
import { readTraceFile } from '@/features/community/v2/create/carnet/gpx';
import { ExplorerSheet, type SheetTab } from '@/features/explorer-v2/sheet/ExplorerSheet';
import {
  XpChips,
  XpEmpty,
  XpEyebrow,
  XpMetrics,
  XpRow,
  XpRows,
} from '@/features/explorer-v2/sheet/blocks';
import type { Detent } from '@/features/explorer-v2/state/types';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
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
} from '../engine';
import { summarizeWorkspaceForHub } from '../integrations';
import {
  computeSmartStageRecommendations,
  computeTechnicalTerrainStats,
  fetchRouteKnowledgeBank,
  type LiveWeatherInfo,
  type NearbyLkdvRoute,
  type RouteCorridorPoi,
  type RoutePoiCategory,
} from '../routeAnalysis';
import {
  EffortRadialGauge,
  ElevationAreaChart,
  ReadinessRadialRing,
  SlopeStackedVisual,
  SunDaylightArc,
  SurfaceStackedVisual,
  WeatherForecastChart,
} from './RouteAnalysisVisuals';
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
} from '../offlinePackStore';
import { hasRoutePermission } from '../permissions';
import type {
  ApplyOperationResult,
  CollaborativeKitItem,
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  CollaborativeStage,
  DomainConflict,
  OvernightPlace,
  PresenceEntry,
  RouteOperationInput,
  RouteOperationRecord,
  RouteProposal,
  RouteVariant,
  RouteWorkspaceState,
} from '../types';
import type { RouteCollabMapProps } from './RouteCollabMap';

const DynamicRouteMap = dynamic<RouteCollabMapProps>(
  () => import('./RouteCollabMap').then((m) => m.RouteCollabMap),
  {
    ssr: false,
    loading: () => <div className="xp-map" aria-hidden="true" />,
  },
);

export type SubDrawerId =
  | 'point'
  | 'section'
  | 'stage'
  | 'gpx'
  | 'variants'
  | 'kit'
  | 'terrain'
  | 'proposals'
  | 'sharing'
  | 'offline-carnet';

export interface RouteCollabWorkspaceProps {
  initialWorkspace: RouteWorkspaceState;
  currentUserId: string;
  currentUserName: string;
  /** Si vrai, toutes les mutations/lectures passent par /api/routes/[id]/* pour la vraie coédition multi-sessions. */
  serverSynced?: boolean;
  shareToken?: string | null;
  /** Pour les tests ou environnements sans WebGL. */
  forceNoWebGL?: boolean;
  /** Ouvre le tiroir dès le premier rendu (utile pour tests ou accès direct). */
  initialSheetOpen?: boolean;
  onWorkspaceChange?: (next: RouteWorkspaceState) => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Responsable',
  co_organizer: 'Coorganisateur',
  editor: 'Éditeur',
  contributor: 'Contributeur',
  participant: 'Participant',
  external_viewer: 'Lecteur externe',
};

type OvernightChipValue = 'none' | OvernightPlace['type'];

const OVERNIGHT_LABELS: Record<OvernightChipValue, string> = {
  none: 'Journée',
  refuge: 'Refuge',
  hut: 'Cabane',
  bivouac: 'Bivouac',
  camp: 'Camping',
  gite: 'Gîte',
  hotel: 'Hôtel',
};

const SECTION_MODE_LABELS: Record<string, string> = {
  routed: 'Routé',
  manual: 'Manuel',
  imported_preserved: 'Trace importée',
};

function computeStageMetrics(
  stage: CollaborativeStage,
  orderedPts: readonly CollaborativeRoutePoint[],
  sections: readonly CollaborativeRouteSection[],
): { distanceKm: number; ascentM: number | null; durationMin: number | null } {
  const startIdx = orderedPts.findIndex((p) => p.id === stage.startPointId);
  const endIdx = orderedPts.findIndex((p) => p.id === stage.endPointId);
  if (startIdx < 0 || endIdx <= startIdx) {
    return { distanceKm: 0, ascentM: null, durationMin: null };
  }
  const pointIds = new Set(orderedPts.slice(startIdx, endIdx + 1).map((p) => p.id));
  let dist = 0;
  let asc = 0;
  let hasAsc = false;
  let dur = 0;
  let hasDur = false;
  for (const s of sections) {
    if (pointIds.has(s.fromPointId) && pointIds.has(s.toPointId)) {
      dist += s.distanceKm;
      if (s.ascentM != null) {
        asc += s.ascentM;
        hasAsc = true;
      }
      if (s.durationMin != null) {
        dur += s.durationMin;
        hasDur = true;
      }
    }
  }
  return {
    distanceKm: Number(dist.toFixed(2)),
    ascentM: hasAsc ? Math.round(asc) : null,
    durationMin: hasDur ? Math.round(dur) : null,
  };
}

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

export function RouteCollabWorkspace({
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
  const [presence, setPresence] = useState<readonly PresenceEntry[]>([]);

  // État du tiroir Explorer (pilule 3 points -> tiroir principal -> sous-tiroirs)
  const [sheetOpen, setSheetOpen] = useState<boolean>(forceNoWebGL || initialSheetOpen);
  const [detent, setDetent] = useState<Detent>('mid');
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
  const [analyserSection, setAnalyserSection] = useState<'terrain' | 'milieu' | 'chemin'>('terrain');

  // Équipe : recherche membres LKDV & invitation rapide
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userSearchResults, setUserSearchResults] = useState<
    Array<{ id: string; full_name: string | null; location: string | null; trust_score: number | null }>
  >([]);
  const [userSearchLoading, setUserSearchLoading] = useState<boolean>(false);

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
    initialWorkspace.stages[0]?.id ?? null,
  );
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [hoveredCoord, setHoveredCoord] = useState<[number, number] | null>(null);
  const [comparedVariantId, setComparedVariantId] = useState<string | null>(null);

  // Réseau, impacts, conflits, formulaires
  const [online, setOnline] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.navigator.onLine : true,
  );
  const [lastImpactText, setLastImpactText] = useState<string | null>(null);
  const [routingBusy, setRoutingBusy] = useState<boolean>(false);
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
  const [stageNotesDraft, setStageNotesDraft] = useState<string>('');
  const [carnetRecord, setCarnetRecord] = useState<CarnetReturnRecord | null>(null);
  const [offlineTick, setOfflineTick] = useState<number>(0);

  const headSeqRef = useRef(workspace.headSeq);
  headSeqRef.current = workspace.headSeq;

  // Masquer la barre basse globale comme dans ExplorerV2 (écran carte pur)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.explorerSheetOpen = 'true';
    window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: true } }));
    return () => {
      delete document.documentElement.dataset.explorerSheetOpen;
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
    };
  }, []);

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
        setUndoStack((prev) => [...prev.slice(-49), workspace]);
        setRedoStack([]);
      }
      setWorkspace(next);
      onWorkspaceChange?.(next);
    },
    [onWorkspaceChange, workspace],
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

  // Synchronisation temps réel HTTP + présence multi-sessions
  useEffect(() => {
    if (!serverSynced || !online) return;
    let active = true;
    const tokenQs = shareToken ? `&token=${encodeURIComponent(shareToken)}` : '';

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/routes/${encodeURIComponent(workspace.id)}/changes?after=${headSeqRef.current}${tokenQs}`,
          { credentials: 'include', cache: 'no-store' },
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

    const timer = window.setInterval(() => void poll(), 1200);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [serverSynced, online, workspace.id, workspace.updatedAt, shareToken, commitState]);

  // Présence légère (étape active + entité sélectionnée)
  useEffect(() => {
    if (!serverSynced || !online || shareToken) return;
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
  }, [serverSynced, online, shareToken, workspace.id, selectedStageId, selectedPointId, selectedSectionId]);

  const currentMember = useMemo(
    () => workspace.members.find((m) => m.userId === currentUserId) ?? null,
    [workspace.members, currentUserId],
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
    [workspace.stages, selectedStageId],
  );
  const selectedPoint = useMemo(
    () => orderedPoints.find((p) => p.id === selectedPointId) ?? orderedPoints[0] ?? null,
    [orderedPoints, selectedPointId],
  );
  const selectedSection = useMemo(
    () => workspace.sections.find((s) => s.id === selectedSectionId) ?? workspace.sections[0] ?? null,
    [workspace.sections, selectedSectionId],
  );
  const comparedVariant = useMemo(
    () => workspace.variants.find((v) => v.id === comparedVariantId) ?? null,
    [workspace.variants, comparedVariantId],
  );
  const flattenedCoords = useMemo(
    () => workspace.sections.flatMap((s) => s.geometry.coordinates),
    [workspace.sections],
  );

  useEffect(() => {
    setStageNotesDraft(selectedStage?.notes ?? '');
  }, [selectedStage?.id, selectedStage?.notes]);

  const verifiedPack = useMemo(
    () => getLastVerifiedPack(currentUserId, workspace.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, workspace.id, workspace.updatedAt, workspace.publishedRevisionNo, offlineTick],
  );
  const offlineQueue = useMemo(
    () => listOfflineQueue(currentUserId, workspace.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, workspace.id, workspace.updatedAt, online, offlineTick],
  );
  const activeActivity = useMemo(
    () => getActiveActivityLink(currentUserId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, workspace.updatedAt, offlineTick],
  );

  const openSubDrawer = useCallback((id: SubDrawerId) => {
    setSheetOpen(true);
    setDetent('mid');
    setSubDrawer(id);
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
      expectedVersions: Record<string, number>,
    ): Promise<ApplyOperationResult> => {
      if (serverSynced) {
        const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/operations`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opId, baseSeq, expectedVersions, operation }),
        });
        const data = (await res.json()) as ApplyOperationResult & { error?: string };
        if (res.status === 401 || res.status === 403) {
          return {
            status: 'denied',
            reason: (data as { reason?: string }).reason ?? data.error ?? 'Accès refusé ou révoqué.',
          };
        }
        return data;
      }

      const { result, nextOpLog } = applyWorkspaceOperation(
        workspace,
        opLog,
        {
          opId,
          baseSeq,
          actorId: currentUserId,
          actorName: currentUserName,
          operation,
          expectedVersions,
        },
        new Date().toISOString(),
      );
      if (result.status === 'accepted') {
        setOpLog(nextOpLog);
      }
      return result;
    },
    [serverSynced, workspace, opLog, currentUserId, currentUserName],
  );

  const runOperation = useCallback(
    async (operation: RouteOperationInput, expectedVersions: Record<string, number> = {}) => {
      const opId = `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      if (!online) {
        enqueueOfflineOperation(currentUserId, {
          opId,
          workspaceId: workspace.id,
          baseSeq: workspace.headSeq,
          operation,
          expectedVersions,
          queuedAt: new Date().toISOString(),
        });
        setOfflineTick((v) => v + 1);
        setStatusMessage('Hors ligne : modification ajoutée à la file locale persistante.');
        return;
      }

      try {
        const result = await executeOperation(opId, workspace.headSeq, operation, expectedVersions);
        if (result.status === 'accepted') {
          commitState(result.workspace);
          setLastImpactText(formatImpact(result.impact));
        } else if (result.status === 'already_applied') {
          commitState(result.workspace);
        } else if (result.status === 'conflict') {
          setActiveConflict({ conflict: result.conflicts[0], pendingOp: operation });
          setSheetOpen(true);
          commitState(result.currentWorkspace);
        } else if (result.status === 'denied') {
          setStatusMessage(result.reason);
        } else if (result.status === 'stale_routing_discarded') {
          setStatusMessage(result.reason);
        }
      } catch {
        enqueueOfflineOperation(currentUserId, {
          opId,
          workspaceId: workspace.id,
          baseSeq: workspace.headSeq,
          operation,
          expectedVersions,
          queuedAt: new Date().toISOString(),
        });
        setOfflineTick((v) => v + 1);
        setStatusMessage('Réseau indisponible : opération placée en file locale persistante.');
      }
    },
    [commitState, currentUserId, executeOperation, online, workspace.headSeq, workspace.id],
  );

  // Recalcul réel via /api/route (Valhalla / Geoapify) + /api/elevation (DEM) avec empreinte d'entrée
  const handleRealRouteSection = async (sectionId: string) => {
    const sec = workspace.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const fromPt = orderedPoints.find((p) => p.id === sec.fromPointId);
    const toPt = orderedPoints.find((p) => p.id === sec.toPointId);
    if (!fromPt || !toPt) return;

    const fingerprint = computeRoutingFingerprint({
      from: fromPt,
      to: toPt,
      sport: workspace.sport,
      options: workspace.routingOptions,
    });
    setRoutingBusy(true);
    try {
      const ptsParam = `${fromPt.lon},${fromPt.lat};${toPt.lon},${toPt.lat}`;
      const res = await fetch(
        `/api/route?points=${encodeURIComponent(ptsParam)}&sport=${encodeURIComponent(workspace.sport)}`,
      );
      if (!res.ok) {
        setStatusMessage('Routeur indisponible : passez la section en mode manuel.');
        return;
      }
      const data = (await res.json()) as {
        status?: string;
        provider?: string;
        legs?: Array<{
          distanceKm?: number;
          durationMin?: number;
          geometry?:
            | Array<[number, number]>
            | { type: 'LineString'; coordinates: Array<[number, number]> };
        }>;
      };
      const leg = data.legs?.[0];
      const rawCoords = Array.isArray(leg?.geometry)
        ? leg.geometry
        : leg?.geometry && 'coordinates' in leg.geometry
          ? leg.geometry.coordinates
          : null;
      if (data.status !== 'ok' || !rawCoords || rawCoords.length < 2) {
        setStatusMessage('Aucun chemin routé trouvé — passez en mode manuel si hors réseau.');
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
        const eleParam = sampled.map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(';');
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

      await runOperation({
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
          profile: workspace.sport,
          confidence: 'verified',
        },
      });
      setStatusMessage(
        `Section recalculée via ${data.provider ?? 'routeur'} (${(leg?.distanceKm ?? sec.distanceKm).toFixed(2)} km, ${rawCoords.length} pts${ascentM != null ? `, D+ ${ascentM} m` : ''}).`,
      );
    } catch {
      setStatusMessage(
        'Échec du routage réseau : la trace précédente est conservée (mode manuel disponible).',
      );
    } finally {
      setRoutingBusy(false);
    }
  };

  const handleReplayOffline = async () => {
    const res = await replayOfflineQueue(currentUserId, workspace.id, async (queued) => {
      const r = await executeOperation(queued.opId, queued.baseSeq, queued.operation, {
        ...queued.expectedVersions,
      });
      if (r.status === 'accepted' || r.status === 'already_applied') {
        commitState(r.workspace);
      }
      return r;
    });
    setOfflineTick((v) => v + 1);
    setStatusMessage(
      `Synchronisation : ${res.appliedCount} appliquée(s), ${res.conflicts.length} conflit(s), ${res.rejected.length} refusée(s).`,
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
        : 'GPX importé.',
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
    setStatusMessage(stageId ? `Export GPX de l’étape téléchargé.` : 'Export GPX complet téléchargé.');
  };

  const handlePublish = async () => {
    const summary = `Publication v${(workspace.publishedRevisionNo ?? 0) + 1}`;
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
      setStatusMessage(`Version ${data.revision?.revisionNo} publiée et figée.`);
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
          : 'Téléchargement interrompu hors ligne.',
      );
      return;
    }
    const committed = commitVerifiedPack(
      currentUserId,
      latestPack,
      latestRev,
      new Date().toISOString(),
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

  const handleAddComment = async (anchorPointId?: string) => {
    if (!commentBody.trim() || !canComment) return;
    const targetPt =
      orderedPoints.find((p) => p.id === (anchorPointId ?? selectedPointId)) ?? orderedPoints[0];
    if (!targetPt) return;
    const anchor = {
      anchorType: 'point' as const,
      entityId: targetPt.id,
      entityVersion: targetPt.entityVersion,
      originalLat: targetPt.lat,
      originalLon: targetPt.lon,
      maxRelocateMeters: 250,
    };

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
        setCommentBody('');
        setStatusMessage(`Commentaire ancré sur ${targetPt.name ?? targetPt.kind}.`);
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
    setStatusMessage(`Commentaire ancré sur ${targetPt.name ?? targetPt.kind}.`);
  };

  const handleRelocateComment = async (commentId: string) => {
    const targetPt = selectedPoint ?? orderedPoints[0];
    if (!targetPt) return;
    const newAnchor = {
      anchorType: 'point' as const,
      entityId: targetPt.id,
      entityVersion: targetPt.entityVersion,
      originalLat: targetPt.lat,
      originalLon: targetPt.lon,
      maxRelocateMeters: 250,
    };
    if (serverSynced) {
      const res = await fetch(
        `/api/routes/${encodeURIComponent(workspace.id)}/comments/${encodeURIComponent(commentId)}/relocate`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newAnchor }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
        setStatusMessage(`Commentaire repositionné sur ${targetPt.name ?? targetPt.kind}.`);
      }
      return;
    }
    commitState({
      ...workspace,
      comments: workspace.comments.map((c) =>
        c.id === commentId ? { ...c, anchor: newAnchor, status: 'open' as const } : c,
      ),
      updatedAt: new Date().toISOString(),
    });
    setStatusMessage(`Commentaire repositionné sur ${targetPt.name ?? targetPt.kind}.`);
  };

  const handleCreateProposal = async () => {
    if (!proposalTitle.trim() || !canPropose || orderedPoints.length === 0) return;
    const target = orderedPoints[Math.floor(orderedPoints.length / 2)];
    const operations: RouteOperationInput[] = [
      {
        type: 'move_point',
        pointId: target.id,
        lat: Number((target.lat + 0.004).toFixed(5)),
        lon: Number((target.lon + 0.004).toFixed(5)),
      },
    ];

    if (serverSynced) {
      const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/proposals`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: proposalTitle.trim(),
          rationale: proposalRationale.trim() || 'Variante proposée',
          operations,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
        setProposalTitle('');
        setProposalRationale('');
        setStatusMessage('Proposition publiée pour relecture.');
      }
      return;
    }

    const prop: RouteProposal = {
      id: `prop-${Date.now().toString(36)}`,
      workspaceId: workspace.id,
      baseSeq: workspace.headSeq,
      createdBy: currentUserId,
      authorName: currentUserName,
      title: proposalTitle.trim(),
      rationale: proposalRationale.trim() || 'Variante proposée',
      scopeEntityIds: [target.id],
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
    setStatusMessage('Proposition publiée pour relecture.');
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
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
      }
      return;
    }
    commitState({
      ...workspace,
      proposals: workspace.proposals.map((p) =>
        p.id === proposalId ? { ...p, votes: { ...p.votes, [currentUserId]: vote } } : p,
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
        },
      );
      const data = (await res.json()) as { workspace?: RouteWorkspaceState; error?: string };
      if (!res.ok) {
        setStatusMessage(data.error ?? 'Impossible de traiter la proposition.');
        return;
      }
      if (data.workspace) commitState(data.workspace);
      setStatusMessage(decision === 'accept' ? 'Proposition acceptée et appliquée.' : 'Proposition refusée.');
      return;
    }

    if (decision === 'reject') {
      commitState({
        ...workspace,
        proposals: workspace.proposals.map((pr) =>
          pr.id === proposal.id ? { ...pr, status: 'rejected' } : pr,
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
        new Date().toISOString(),
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
        pr.id === proposal.id ? { ...pr, status: 'accepted' } : pr,
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
        : item,
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
      item.id === itemId ? { ...item, status: 'confirmed', revalidationReason: null } : item,
    );
    commitState({ ...workspace, kitItems: nextKit, updatedAt: new Date().toISOString() });
  };

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
          expiresInHours: 48,
          hidePrivateStartRadiusM: 300,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
        setStatusMessage(
          action === 'create'
            ? 'Lien lecture seule généré (48 h, zone de départ privée masquée).'
            : 'Lien de partage révoqué immédiatement.',
        );
      }
      return;
    }
    commitState({
      ...workspace,
      shareLink:
        action === 'create'
          ? {
              token: `lk-${Date.now().toString(36)}`,
              audience: 'external_viewer',
              expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
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
    setStatusMessage(
      action === 'create'
        ? 'Lien lecture seule généré (48 h, zone de départ privée masquée).'
        : 'Lien de partage révoqué.',
    );
  };

  const handleStartActivity = () => {
    const rev = verifiedPack?.revision ?? workspace.revisions[workspace.revisions.length - 1];
    if (!rev) {
      setStatusMessage('Publiez d’abord une version ou téléchargez un pack avant de démarrer.');
      return;
    }
    startActivityFromRevision(currentUserId, rev, new Date().toISOString());
    setOfflineTick((v) => v + 1);
    setStatusMessage(`Activité démarrée avec la version ${rev.revisionNo} et le snapshot du kit.`);
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

  const handleDuplicateFromCarnet = () => {
    const copy = duplicateWorkspaceWithProvenance({
      sourceWorkspace: workspace,
      newWorkspaceId: `ws-copy-${Date.now().toString(36)}`,
      newTripId: `trip-copy-${Date.now().toString(36)}`,
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
    (k) => k.status === 'needs_revalidation',
  ).length;
  const openProposalsCount = workspace.proposals.filter((p) => p.status === 'open').length;
  const orphanCommentsCount = workspace.comments.filter(
    (c) => c.status === 'needs_relocation',
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
      return { hasElevation: false, minEleM: null as number | null, maxEleM: null as number | null };
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
    if (orderedPoints.length < 2) {
      setStatusMessage('Ajoutez au moins 2 points pour découper en journées.');
      return;
    }
    if (safeDays > orderedPoints.length - 1) {
      // Insère automatiquement des points de coupure intermédiaires le long de la géométrie
      const needed = safeDays - (orderedPoints.length - 1);
      const track =
        flattenedCoords.length >= 2
          ? flattenedCoords
          : orderedPoints.map((p) => [p.lon, p.lat] as [number, number]);
      let afterId = orderedPoints[0].id;
      for (let i = 1; i <= needed; i += 1) {
        const ratio = i / (needed + 1);
        const coordIdx = Math.min(
          track.length - 1,
          Math.max(0, Math.floor(ratio * (track.length - 1))),
        );
        const [lon, lat] = track[coordIdx];
        const ptId = `pt-split-${Date.now().toString(36)}-${i}`;
        await runOperation({
          type: 'insert_point',
          pointId: ptId,
          afterPointId: afterId,
          lat,
          lon,
          name: `Étape ${i + 1}`,
        });
        afterId = ptId;
      }
    }
    await runOperation({ type: 'split_days', targetDays: safeDays });
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
        { credentials: 'include' },
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

  const handleMemberRoleAction = async (
    userId: string,
    role: 'co_organizer' | 'editor' | 'contributor' | 'participant',
    displayName?: string,
  ) => {
    if (!canManageMembers) return;
    if (serverSynced) {
      const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'role', userId, role, displayName }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
        setStatusMessage(`Droits mis à jour (${ROLE_LABELS[role] ?? role}).`);
      }
      return;
    }
    const existing = workspace.members.find((m) => m.userId === userId);
    const nextMembers = existing
      ? workspace.members.map((m) =>
          m.userId === userId ? { ...m, role, revokedAt: null } : m,
        )
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
    setStatusMessage(`${displayName || userId} ajouté(e) en tant que ${ROLE_LABELS[role] ?? role}.`);
  };

  const handleRevokeMember = async (userId: string) => {
    if (!canManageMembers) return;
    if (serverSynced) {
      const res = await fetch(`/api/routes/${encodeURIComponent(workspace.id)}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'revoke', userId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace?: RouteWorkspaceState };
        if (data.workspace) commitState(data.workspace);
        setStatusMessage('Accès révoqué.');
      }
      return;
    }
    commitState({
      ...workspace,
      members: workspace.members.map((m) =>
        m.userId === userId ? { ...m, revokedAt: new Date().toISOString() } : m,
      ),
      updatedAt: new Date().toISOString(),
    });
    setStatusMessage('Accès révoqué.');
  };

  const applyImportedCoordinates = useCallback(
    (
      coords: readonly [number, number][],
      title: string,
      mode: 'manual' | 'imported_preserved',
      providerLabel: string,
    ) => {
      if (coords.length < 2) return;
      const nowIso = new Date().toISOString();
      let distKm = 0;
      for (let i = 1; i < coords.length; i += 1) {
        distKm += haversineKm(
          { lat: coords[i - 1][1], lon: coords[i - 1][0] },
          { lat: coords[i][1], lon: coords[i][0] },
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
      const isCycling = workspace.sport === 'vtt' || workspace.sport === 'gravel' || workspace.sport === 'route';
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
    [commitState, workspace],
  );

  const handleFreehandDrawComplete = useCallback(
    (coords: readonly [number, number][]) => {
      applyImportedCoordinates(coords, workspace.title, 'manual', 'trace-manuelle');
      setDrawingMode(false);
      setSheetOpen(true);
      setStatusMessage(`Tracé dessiné (${coords.length} points).`);
    },
    [applyImportedCoordinates, workspace.title],
  );

  const handleDragPoint = useCallback(
    (pointId: string, lat: number, lon: number) => {
      const pt = orderedPoints.find((p) => p.id === pointId);
      if (!pt) return;
      void runOperation(
        { type: 'move_point', pointId, lat, lon },
        { [pointId]: pt.entityVersion },
      );
    },
    [orderedPoints, runOperation],
  );

  const handleCenterMyPosition = async () => {
    try {
      const pos = await getCurrentGeoPosition({ enableHighAccuracy: true, timeout: 10_000 });
      setFocusCoord([pos.longitude, pos.latitude]);
      setStatusMessage(`Carte centrée sur votre position (${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}).`);
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
    applyImportedCoordinates(entry.coordinates, entry.title, 'imported_preserved', `import-${entry.kind}`);
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
        'import-gpx',
      );
      setStatusMessage(`Fichier ${file.name} importé (${pts.length} pts).`);
    } catch {
      setStatusMessage('Impossible de lire ce fichier GPX/GeoJSON.');
    }
  };

  const handleRemoveLastSegment = () => {
    if (orderedPoints.length <= 2) {
      setStatusMessage('Un itinéraire nécessite au moins 2 points (utilisez Effacer pour repartir à zéro).');
      return;
    }
    const last = orderedPoints[orderedPoints.length - 1];
    void runOperation({ type: 'delete_point', pointId: last.id }, { [last.id]: last.entityVersion });
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

  // ── Conflit métier affiché dans le tiroir (impact & statut sont en haut d'écran) ──
  const renderBanners = () => (
    <>
      {activeConflict ? (
        <div className="rcw-conflict" role="alert" data-testid="conflict-modal">
          <strong>Conflit métier · {activeConflict.conflict.entityLabel}</strong>
          <span>{activeConflict.conflict.message}</span>
          <span>
            Actuel : {activeConflict.conflict.currentSummary} · Votre saisie :{' '}
            {activeConflict.conflict.yourSummary}
          </span>
          <div className="rcw-inline-actions">
            <button
              type="button"
              className="xp-secondary"
              onClick={() => setActiveConflict(null)}
            >
              Garder actuel
            </button>
            <button
              type="button"
              className="xp-primary"
              onClick={() => {
                const pending = activeConflict.pendingOp;
                setActiveConflict(null);
                void runOperation(pending, {});
              }}
            >
              Appliquer ma version
            </button>
            <button
              type="button"
              className="xp-secondary"
              onClick={() => {
                setActiveConflict(null);
                void handleCreateDetourVariant();
                openSubDrawer('variants');
              }}
            >
              Créer une variante
            </button>
          </div>
        </div>
      ) : null}
    </>
  );

  // ── Rendu des 11 Sous-Drawers ───────────────────────────────────────────────
  const renderSubDrawer = (): { title: string; subtitle: string; body: React.ReactNode } | null => {
    if (!subDrawer) return null;

    if (subDrawer === 'point') {
      const pt = selectedPoint;
      if (!pt) {
        return {
          title: 'Détail du point',
          subtitle: 'Aucun point sélectionné',
          body: <XpEmpty title="Aucun point" hint="Ajoutez un point sur la carte ou depuis l’onglet Tracer." />,
        };
      }
      const ptComments = workspace.comments.filter((c) => c.anchor.entityId === pt.id);
      return {
        title: pt.name || pt.kind,
        subtitle: `${pt.lat.toFixed(5)}, ${pt.lon.toFixed(5)} · v${pt.entityVersion}${pt.eleM != null ? ` · ${Math.round(pt.eleM)} m` : ''}`,
        body: (
          <div className="rcw-stack" data-testid="subdrawer-point">
            {renderBanners()}
            <XpMetrics
              items={[
                { label: 'Latitude', value: pt.lat.toFixed(4) },
                { label: 'Longitude', value: pt.lon.toFixed(4) },
                { label: 'Altitude', value: pt.eleM != null ? `${Math.round(pt.eleM)} m` : 'Inconnue' },
              ]}
            />
            {canEditGeo ? (
              <>
                <XpEyebrow>Actions sur ce point</XpEyebrow>
                <div className="rcw-inline-actions">
                  <button
                    type="button"
                    className="xp-primary"
                    onClick={() =>
                      void runOperation(
                        {
                          type: 'move_point',
                          pointId: pt.id,
                          lat: Number((pt.lat + 0.003).toFixed(5)),
                          lon: Number((pt.lon + 0.003).toFixed(5)),
                        },
                        { [pt.id]: pt.entityVersion },
                      )
                    }
                  >
                    Déplacer (+300 m NE)
                  </button>
                  {orderedPoints.length > 2 ? (
                    <button
                      type="button"
                      className="xp-secondary"
                      onClick={() => {
                        void runOperation(
                          { type: 'delete_point', pointId: pt.id },
                          { [pt.id]: pt.entityVersion },
                        );
                        setSubDrawer(null);
                      }}
                    >
                      Supprimer ce point
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            <XpEyebrow>Commentaires ancrés ({ptComments.length})</XpEyebrow>
            {ptComments.length > 0 ? (
              <XpRows>
                {ptComments.map((c) => (
                  <XpRow
                    key={c.id}
                    icon="msg"
                    tone={c.status === 'needs_relocation' ? 'warn' : 'ink'}
                    title={`${c.authorName} · ${c.body}`}
                    sub={`Rév. v${c.baseRevisionNo}`}
                    badge={{
                      label: c.status === 'needs_relocation' ? 'À repositionner' : 'Ouvert',
                      tone: c.status === 'needs_relocation' ? 'warn' : 'good',
                    }}
                  />
                ))}
              </XpRows>
            ) : (
              <p className="rcw-sub-note">Aucun commentaire ancré sur ce point.</p>
            )}

            {canComment ? (
              <div className="xp-form">
                <label>
                  Nouveau commentaire sur ce point
                  <input
                    type="text"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Ex : source à vérifier, refuge complet…"
                  />
                </label>
                <button
                  type="button"
                  className="xp-primary"
                  onClick={() => void handleAddComment(pt.id)}
                >
                  Ancrer le commentaire
                </button>
              </div>
            ) : null}
          </div>
        ),
      };
    }

    if (subDrawer === 'section') {
      const sec = selectedSection;
      if (!sec) {
        return {
          title: 'Détail du tronçon',
          subtitle: 'Aucun tronçon sélectionné',
          body: <XpEmpty title="Aucun tronçon" hint="Ajoutez au moins deux points pour former un tronçon." />,
        };
      }
      return {
        title: `Tronçon · ${SECTION_MODE_LABELS[sec.mode] ?? sec.mode}`,
        subtitle: `${sec.distanceKm} km · ${sec.provenance.provider} · v${sec.entityVersion}`,
        body: (
          <div className="rcw-stack" data-testid="subdrawer-section">
            {renderBanners()}
            <XpMetrics
              items={[
                { label: 'Distance', value: `${sec.distanceKm} km` },
                { label: 'D+', value: sec.ascentM != null ? `${sec.ascentM} m` : 'Inconnu' },
                { label: 'D−', value: sec.descentM != null ? `${sec.descentM} m` : 'Inconnu' },
                { label: 'Durée', value: sec.durationMin != null ? `${sec.durationMin} min` : '—' },
              ]}
            />
            <XpEyebrow>Routage & Mode</XpEyebrow>
            <XpRows>
              <XpRow
                icon="route"
                tone="good"
                title="Mode du tronçon"
                sub={`Provenance : ${sec.provenance.provider} (${sec.provenance.confidence})`}
                badge={{ label: SECTION_MODE_LABELS[sec.mode] ?? sec.mode, tone: sec.mode === 'manual' ? 'warn' : 'good' }}
              />
            </XpRows>
            {canEditGeo ? (
              <div className="rcw-inline-actions">
                <button
                  type="button"
                  className="xp-primary"
                  disabled={routingBusy}
                  onClick={() => void handleRealRouteSection(sec.id)}
                >
                  {routingBusy ? 'Calcul Valhalla + DEM…' : 'Recalculer via routeur'}
                </button>
                <button
                  type="button"
                  className="xp-secondary"
                  onClick={() =>
                    void runOperation(
                      {
                        type: 'set_section_mode',
                        sectionId: sec.id,
                        mode: sec.mode === 'manual' ? 'routed' : 'manual',
                      },
                      { [sec.id]: sec.entityVersion },
                    )
                  }
                >
                  {sec.mode === 'manual' ? 'Repasser en routé' : 'Passer en manuel'}
                </button>
              </div>
            ) : null}

            {sec.warnings.length > 0 ? (
              <>
                <XpEyebrow>Alertes sur ce tronçon</XpEyebrow>
                <XpRows>
                  {sec.warnings.map((w, i) => (
                    <XpRow key={i} icon="alert" tone="warn" title={w} />
                  ))}
                </XpRows>
              </>
            ) : null}
          </div>
        ),
      };
    }

    if (subDrawer === 'stage') {
      const st = selectedStage;
      if (!st) {
        return {
          title: 'Détail d’étape',
          subtitle: 'Aucune étape',
          body: <XpEmpty title="Aucune étape définie" />,
        };
      }
      const metrics = computeStageMetrics(st, orderedPoints, workspace.sections);
      const endPt = orderedPoints.find((p) => p.id === st.endPointId) ?? orderedPoints[orderedPoints.length - 1];
      const currentOvernight: OvernightChipValue = st.overnightPlace?.type ?? 'none';
      return {
        title: `Jour ${st.dayNumber} · ${st.title}`,
        subtitle: `${metrics.distanceKm} km · ${OVERNIGHT_LABELS[currentOvernight]}`,
        body: (
          <div className="rcw-stack" data-testid="subdrawer-stage">
            {renderBanners()}
            <XpMetrics
              items={[
                { label: 'Distance', value: `${metrics.distanceKm} km` },
                { label: 'D+', value: metrics.ascentM != null ? `${metrics.ascentM} m` : 'Inconnu' },
                { label: 'Durée', value: metrics.durationMin != null ? `${metrics.durationMin} min` : '—' },
              ]}
            />

            <XpEyebrow>Hébergement / Nuitée (Impact Graph)</XpEyebrow>
            <XpChips
              ariaLabel="Type de nuitée"
              value={currentOvernight}
              items={[
                { id: 'none', label: 'Journée' },
                { id: 'refuge', label: 'Refuge' },
                { id: 'bivouac', label: 'Bivouac' },
                { id: 'gite', label: 'Gîte' },
              ]}
              onChange={(kind) => {
                if (!canEditStages) return;
                const typed = kind as OvernightChipValue;
                void runOperation(
                  {
                    type: 'set_overnight',
                    stageId: st.id,
                    overnightPlace:
                      typed === 'none'
                        ? null
                        : {
                            id: `stay-${st.id}-${typed}`,
                            name:
                              typed === 'bivouac'
                                ? 'Bivouac du col'
                                : typed === 'refuge'
                                  ? 'Refuge gardé'
                                  : 'Gîte d’étape',
                            type: typed,
                            lat: endPt?.lat ?? 45.05,
                            lon: endPt?.lon ?? 5.51,
                            bookingStatus: 'planned',
                            provenance: 'Saisie organisateur',
                            lastVerifiedAt: new Date().toISOString(),
                          },
                  },
                  { [st.id]: st.entityVersion },
                );
              }}
            />

            {canEditStages && orderedPoints.length >= 3 ? (
              <>
                <XpEyebrow>Déplacer la fin d’étape</XpEyebrow>
                <select
                  className="rcw-select"
                  aria-label="Point de fin d’étape"
                  value={st.endPointId}
                  onChange={(e) =>
                    void runOperation(
                      { type: 'move_day_boundary', stageId: st.id, newEndPointId: e.target.value },
                      { [st.id]: st.entityVersion },
                    )
                  }
                >
                  {orderedPoints.slice(1).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.kind}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            <XpEyebrow>Notes de journée</XpEyebrow>
            <textarea
              className="rcw-textarea"
              rows={3}
              value={stageNotesDraft}
              onChange={(e) => setStageNotesDraft(e.target.value)}
              placeholder="Ravitaillement, horaire refuge, passage délicat…"
              disabled={!canEditStages}
            />
            <div className="rcw-inline-actions">
              {canEditStages ? (
                <button
                  type="button"
                  className="xp-primary"
                  onClick={() =>
                    void runOperation(
                      { type: 'update_stage_note', stageId: st.id, notes: stageNotesDraft },
                      { [st.id]: st.entityVersion },
                    )
                  }
                >
                  Enregistrer la note
                </button>
              ) : null}
              <button
                type="button"
                className="xp-secondary"
                onClick={() => handleDownloadGpx(st.id)}
              >
                Exporter GPX Jour {st.dayNumber}
              </button>
            </div>
          </div>
        ),
      };
    }

    if (subDrawer === 'gpx') {
      return {
        title: 'Importer / Exporter GPX',
        subtitle: `Provenance : ${workspace.sourceOrigin.kind}`,
        body: (
          <div className="rcw-stack" data-testid="subdrawer-gpx">
            {renderBanners()}
            <XpEyebrow>Exporter</XpEyebrow>
            <div className="rcw-inline-actions">
              <button type="button" className="xp-primary" onClick={() => handleDownloadGpx()}>
                Exporter GPX complet
              </button>
            </div>
            {workspace.stages.length > 0 ? (
              <XpRows>
                {workspace.stages.map((st) => {
                  const stM = computeStageMetrics(st, orderedPoints, workspace.sections);
                  return (
                    <XpRow
                      key={st.id}
                      icon="down"
                      tone="water"
                      title={`Exporter Jour ${st.dayNumber} · ${st.title}`}
                      sub={`${stM.distanceKm} km`}
                      onClick={() => handleDownloadGpx(st.id)}
                    />
                  );
                })}
              </XpRows>
            ) : null}

            <XpEyebrow>Importer un GPX</XpEyebrow>
            <label className="rcw-check-row">
              <input
                type="checkbox"
                checked={keepOriginalGpx}
                onChange={(e) => setKeepOriginalGpx(e.target.checked)}
              />
              <span>Garder ma trace (géométrie importée + XML original conservés)</span>
            </label>
            <textarea
              className="rcw-textarea"
              rows={4}
              value={gpxInput}
              onChange={(e) => setGpxInput(e.target.value)}
              placeholder="Collez un fichier GPX 1.1 (<gpx>…</gpx>)"
              aria-label="Contenu GPX à importer"
            />
            <button
              type="button"
              className="xp-primary"
              disabled={!canEditGeo || !gpxInput.trim()}
              onClick={handleImportGpx}
            >
              Importer ce GPX sur la carte
            </button>
          </div>
        ),
      };
    }

    if (subDrawer === 'variants') {
      return {
        title: 'Variantes & Comparateur',
        subtitle: `${workspace.variants.length} variante(s) enregistrée(s)`,
        body: (
          <div className="rcw-stack" data-testid="subdrawer-variants">
            {renderBanners()}
            {canEditGeo ? (
              <button
                type="button"
                className="xp-primary"
                onClick={() => void handleCreateDetourVariant()}
              >
                + Comparer un détour (+2,1 km)
              </button>
            ) : null}
            {workspace.variants.length === 0 ? (
              <XpEmpty
                title="Aucune variante"
                hint="Créez un détour pour comparer distance, dénivelé, durée et surface connue sur la carte."
              />
            ) : (
              <XpRows>
                {workspace.variants.map((v) => {
                  const active = comparedVariantId === v.id;
                  const knownPct = Math.round((v.replacements[0]?.surfaceKnownRatio ?? 0) * 100);
                  return (
                    <div key={v.id} className="rcw-stack">
                      <XpRow
                        icon="route"
                        tone={active ? 'warn' : 'ink'}
                        title={v.title}
                        sub={`Δ ${v.deltaDistanceKm > 0 ? '+' : ''}${v.deltaDistanceKm} km · Δ D+ ${v.deltaAscentM ?? '?'} m · Δ ${v.deltaDurationMin ?? '?'} min · Surface connue ${knownPct}%`}
                        badge={{ label: active ? 'Sur carte' : v.status, tone: active ? 'warn' : 'muted' }}
                        onClick={() => setComparedVariantId(active ? null : v.id)}
                      />
                      <div className="rcw-inline-actions">
                        <button
                          type="button"
                          className="xp-secondary"
                          onClick={() => setComparedVariantId(active ? null : v.id)}
                        >
                          {active ? 'Masquer sur carte' : 'Superposer sur carte'}
                        </button>
                        {canEditGeo ? (
                          <button
                            type="button"
                            className="xp-primary"
                            onClick={() => void runOperation({ type: 'apply_variant', variantId: v.id })}
                          >
                            Appliquer
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </XpRows>
            )}
          </div>
        ),
      };
    }

    if (subDrawer === 'kit') {
      return {
        title: 'Sac & Matériel',
        subtitle:
          kitToRevalidateCount > 0
            ? `${kitToRevalidateCount} article(s) à revalider`
            : 'Toutes les vérifications sont à jour',
        body: (
          <div className="rcw-stack" data-testid="subdrawer-kit">
            {renderBanners()}
            <XpEyebrow>Matériel personnel & commun</XpEyebrow>
            <XpRows>
              {workspace.kitItems.map((item) => (
                <div key={item.id} className="rcw-stack" data-testid={`kit-item-${item.id}`}>
                  <XpRow
                    icon={item.shared ? 'users' : 'pack'}
                    tone={item.status === 'needs_revalidation' ? 'warn' : 'good'}
                    title={`${item.name} (${item.shared ? 'Commun' : 'Personnel'})`}
                    sub={
                      item.revalidationReason
                        ? item.revalidationReason
                        : item.assigneeName
                          ? `Porté par ${item.assigneeName}`
                          : 'Non attribué'
                    }
                    badge={{
                      label:
                        item.status === 'needs_revalidation'
                          ? 'À revalider'
                          : item.status === 'confirmed'
                            ? 'Confirmé'
                            : 'À attribuer',
                      tone:
                        item.status === 'needs_revalidation'
                          ? 'warn'
                          : item.status === 'confirmed'
                            ? 'good'
                            : 'muted',
                    }}
                  />
                  <div className="rcw-inline-actions">
                    {item.shared ? (
                      <select
                        className="rcw-select"
                        aria-label={`Attribuer ${item.name}`}
                        value={item.assigneeUserId ?? ''}
                        onChange={(e) =>
                          void handleAssignKitItem(item.id, e.target.value || null)
                        }
                      >
                        <option value="">Non attribué</option>
                        {workspace.members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {item.status === 'needs_revalidation' ? (
                      <button
                        type="button"
                        className="xp-primary"
                        onClick={() => void handleRevalidateKitItem(item.id)}
                      >
                        Confirmer
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </XpRows>
          </div>
        ),
      };
    }

    if (subDrawer === 'terrain') {
      const st = selectedStage;
      return {
        title: 'Météo, Eau & Terrain',
        subtitle: st ? `Jour ${st.dayNumber} · ${st.title}` : 'Informations terrain',
        body: (
          <div className="rcw-stack" data-testid="subdrawer-terrain">
            {renderBanners()}
            <XpEyebrow>Météo datée par lieu et créneau</XpEyebrow>
            {st?.weatherSlice ? (
              <XpRows>
                <XpRow
                  icon="cloud"
                  tone={st.weatherSlice.status === 'stale' ? 'warn' : 'water'}
                  title={`${st.weatherSlice.locationLabel} · ${st.weatherSlice.forecastFor}`}
                  sub={`${st.weatherSlice.provider ?? 'Fournisseur inconnu'}${st.weatherSlice.fetchedAt ? ` · relevé ${st.weatherSlice.fetchedAt.slice(0, 10)}` : ''}${st.weatherSlice.windKph != null ? ` · vent ${st.weatherSlice.windKph} km/h` : ''}`}
                  badge={{
                    label:
                      st.weatherSlice.temperatureC != null
                        ? `${st.weatherSlice.temperatureC}°C`
                        : st.weatherSlice.status,
                    tone: st.weatherSlice.status === 'fresh' ? 'good' : 'warn',
                  }}
                />
              </XpRows>
            ) : (
              <XpEmpty
                title="Météo non chargée"
                hint="Aucune donnée météo disponible pour cette étape — valeur affichée comme inconnue."
              />
            )}

            <XpEyebrow>Points d’eau & potabilité</XpEyebrow>
            {st && st.waterObservations.length > 0 ? (
              <XpRows>
                {st.waterObservations.map((w) => (
                  <XpRow
                    key={w.id}
                    icon="drop"
                    tone={w.status === 'dry' ? 'bad' : w.status === 'unknown' ? 'warn' : 'water'}
                    title={w.name}
                    sub={`Potabilité : ${w.potableClaim === 'yes' ? 'Potable' : w.potableClaim === 'no' ? 'Non potable' : 'Non garantie'}${w.observedAt ? ` · observé le ${w.observedAt.slice(0, 10)}` : ' · date inconnue'}`}
                    badge={{
                      label: w.status === 'flowing' ? 'Coule' : w.status === 'dry' ? 'À sec' : 'Inconnu',
                      tone: w.status === 'flowing' ? 'good' : w.status === 'dry' ? 'bad' : 'warn',
                    }}
                  />
                ))}
              </XpRows>
            ) : (
              <p className="rcw-sub-note">Eau : inconnue sur cette étape (prévoir autonomie complète).</p>
            )}

            <XpEyebrow>Accès, refuges & dangers terrain</XpEyebrow>
            {st && st.hazards.length > 0 ? (
              <XpRows>
                {st.hazards.map((h) => (
                  <XpRow
                    key={h.id}
                    icon="alert"
                    tone="warn"
                    title={h.title}
                    sub={`${h.source} · observé le ${h.observedAt.slice(0, 10)}${h.expiresAt ? ` · expire le ${h.expiresAt.slice(0, 10)}` : ''}`}
                    badge={{ label: h.severitySource, tone: 'warn' }}
                  />
                ))}
              </XpRows>
            ) : (
              <p className="rcw-sub-note">
                Aucun danger terrain daté. Vérifiez l’ouverture des refuges et arrêtés locaux avant départ.
              </p>
            )}
          </div>
        ),
      };
    }

    if (subDrawer === 'proposals') {
      return {
        title: 'Commentaires & Propositions',
        subtitle: `${workspace.comments.length} commentaire(s) · ${openProposalsCount} proposition(s) ouverte(s)`,
        body: (
          <div className="rcw-stack" data-testid="subdrawer-proposals">
            {renderBanners()}
            <XpEyebrow>Commentaires ancrés ({workspace.comments.length})</XpEyebrow>
            {workspace.comments.length === 0 ? (
              <p className="rcw-sub-note">Aucun commentaire pour l’instant.</p>
            ) : (
              <XpRows>
                {workspace.comments.map((c) => (
                  <div key={c.id} className="rcw-stack">
                    <XpRow
                      icon="msg"
                      tone={c.status === 'needs_relocation' ? 'warn' : 'ink'}
                      title={`${c.authorName} · ${c.body}`}
                      sub={`Ancré sur ${c.anchor.anchorType} (${c.anchor.entityId})`}
                      badge={{
                        label: c.status === 'needs_relocation' ? 'À repositionner' : 'Actif',
                        tone: c.status === 'needs_relocation' ? 'warn' : 'good',
                      }}
                    />
                    {c.status === 'needs_relocation' && canComment ? (
                      <button
                        type="button"
                        className="xp-secondary"
                        onClick={() => void handleRelocateComment(c.id)}
                      >
                        Repositionner sur le point sélectionné
                      </button>
                    ) : null}
                  </div>
                ))}
              </XpRows>
            )}

            {canComment ? (
              <div className="xp-form">
                <label>
                  Commenter le point actif ({selectedPoint?.name ?? 'Départ'})
                  <input
                    type="text"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Commentaire ancré au point…"
                  />
                </label>
                <button
                  type="button"
                  className="xp-primary"
                  onClick={() => void handleAddComment()}
                >
                  Ajouter un commentaire
                </button>
              </div>
            ) : null}

            <XpEyebrow>Propositions de changement ({workspace.proposals.length})</XpEyebrow>
            {workspace.proposals.map((p) => {
              const upVotes = Object.values(p.votes).filter((v) => v === 'up').length;
              const downVotes = Object.values(p.votes).filter((v) => v === 'down').length;
              return (
                <div key={p.id} className="rcw-stack" data-testid={`proposal-${p.id}`}>
                  <XpRow
                    icon="spark"
                    tone={p.status === 'accepted' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn'}
                    title={`${p.title} (${p.authorName})`}
                    sub={`Motif : ${p.rationale} · Base seq ${p.baseSeq} · Votes +${upVotes}/-${downVotes}`}
                    badge={{
                      label:
                        p.status === 'open'
                          ? 'Ouverte'
                          : p.status === 'accepted'
                            ? 'Acceptée'
                            : 'Refusée',
                      tone: p.status === 'accepted' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn',
                    }}
                  />
                  {p.status === 'open' ? (
                    <div className="rcw-inline-actions">
                      <button
                        type="button"
                        className="xp-secondary"
                        onClick={() => void handleVoteProposal(p.id, 'up')}
                      >
                        Pour (+1)
                      </button>
                      {canReview ? (
                        <>
                          <button
                            type="button"
                            className="xp-primary"
                            onClick={() => void handleDecideProposal(p, 'accept')}
                          >
                            Accepter
                          </button>
                          <button
                            type="button"
                            className="xp-secondary"
                            onClick={() => void handleDecideProposal(p, 'reject')}
                          >
                            Refuser
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {canPropose ? (
              <div className="xp-form">
                <label>
                  Titre de proposition
                  <input
                    type="text"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    placeholder="Ex : Passer par la crête"
                  />
                </label>
                <label>
                  Motif (aperçu avant/après)
                  <input
                    type="text"
                    value={proposalRationale}
                    onChange={(e) => setProposalRationale(e.target.value)}
                    placeholder="Moins boueux après pluie…"
                  />
                </label>
                <button
                  type="button"
                  className="xp-primary"
                  onClick={() => void handleCreateProposal()}
                >
                  Proposer un changement
                </button>
              </div>
            ) : null}
          </div>
        ),
      };
    }

    if (subDrawer === 'sharing') {
      const activeShareUrl =
        workspace.shareLink && !workspace.shareLink.revokedAt
          ? `/compas/itineraire?workspaceId=${encodeURIComponent(workspace.id)}&token=${encodeURIComponent(workspace.shareLink.token)}`
          : null;
      return {
        title: 'Membres, Droits & Partage',
        subtitle: `${workspace.members.length} membre(s) · ${presence.length} en ligne`,
        body: (
          <div className="rcw-stack" data-testid="subdrawer-sharing">
            {renderBanners()}
            <XpEyebrow>Membres & rôles</XpEyebrow>
            <XpRows>
              {workspace.members.map((m) => {
                const onlineEntry = presence.find((pr) => pr.userId === m.userId);
                return (
                  <XpRow
                    key={m.userId}
                    icon="users"
                    tone={onlineEntry ? 'good' : 'ink'}
                    title={m.displayName}
                    sub={
                      onlineEntry
                        ? `En ligne · ${onlineEntry.mode === 'editing' ? 'Édition en cours' : 'Consultation'}`
                        : ROLE_LABELS[m.role] ?? m.role
                    }
                    badge={{
                      label: ROLE_LABELS[m.role] ?? m.role,
                      tone: m.role === 'owner' ? 'good' : 'muted',
                    }}
                  />
                );
              })}
            </XpRows>

            <XpEyebrow>Lien lecture seule révocable</XpEyebrow>
            {activeShareUrl ? (
              <>
                <div className="rcw-code-box" data-testid="share-link-url">
                  {activeShareUrl}
                </div>
                <p className="rcw-sub-note">
                  Zone de départ privée masquée ({workspace.shareLink?.hidePrivateStartRadiusM ?? 300} m).
                </p>
                <div className="rcw-inline-actions">
                  <button
                    type="button"
                    className="xp-secondary"
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        void navigator.clipboard.writeText(
                          `${window.location.origin}${activeShareUrl}`,
                        );
                        setStatusMessage('Lien copié dans le presse-papiers.');
                      }
                    }}
                  >
                    Copier le lien
                  </button>
                  {canManageMembers ? (
                    <button
                      type="button"
                      className="xp-secondary"
                      onClick={() => void handleManageShareLink('revoke')}
                    >
                      Révoquer le lien
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="rcw-sub-note">Aucun lien de partage actif.</p>
            )}
            {canManageMembers ? (
              <button
                type="button"
                className="xp-primary"
                onClick={() => void handleManageShareLink('create')}
              >
                Générer un lien lecture seule (48 h)
              </button>
            ) : null}
          </div>
        ),
      };
    }

    // subDrawer === 'offline-carnet'
    return {
      title: 'Hors ligne, Activité & Carnet',
      subtitle: verifiedPack
        ? `Pack v${verifiedPack.manifest.revisionNo} vérifié · ${online ? 'En ligne' : 'Mode avion'}`
        : online
          ? 'Aucun pack local · En ligne'
          : 'Mode avion',
      body: (
        <div className="rcw-stack" data-testid="subdrawer-offline-carnet">
          {renderBanners()}

          <XpEyebrow>Publication & Pack de départ</XpEyebrow>
          <XpMetrics
            items={[
              {
                label: 'Publiée',
                value: workspace.publishedRevisionNo ? `v${workspace.publishedRevisionNo}` : 'Aucune',
              },
              {
                label: 'Sur appareil',
                value: verifiedPack ? `v${verifiedPack.manifest.revisionNo}` : 'Aucun',
              },
              { label: 'File locale', value: `${offlineQueue.length} op` },
            ]}
          />
          {verifiedPack ? (
            <div className="rcw-code-box" data-testid="pack-manifest-info">
              Manifeste v{verifiedPack.manifest.revisionNo} ·{' '}
              {(verifiedPack.manifest.estimatedBytes / 1024).toFixed(1)} Ko · Checksum{' '}
              {verifiedPack.manifest.checksum.slice(0, 10)} · Vérifié le{' '}
              {verifiedPack.verifiedAt.slice(0, 19).replace('T', ' ')}
              <br />
              Inclus : {verifiedPack.manifest.includedItems.join(', ')}
              {verifiedPack.manifest.unavailableItems.length > 0
                ? ` · Indisponibles : ${verifiedPack.manifest.unavailableItems.join(', ')}`
                : ''}
            </div>
          ) : null}

          <div className="rcw-inline-actions">
            {canPublish ? (
              <button type="button" className="xp-primary" onClick={() => void handlePublish()}>
                Publier v{(workspace.publishedRevisionNo ?? 0) + 1}
              </button>
            ) : null}
            <button
              type="button"
              className="xp-primary"
              onClick={() => void handleDownloadPack(false)}
            >
              Télécharger le pack
            </button>
          </div>
          <div className="rcw-inline-actions">
            <button
              type="button"
              className="xp-secondary"
              onClick={() => void handleDownloadPack(true)}
            >
              Simuler coupure pack
            </button>
            <button
              type="button"
              className="xp-secondary"
              onClick={() => setOnline((v) => !v)}
            >
              {online ? 'Simuler mode avion' : 'Revenir en ligne'}
            </button>
          </div>

          {offlineQueue.length > 0 ? (
            <>
              <XpEyebrow>Opérations locales en attente ({offlineQueue.length})</XpEyebrow>
              <XpRows>
                {offlineQueue.map((q) => (
                  <XpRow
                    key={q.opId}
                    icon="clock"
                    tone="warn"
                    title={q.operation.type}
                    sub={`Base seq ${q.baseSeq} · ${q.queuedAt.slice(11, 19)}`}
                    badge={{ label: 'En attente', tone: 'warn' }}
                  />
                ))}
              </XpRows>
              <button
                type="button"
                className="xp-primary"
                disabled={!online}
                onClick={() => void handleReplayOffline()}
              >
                Synchroniser ({offlineQueue.length})
              </button>
            </>
          ) : null}

          <XpEyebrow>Activité & Carnet de retour</XpEyebrow>
          {activeActivity ? (
            <div className="rcw-stack" data-testid="active-activity-card">
              <XpRow
                icon="play"
                tone="good"
                title={`Activité en cours · Plan v${activeActivity.revisionNo}`}
                sub={`Snapshot du kit : ${activeActivity.kitSnapshot.length} article(s) figés`}
                badge={{ label: 'Active', tone: 'good' }}
              />
              {workspace.publishedRevisionNo &&
              workspace.publishedRevisionNo > activeActivity.revisionNo ? (
                <p className="rcw-sub-note">
                  Une version v{workspace.publishedRevisionNo} existe : changer de route en séance demande une action explicite.
                </p>
              ) : null}
              <button
                type="button"
                className="xp-primary"
                onClick={handleFinishToCarnet}
              >
                Terminer et ouvrir le carnet
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="xp-primary"
              onClick={handleStartActivity}
            >
              Démarrer l’activité
            </button>
          )}

          {carnetRecord ? (
            <div className="rcw-stack" data-testid="carnet-return-card">
              <XpEyebrow>Bilan Carnet (immuable)</XpEyebrow>
              <XpMetrics
                items={[
                  { label: 'Plan suivi', value: `v${carnetRecord.plannedRevisionNo}` },
                  { label: 'Distance', value: `${carnetRecord.recordedDistanceKm} km` },
                  { label: 'Kit emporté', value: `${carnetRecord.kitSnapshot.length} art.` },
                ]}
              />
              <button
                type="button"
                className="xp-primary"
                onClick={handleDuplicateFromCarnet}
              >
                Reprendre cette sortie
              </button>
            </div>
          ) : null}
        </div>
      ),
    };
  };

  // ── Les 5 onglets du Drawer Principal (`ExplorerSheet`) ─────────────────────
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
    () => (poiFilter === 'all' ? knowledgePois : knowledgePois.filter((p) => p.category === poiFilter)),
    [knowledgePois, poiFilter],
  );

  const mainTabs: SheetTab[] = [
    {
      id: 'tracer',
      label: 'Tracer',
      icon: 'route',
      render: () => (
        <div className="rcw-stack" data-testid="tab-panel-tracer">
          {renderBanners()}

          <div className="rcw-import-grid">
            <button
              type="button"
              className="rcw-import-card"
              onClick={() => void handleLoadHistory()}
              aria-expanded={historyOpen}
            >
              <span className="xp-row-ico" data-tone="good" aria-hidden="true">
                <Download size={15} />
              </span>
              <span className="rcw-import-card-text">
                <strong>Sorties, Carnets & Randos</strong>
                <span>Historique & enregistrés</span>
              </span>
            </button>
            <button
              type="button"
              className="rcw-import-card"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="xp-row-ico" data-tone="water" aria-hidden="true">
                <Upload size={15} />
              </span>
              <span className="rcw-import-card-text">
                <strong>Importer un GPX</strong>
                <span>Fichier .gpx ou GeoJSON</span>
              </span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx,application/gpx+xml,application/geo+json,application/json"
            className="xp-visually-hidden"
            aria-label="Importer un fichier GPX ou GeoJSON"
            onChange={(e) => {
              void handleFileImport(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          {historyOpen ? (
            <div className="rcw-stat-card" data-testid="history-import-list">
              <div className="rcw-bar-head">
                <span>Tracés disponibles</span>
                <button type="button" className="xp-chip" onClick={() => setHistoryOpen(false)}>
                  Fermer
                </button>
              </div>
              {historyLoading ? (
                <p className="rcw-sub-note">Chargement…</p>
              ) : !historyItems || historyItems.length === 0 ? (
                <p className="rcw-sub-note">
                  Aucune sortie GPS ou randonnée enregistrée trouvée pour ce compte.
                </p>
              ) : (
                <XpRows>
                  {historyItems.map((entry) => (
                    <XpRow
                      key={entry.id}
                      icon={entry.kind === 'carnet' ? 'book' : entry.kind === 'sortie' ? 'run' : 'route'}
                      tone={entry.kind === 'sortie' ? 'good' : entry.kind === 'carnet' ? 'water' : 'ink'}
                      title={entry.title}
                      sub={`${entry.subtitle}${entry.distanceKm != null ? ` · ${entry.distanceKm} km` : ''}${entry.ascentM != null ? ` · D+ ${entry.ascentM} m` : ''}`}
                      badge={{ label: entry.kind, tone: 'muted' }}
                      onClick={() => handleImportHistoryEntry(entry)}
                    />
                  ))}
                </XpRows>
              )}
            </div>
          ) : null}

          <div className="rcw-icon-toolbar" role="toolbar" aria-label="Outils de tracé et d’édition">
            <button
              type="button"
              className="rcw-icon-tool"
              aria-label={drawingMode ? 'Terminer le tracé' : 'Tracer sur la carte'}
              title={drawingMode ? 'Terminer le tracé' : 'Tracer sur la carte'}
              aria-pressed={drawingMode}
              disabled={!canEditGeo}
              onClick={() => {
                const next = !drawingMode;
                setDrawingMode(next);
                if (next) {
                  setEditingMode(false);
                  setSheetOpen(false);
                  setStatusMessage('Dessinez votre tracé directement sur la carte.');
                }
              }}
            >
              <PenLine size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="rcw-icon-tool"
              aria-label="Éditer les points sur la carte"
              title="Éditer les points sur la carte"
              aria-pressed={editingMode}
              disabled={!canEditGeo}
              onClick={() => {
                const next = !editingMode;
                setEditingMode(next);
                if (next) {
                  setDrawingMode(false);
                  setStatusMessage('Glissez les repères numérotés directement sur la carte.');
                }
              }}
            >
              <Grip size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="rcw-icon-tool"
              aria-label="Ma position"
              title="Ma position"
              onClick={() => void handleCenterMyPosition()}
            >
              <LocateFixed size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="rcw-icon-tool"
              aria-label="Annuler le dernier geste"
              title="Annuler"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
            >
              <Undo2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="rcw-icon-tool"
              aria-label="Rétablir le geste annulé"
              title="Rétablir"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
            >
              <Redo2 size={16} aria-hidden="true" />
            </button>
            {canEditGeo ? (
              <>
                <button
                  type="button"
                  className="rcw-icon-tool"
                  aria-label="Retirer le dernier point"
                  title="Retirer le dernier point"
                  onClick={handleRemoveLastSegment}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="rcw-icon-tool"
                  aria-label="Effacer le tracé"
                  title="Effacer le tracé"
                  onClick={handleClearTrack}
                >
                  <XpIcon name="x" size={16} />
                </button>
                <button
                  type="button"
                  className="rcw-icon-tool rcw-icon-tool--primary"
                  aria-label="Ajouter un point"
                  title="Ajouter un point"
                  onClick={() => {
                    const last = orderedPoints[orderedPoints.length - 1];
                    void runOperation({
                      type: 'insert_point',
                      pointId: `pt-${Date.now().toString(36)}`,
                      afterPointId: last?.id ?? null,
                      lat: Number(((last?.lat ?? 45.05) + 0.01).toFixed(5)),
                      lon: Number(((last?.lon ?? 5.51) + 0.01).toFixed(5)),
                      name: `Passage ${orderedPoints.length + 1}`,
                    });
                  }}
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'etapes',
      label: 'Étapes',
      icon: 'flag',
      render: () => {
        const isMultiDay = workspace.stages.length > 1;
        return (
          <div className="rcw-stack" data-testid="tab-panel-etapes">
            {renderBanners()}

            {canEditStages ? (
              <div className="rcw-splitter-bar" data-testid="day-splitter-bar">
                <span className="rcw-splitter-label">
                  {workspace.stages.length} jour{workspace.stages.length > 1 ? 's' : ''}
                </span>
                <div className="rcw-splitter-pills">
                  {[1, 2, 3, 4, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`rcw-split-pill${workspace.stages.length === d ? ' is-active' : ''}`}
                      onClick={() => void handleSplitIntoDays(d)}
                    >
                      {d}j
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rcw-split-pill"
                    aria-label="Retirer une journée"
                    disabled={workspace.stages.length <= 1}
                    onClick={() => void handleSplitIntoDays(workspace.stages.length - 1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="rcw-split-pill"
                    aria-label="Ajouter une journée"
                    onClick={() => void handleSplitIntoDays(workspace.stages.length + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ) : null}

            {workspace.stages.map((st) => {
              const kind: OvernightChipValue = st.overnightPlace?.type ?? 'none';
              const stM = computeStageMetrics(st, orderedPoints, workspace.sections);
              const sIdx = orderedPoints.findIndex((p) => p.id === st.startPointId);
              const eIdx = orderedPoints.findIndex((p) => p.id === st.endPointId);
              const stagePoints =
                sIdx >= 0 && eIdx >= sIdx ? orderedPoints.slice(sIdx, eIdx + 1) : orderedPoints;
              const stageMoments = knowledgePois.slice(0, 4);
              const smartRecs = computeSmartStageRecommendations({
                stagePoints,
                pois: knowledgePois,
                nearbyRoutes,
                distanceKm: stM.distanceKm,
                ascentM: stM.ascentM,
                overnightType: kind === 'none' ? 'none' : kind,
              });
              return (
                <div key={st.id} className="rcw-day-card" data-testid={`day-category-${st.id}`}>
                  <button
                    type="button"
                    className="rcw-day-head"
                    onClick={() => {
                      setSelectedStageId(st.id);
                      setOverlayDetail({ kind: 'day', stageId: st.id, precision: 2 });
                    }}
                  >
                    <span className="xp-row-text">
                      <span className="xp-row-title">
                        {isMultiDay ? `Jour ${st.dayNumber} · ${st.title}` : st.title}
                      </span>
                      <span className="xp-row-sub">
                        {stM.distanceKm} km{stM.ascentM != null ? ` · +${stM.ascentM} m` : ''} ·{' '}
                        {st.overnightPlace?.name ?? OVERNIGHT_LABELS[kind]}
                      </span>
                    </span>
                    <span className="xp-badge" data-tone={kind === 'bivouac' ? 'warn' : 'good'}>
                      {OVERNIGHT_LABELS[kind]}
                    </span>
                  </button>

                  {canEditStages ? (
                    <div className="rcw-subpill-row">
                      {(['none', 'refuge', 'bivouac', 'gite'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`rcw-mini-chip${kind === opt ? ' is-active' : ''}`}
                          onClick={() => {
                            const endPt = stagePoints[stagePoints.length - 1] ?? orderedPoints[orderedPoints.length - 1];
                            void runOperation({
                              type: 'set_overnight',
                              stageId: st.id,
                              overnightPlace:
                                opt === 'none'
                                  ? null
                                  : {
                                      id: `ovn-${st.id}-${opt}`,
                                      type: opt,
                                      name: `${OVERNIGHT_LABELS[opt]} J${st.dayNumber}`,
                                      lat: endPt?.lat ?? 45.05,
                                      lon: endPt?.lon ?? 5.51,
                                      bookingStatus: 'planned',
                                      provenance: 'manuel',
                                      lastVerifiedAt: new Date().toISOString(),
                                    },
                            });
                          }}
                        >
                          {OVERNIGHT_LABELS[opt]}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {smartRecs.length > 0 ? (
                    <div className="rcw-cat-group">
                      <span className="rcw-cat-label">Recommandations LKDV</span>
                      <div className="rcw-rec-list">
                        {smartRecs.slice(0, 3).map((rec) => (
                          <div key={rec.id} className="rcw-rec-chip">
                            <button
                              type="button"
                              className="rcw-rec-main"
                              onClick={() => {
                                if (rec.poi) {
                                  setFocusedPoiId(rec.poi.id);
                                  setFocusCoord([rec.poi.lon, rec.poi.lat]);
                                  setOverlayDetail({
                                    kind: 'poi',
                                    poi: rec.poi,
                                    stageId: st.id,
                                    precision: 2,
                                  });
                                }
                              }}
                            >
                              <strong>{rec.title}</strong>
                              <span>{rec.reason}</span>
                            </button>
                            {rec.suggestedOvernightType && canEditStages ? (
                              <button
                                type="button"
                                className="rcw-rec-apply"
                                onClick={() =>
                                  void runOperation({
                                    type: 'set_overnight',
                                    stageId: st.id,
                                    overnightPlace: {
                                      id: rec.poi?.id ?? `ovn-${st.id}`,
                                      type: rec.suggestedOvernightType!,
                                      name: rec.title,
                                      lat: rec.poi?.lat ?? stagePoints[stagePoints.length - 1]?.lat ?? 45.05,
                                      lon: rec.poi?.lon ?? stagePoints[stagePoints.length - 1]?.lon ?? 5.51,
                                      bookingStatus: 'planned',
                                      provenance: rec.poi?.source ?? 'LKDV',
                                      lastVerifiedAt: new Date().toISOString(),
                                    },
                                  })
                                }
                              >
                                Choisir
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rcw-cat-group">
                    <span className="rcw-cat-label">Points sur le parcours</span>
                    <div className="rcw-subpill-row">
                      {stagePoints.map((pt) => (
                        <button
                          key={pt.id}
                          type="button"
                          className="rcw-subpill"
                          onClick={() => {
                            setSelectedPointId(pt.id);
                            setFocusCoord([pt.lon, pt.lat]);
                            setOverlayDetail({
                              kind: 'point',
                              pointId: pt.id,
                              stageId: st.id,
                              precision: 2,
                            });
                          }}
                        >
                          <XpIcon name="pin" size={12} />
                          <span>{pt.name || pt.kind}</span>
                        </button>
                      ))}
                    </div>

                    <span className="rcw-cat-label">Moments à vivre & lieux intéressants</span>
                    <div className="rcw-subpill-row">
                      {stageMoments.length > 0 ? (
                        stageMoments.map((poi) => (
                          <button
                            key={poi.id}
                            type="button"
                            className="rcw-subpill"
                            onClick={() => {
                              setFocusedPoiId(poi.id);
                              setFocusCoord([poi.lon, poi.lat]);
                              setOverlayDetail({
                                kind: 'poi',
                                poi,
                                stageId: st.id,
                                precision: 2,
                              });
                            }}
                          >
                            <XpIcon name="spark" size={12} />
                            <span>{poi.name}</span>
                          </button>
                        ))
                      ) : (
                        <button
                          type="button"
                          className="rcw-subpill"
                          onClick={() => {
                            void refreshKnowledgeBank();
                          }}
                        >
                          <XpIcon name="spark" size={12} />
                          <span>{knowledgeLoading ? 'Recherche LKDV…' : 'Charger les repères'}</span>
                        </button>
                      )}
                    </div>

                    <span className="rcw-cat-label">Détails</span>
                    <div className="rcw-subpill-row">
                      <button
                        type="button"
                        className="rcw-subpill"
                        onClick={() => {
                          setSelectedStageId(st.id);
                          setOverlayDetail({ kind: 'day', stageId: st.id, precision: 3 });
                        }}
                      >
                        <XpIcon name="tent" size={12} />
                        <span>Nuitée & Notes</span>
                      </button>
                      <button
                        type="button"
                        className="rcw-subpill"
                        onClick={() =>
                          setOverlayDetail({ kind: 'kit', stageId: st.id, precision: 2 })
                        }
                      >
                        <XpIcon name="pack" size={12} />
                        <span>
                          Sac lié
                          {kitToRevalidateCount > 0 ? ` (${kitToRevalidateCount})` : ''}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      id: 'analyser',
      label: 'Analyser',
      icon: 'pulse',
      render: () => (
        <div className="rcw-stack" data-testid="tab-panel-analyser">
          {renderBanners()}

          {analyserSection === 'terrain' ? (
            <>
              <ElevationAreaChart
                samples={elevation.samples}
                minEleM={elevationStats.minEleM}
                avgEleM={terrainStats.avgAltitudeM}
                maxEleM={elevationStats.maxEleM}
                onHoverRatio={(ratio) => {
                  if (ratio == null || flattenedCoords.length === 0) {
                    setHoveredCoord(null);
                    return;
                  }
                  const idx = Math.floor(ratio * Math.max(0, flattenedCoords.length - 1));
                  if (flattenedCoords[idx]) setHoveredCoord(flattenedCoords[idx]);
                }}
              />

              <EffortRadialGauge stats={terrainStats} />

              <SlopeStackedVisual stats={terrainStats} />

              <SurfaceStackedVisual
                stats={terrainStats}
                sectionsCount={workspace.sections.length}
                warningsCount={totalWarnings}
              />

              <XpRows>
                <XpRow
                  icon="spark"
                  tone="warn"
                  title="Variantes & Comparateur"
                  sub="Comparer un détour sur la carte"
                  badge={{ label: `${workspace.variants.length}`, tone: 'muted' }}
                  trailing={<XpIcon name="chevr" size={15} />}
                  onClick={() => openSubDrawer('variants')}
                />
              </XpRows>
            </>
          ) : null}

          {analyserSection === 'milieu' ? (
            <>
              <SunDaylightArc stats={terrainStats} />

              <WeatherForecastChart weather={liveWeather} loading={knowledgeLoading} />

              {placeLabel ? (
                <div className="rcw-sub-note">Secteur : {placeLabel}</div>
              ) : null}

              <XpRows>
                <XpRow
                  icon="alert"
                  tone="warn"
                  title="Observations terrain, eau & dangers"
                  sub="Potabilité, arrêtés, dates de vérification"
                  trailing={<XpIcon name="chevr" size={15} />}
                  onClick={() => openSubDrawer('terrain')}
                />
              </XpRows>
            </>
          ) : null}

          {analyserSection === 'chemin' ? (
            <>
              <div className="rcw-bar-head">
                <XpChips
                  ariaLabel="Filtrer les repères"
                  value={poiFilter}
                  items={[
                    { id: 'all', label: `Tout (${knowledgePois.length})` },
                    { id: 'water', label: `Eau (${poiCounts.water})` },
                    { id: 'shelter', label: `Refuges (${poiCounts.shelter})` },
                    { id: 'summit', label: `Sommets (${poiCounts.summit})` },
                    { id: 'food_lodging', label: `Ravit. (${poiCounts.food_lodging})` },
                    { id: 'access', label: `Accès (${poiCounts.access})` },
                  ]}
                  onChange={(id) => setPoiFilter(id as 'all' | RoutePoiCategory)}
                />
                <button
                  type="button"
                  className="xp-chip"
                  aria-label="Actualiser la banque d’informations"
                  disabled={knowledgeLoading}
                  onClick={() => void refreshKnowledgeBank()}
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              {knowledgeLoading && knowledgePois.length === 0 ? (
                <XpEmpty title="Analyse en cours…" hint="Interrogation Base LKDV, OpenStreetMap et MET Norway." />
              ) : filteredKnowledgePois.length === 0 ? (
                <XpEmpty
                  title="Aucun repère dans cette catégorie"
                  hint="Aucune donnée recensée sur ce corridor — prévoyez votre autonomie."
                />
              ) : (
                <XpRows>
                  {filteredKnowledgePois.slice(0, 30).map((poi) => (
                    <XpRow
                      key={poi.id}
                      icon={
                        poi.category === 'water'
                          ? 'drop'
                          : poi.category === 'shelter'
                            ? 'tent'
                            : poi.category === 'summit'
                              ? 'mtn'
                              : poi.category === 'food_lodging'
                                ? 'house'
                                : 'pin'
                      }
                      tone={focusedPoiId === poi.id ? 'warn' : poi.category === 'water' ? 'water' : 'good'}
                      title={poi.name}
                      sub={`${poi.rawCategory}${poi.altitudeM != null ? ` · ${Math.round(poi.altitudeM)} m` : ''} · ${poi.source}`}
                      badge={{
                        label:
                          poi.distanceToTrackM < 1000
                            ? `${poi.distanceToTrackM} m`
                            : `${(poi.distanceToTrackM / 1000).toFixed(1)} km`,
                        tone: poi.distanceToTrackM <= 500 ? 'good' : 'muted',
                      }}
                      onClick={() => {
                        setFocusedPoiId(poi.id);
                        setFocusCoord([poi.lon, poi.lat]);
                        setOverlayDetail({ kind: 'poi', poi, precision: 2 });
                      }}
                    />
                  ))}
                </XpRows>
              )}

              {knowledgeSources.length > 0 ? (
                <p className="rcw-sub-note">Sources : {knowledgeSources.join(' · ')}.</p>
              ) : null}
            </>
          ) : null}
        </div>
      ),
    },
    {
      id: 'equipe',
      label: 'Équipe',
      icon: 'users',
      render: () => {
        const activeMembers = workspace.members.filter((m) => !m.revokedAt);
        const sharedKit = workspace.kitItems;
        return (
          <div className="rcw-stack" data-testid="tab-panel-equipe">
            {renderBanners()}

            {/* Présence en direct */}
            <div className="rcw-visual-card">
              <div className="rcw-visual-head">
                <span className="rcw-visual-title">
                  Coédition ({presence.length > 0 ? `${presence.length} en ligne` : `${activeMembers.length} membre(s)`})
                </span>
                <span className="rcw-mini-pill">Seq {workspace.headSeq}</span>
              </div>
              <div className="rcw-avatar-strip">
                {(presence.length > 0 ? presence : activeMembers).map((entry) => {
                  const name = 'displayName' in entry ? entry.displayName : 'Membre';
                  const initials = name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? '')
                    .join('');
                  const isLive = presence.some((p) => p.userId === entry.userId);
                  return (
                    <div key={entry.userId} className="rcw-avatar-pill" title={name}>
                      <span className="rcw-avatar-circle">
                        {initials || 'M'}
                        <i className={`rcw-dot ${isLive ? 'is-live' : ''}`} />
                      </span>
                      <span className="rcw-avatar-name">{name.split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Membres & Droits + Recherche LKDV */}
            <div className="rcw-visual-card">
              <div className="rcw-visual-head">
                <span className="rcw-visual-title">Membres & Droits ({activeMembers.length})</span>
                <button
                  type="button"
                  className="rcw-mini-chip"
                  onClick={() => openSubDrawer('sharing')}
                >
                  Partage & Lien
                </button>
              </div>

              {canManageMembers ? (
                <div className="rcw-search-row">
                  <input
                    type="search"
                    className="rcw-input"
                    placeholder="Inviter un membre LKDV (nom)…"
                    value={userSearchQuery}
                    onChange={(e) => void handleSearchLkdvUsers(e.target.value)}
                  />
                </div>
              ) : null}

              {userSearchLoading ? (
                <p className="rcw-sub-note">Recherche en cours…</p>
              ) : userSearchResults.length > 0 ? (
                <div className="rcw-rec-list">
                  {userSearchResults.map((u) => {
                    const already = activeMembers.some((m) => m.userId === u.id);
                    return (
                      <div key={u.id} className="rcw-rec-chip">
                        <div className="rcw-rec-main">
                          <strong>{u.full_name || 'Voyageur LKDV'}</strong>
                          <span>{u.location || 'Communauté LKDV'}</span>
                        </div>
                        <button
                          type="button"
                          className="rcw-rec-apply"
                          disabled={already}
                          onClick={() =>
                            void handleMemberRoleAction(u.id, 'editor', u.full_name || 'Voyageur LKDV')
                          }
                        >
                          {already ? 'Membre' : '+ Éditeur'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="rcw-member-list">
                {activeMembers.map((m) => (
                  <div key={m.userId} className="rcw-member-row">
                    <div className="rcw-member-info">
                      <strong>{m.displayName}</strong>
                      <span>{ROLE_LABELS[m.role] ?? m.role}</span>
                    </div>
                    {canManageMembers && m.role !== 'owner' && m.userId !== currentUserId ? (
                      <div className="rcw-member-actions">
                        <select
                          aria-label={`Rôle de ${m.displayName}`}
                          className="rcw-select-sm"
                          value={m.role}
                          onChange={(e) =>
                            void handleMemberRoleAction(
                              m.userId,
                              e.target.value as 'co_organizer' | 'editor' | 'contributor' | 'participant',
                              m.displayName,
                            )
                          }
                        >
                          <option value="co_organizer">Coorganisateur</option>
                          <option value="editor">Éditeur</option>
                          <option value="contributor">Contributeur</option>
                          <option value="participant">Participant</option>
                        </select>
                        <button
                          type="button"
                          className="rcw-split-pill"
                          aria-label={`Révoquer ${m.displayName}`}
                          onClick={() => void handleRevokeMember(m.userId)}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <span className="xp-badge" data-tone={m.role === 'owner' ? 'good' : 'muted'}>
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Matériel commun & Attribution */}
            <div className="rcw-visual-card">
              <div className="rcw-visual-head">
                <span className="rcw-visual-title">Matériel commun ({sharedKit.length})</span>
                <button
                  type="button"
                  className="rcw-mini-chip"
                  onClick={() => openSubDrawer('kit')}
                >
                  Gérer tout
                </button>
              </div>
              {sharedKit.length === 0 ? (
                <p className="rcw-sub-note">Aucun article partagé pour l’instant.</p>
              ) : (
                <div className="rcw-member-list">
                  {sharedKit.slice(0, 4).map((item) => (
                    <div key={item.id} className="rcw-member-row">
                      <div className="rcw-member-info">
                        <strong>{item.name}</strong>
                        <span>
                          {item.assigneeName ? `Porté par ${item.assigneeName}` : 'Non attribué'}
                        </span>
                      </div>
                      {item.status === 'needs_revalidation' ? (
                        <button
                          type="button"
                          className="rcw-rec-apply"
                          onClick={() => void handleRevalidateKitItem(item.id)}
                        >
                          Revalider
                        </button>
                      ) : !item.assigneeUserId ? (
                        <button
                          type="button"
                          className="rcw-mini-chip"
                          onClick={() => void handleAssignKitItem(item.id, currentUserId)}
                        >
                          Je prends
                        </button>
                      ) : (
                        <span className="xp-badge" data-tone="good">
                          OK
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commentaire rapide + Propositions + Hub */}
            <div className="rcw-visual-card">
              <div className="rcw-visual-head">
                <span className="rcw-visual-title">
                  Discussion ({workspace.comments.length}) · Propositions ({openProposalsCount})
                </span>
                <button
                  type="button"
                  className="rcw-mini-chip"
                  onClick={() => openSubDrawer('proposals')}
                >
                  Voir tout
                </button>
              </div>
              <div className="rcw-search-row">
                <input
                  type="text"
                  className="rcw-input"
                  placeholder="Note rapide pour le groupe…"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                />
                <button
                  type="button"
                  className="rcw-rec-apply"
                  disabled={!commentBody.trim()}
                  onClick={() => void handleAddComment()}
                >
                  Envoyer
                </button>
              </div>
              <div className="rcw-sub-note">
                Hub : <Link href={hubSummary.href}>{hubSummary.title}</Link> ({hubSummary.totalDistanceKm} km)
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'depart',
      label: 'Départ',
      icon: 'pack',
      render: () => {
        const hasTrack = orderedPoints.length >= 2;
        const hasPack = Boolean(verifiedPack);
        const kitReady = kitToRevalidateCount === 0;
        const weatherReady = Boolean(liveWeather) || departChecks.weather;
        const checks = [
          hasTrack && departChecks.track,
          hasPack,
          kitReady,
          weatherReady,
          departChecks.safety,
        ];
        const scorePct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
        return (
          <div className="rcw-stack" data-testid="tab-panel-depart">
            {renderBanners()}

            <ReadinessRadialRing
              scorePct={scorePct}
              label={
                scorePct >= 80
                  ? 'Prêt pour le départ'
                  : scorePct >= 50
                    ? 'Préparation avancée'
                    : 'Préparation à finaliser'
              }
              sublabel={`${totals.distanceKm} km · ${workspace.stages.length} étape(s) · ${
                workspace.publishedRevisionNo
                  ? `Version v${workspace.publishedRevisionNo}`
                  : `Brouillon seq ${workspace.headSeq}`
              }`}
            />

            {/* Checklist interactive avant départ */}
            <div className="rcw-visual-card">
              <div className="rcw-visual-head">
                <span className="rcw-visual-title">Checklist avant départ</span>
                <span className="rcw-mini-pill">{online ? 'En ligne' : 'Mode avion'}</span>
              </div>
              <XpRows>
                <XpRow
                  icon="flag"
                  tone={hasTrack && departChecks.track ? 'good' : 'warn'}
                  title="Tracé & étapes validés"
                  sub={`${orderedPoints.length} point(s) · ${totalWarnings} alerte(s)`}
                  badge={{ label: departChecks.track ? 'Validé' : 'À vérifier', tone: departChecks.track ? 'good' : 'warn' }}
                  onClick={() => setDepartChecks((c) => ({ ...c, track: !c.track }))}
                />
                <XpRow
                  icon="offline"
                  tone={hasPack ? 'good' : 'warn'}
                  title="Pack hors-ligne embarqué"
                  sub={
                    verifiedPack
                      ? `Pack v${verifiedPack.manifest.revisionNo} vérifié sur cet appareil`
                      : 'Téléchargez le pack pour l’accès sans réseau'
                  }
                  badge={{ label: verifiedPack ? `v${verifiedPack.manifest.revisionNo}` : 'Absent', tone: verifiedPack ? 'good' : 'warn' }}
                  onClick={() => openSubDrawer('offline-carnet')}
                />
                <XpRow
                  icon="pack"
                  tone={kitReady ? 'good' : 'warn'}
                  title="Sac & matériel vérifiés"
                  sub={
                    kitReady
                      ? `${workspace.kitItems.length} article(s) confirmé(s)`
                      : `${kitToRevalidateCount} article(s) à revalider`
                  }
                  badge={{ label: kitReady ? 'Prêt' : `${kitToRevalidateCount} à revoir`, tone: kitReady ? 'good' : 'warn' }}
                  onClick={() => openSubDrawer('kit')}
                />
                <XpRow
                  icon="cloud"
                  tone={weatherReady ? 'good' : 'muted'}
                  title="Météo & sécurité au départ"
                  sub={
                    liveWeather
                      ? `${liveWeather.conditionLabel} · ${liveWeather.temperatureC ?? '—'}°C · Vent ${liveWeather.windKph ?? '—'} km/h`
                      : 'Vérifier les conditions avant de partir'
                  }
                  badge={{ label: weatherReady ? 'Vérifié' : 'À voir', tone: weatherReady ? 'good' : 'muted' }}
                  onClick={() => setDepartChecks((c) => ({ ...c, weather: !c.weather }))}
                />
                <XpRow
                  icon="alert"
                  tone={departChecks.safety ? 'good' : 'muted'}
                  title="Batterie, secours & trace partagée"
                  sub="Téléphone chargé, lien Hub partagé"
                  badge={{ label: departChecks.safety ? 'OK' : 'Cocher', tone: departChecks.safety ? 'good' : 'muted' }}
                  onClick={() => setDepartChecks((c) => ({ ...c, safety: !c.safety }))}
                />
              </XpRows>
            </div>

            <div className="rcw-inline-actions">
              {canPublish ? (
                <button type="button" className="xp-primary" onClick={() => void handlePublish()}>
                  Publier v{(workspace.publishedRevisionNo ?? 0) + 1}
                </button>
              ) : null}
              <button
                type="button"
                className="xp-secondary"
                onClick={() => void handleDownloadPack(false)}
              >
                Pack hors ligne
              </button>
              <button
                type="button"
                className="xp-secondary"
                onClick={() => handleDownloadGpx()}
              >
                Export GPX
              </button>
              <button
                type="button"
                className="xp-secondary"
                onClick={() => openSubDrawer('offline-carnet')}
              >
                Activité & Carnet
              </button>
            </div>
          </div>
        );
      },
    },
  ];

  const activeSubDrawer = renderSubDrawer();

  return (
    <div
      className="xp-root rcw-explorer-root"
      data-theme="light"
      data-sheet-open={sheetOpen ? 'true' : 'false'}
      data-testid="route-collab-workspace"
      data-head-seq={workspace.headSeq}
    >
      {/* ÉLÉMENT 1 : CARTE PLEIN ÉCRAN (ou surface liste accessible sans WebGL) */}
      {!listMode && webglAvailable ? (
        <DynamicRouteMap
          points={orderedPoints}
          sections={workspace.sections}
          base={mapBase}
          fitTrigger={fitTrigger}
          focusCoord={focusCoord}
          comparedVariant={comparedVariant}
          hoveredCoord={hoveredCoord}
          selectedPointId={selectedPointId}
          selectedSectionId={selectedSectionId}
          analysisPois={knowledgePois}
          focusedPoiId={focusedPoiId}
          canEdit={canEditGeo}
          drawingMode={drawingMode}
          editingMode={editingMode}
          onMapClickAddPoint={(lat, lon) => {
            const last = orderedPoints[orderedPoints.length - 1];
            const newId = `pt-${Date.now().toString(36)}`;
            void runOperation({
              type: 'insert_point',
              pointId: newId,
              afterPointId: last?.id ?? null,
              lat,
              lon,
              name: `Passage ${orderedPoints.length + 1}`,
            });
            setSelectedPointId(newId);
            setFocusCoord([lon, lat]);
          }}
          onFreehandDrawComplete={handleFreehandDrawComplete}
          onDragPoint={handleDragPoint}
          onSelectPoint={(pointId) => {
            const pt = orderedPoints.find((p) => p.id === pointId);
            setSelectedPointId(pointId);
            setSelectedSectionId(null);
            if (pt) {
              setFocusCoord([pt.lon, pt.lat]);
              setHoveredCoord([pt.lon, pt.lat]);
            }
            openSubDrawer('point');
          }}
          onSelectSection={(sectionId) => {
            setSelectedSectionId(sectionId);
            setSelectedPointId(null);
            openSubDrawer('section');
          }}
          onSelectPoi={(poi) => {
            setFocusedPoiId(poi.id);
            setFocusCoord([poi.lon, poi.lat]);
            setStatusMessage(`${poi.name} (${poi.rawCategory} · ${poi.distanceToTrackM} m du tracé).`);
          }}
          onMapError={(reason) => {
            setWebglAvailable(false);
            setListMode(true);
            setSheetOpen(true);
            setStatusMessage(`Mode liste activé automatiquement (${reason}).`);
          }}
        />
      ) : (
        <div
          className="rcw-list-surface"
          data-testid="list-mode-fallback"
          role="region"
          aria-label="Vue liste accessible sans carte"
        >
          <div className="rcw-list-surface-inner">
            <XpEyebrow>
              Mode liste sans carte · {workspace.title} ({totals.distanceKm} km)
            </XpEyebrow>
            <XpRows>
              {orderedPoints.map((pt, idx) => (
                <XpRow
                  key={pt.id}
                  icon="pin"
                  tone={selectedPointId === pt.id ? 'warn' : 'ink'}
                  title={`${idx + 1}. ${pt.name || pt.kind}`}
                  sub={`${pt.lat.toFixed(4)}, ${pt.lon.toFixed(4)}`}
                  onClick={() => {
                    setSelectedPointId(pt.id);
                    openSubDrawer('point');
                  }}
                />
              ))}
            </XpRows>
            <XpRows>
              {workspace.stages.map((st) => {
                const stM = computeStageMetrics(st, orderedPoints, workspace.sections);
                return (
                  <XpRow
                    key={st.id}
                    icon="flag"
                    tone="good"
                    title={`Jour ${st.dayNumber} · ${st.title}`}
                    sub={`${stM.distanceKm} km · ${st.overnightPlace?.name ?? 'Journée'}`}
                    onClick={() => {
                      setSelectedStageId(st.id);
                      openSubDrawer('stage');
                    }}
                  />
                );
              })}
            </XpRows>
          </div>
        </div>
      )}

      {/* PILULE TÉLÉMÉTRIE ÉPURÉE + IMPACT / STATUT TOUT EN HAUT AU CENTRE DE L'ÉCRAN */}
      <div className="rcw-top-stack">
        <div className="rcw-top-telemetry-pill" data-testid="top-telemetry-pill">
          <span>{totals.distanceKm} km</span>
          <span className="rcw-top-telemetry-sep">·</span>
          <span>D+ {totals.ascentM != null ? `${totals.ascentM} m` : '—'}</span>
          <span className="rcw-top-telemetry-sep">·</span>
          <span>D− {totals.descentM != null ? `${totals.descentM} m` : '—'}</span>
          <span className="rcw-top-telemetry-sep">·</span>
          <span>{totals.durationMin != null ? `${totals.durationMin} min` : '—'}</span>
        </div>
        {drawingMode ? (
          <div className="rcw-top-toast rcw-top-toast--mode" role="status">
            <span>Mode tracé actif · dessinez directement sur la carte</span>
            <button
              type="button"
              className="xp-chip"
              onClick={() => {
                setDrawingMode(false);
                setSheetOpen(true);
              }}
            >
              Terminer
            </button>
          </div>
        ) : null}
        {editingMode ? (
          <div className="rcw-top-toast rcw-top-toast--mode" role="status">
            <span>Mode édition actif · glissez les repères numérotés</span>
            <button
              type="button"
              className="xp-chip"
              onClick={() => setEditingMode(false)}
            >
              Terminer
            </button>
          </div>
        ) : null}
        {lastImpactText ? (
          <div className="rcw-top-toast rcw-top-toast--impact" role="status" data-testid="impact-banner">
            <span>
              <strong>Impact · </strong>
              {lastImpactText}
            </span>
            <button
              type="button"
              className="xp-chip"
              onClick={() => setLastImpactText(null)}
              aria-label="Fermer l'impact"
            >
              OK
            </button>
          </div>
        ) : null}
        {statusMessage ? (
          <div className="rcw-top-toast" role="status" data-testid="status-message">
            <span>{statusMessage}</span>
            <button
              type="button"
              className="xp-chip"
              onClick={() => setStatusMessage(null)}
              aria-label="Fermer le message"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>

      {/* CARTE & AFFICHAGE EN HAUT À DROITE DE LA CARTE */}
      <div className="rcw-map-topright">
        <button
          type="button"
          className="xp-icon-btn"
          data-testid="map-settings-trigger"
          aria-label="Carte et affichage"
          aria-expanded={mapMenuOpen}
          onClick={() => setMapMenuOpen((v) => !v)}
        >
          <Layers size={18} aria-hidden="true" />
        </button>
        {mapMenuOpen ? (
          <div className="rcw-map-popover" data-testid="map-settings-popover" role="dialog" aria-label="Carte et affichage">
            <XpEyebrow>Fond de carte</XpEyebrow>
            <XpChips
              ariaLabel="Fond de carte"
              value={mapBase}
              items={[
                { id: 'osm', label: 'Plan OSM' },
                { id: 'topo', label: 'Relief' },
                { id: 'satellite', label: 'Satellite' },
              ]}
              onChange={(id) => setMapBase(id as MapBase)}
            />
            <p className="rcw-sub-note">{ATLAS_TILES[mapBase].short}</p>
            <button
              type="button"
              className="xp-secondary"
              style={{ marginBottom: 0 }}
              onClick={() => {
                setFitTrigger((n) => n + 1);
                setMapMenuOpen(false);
                setStatusMessage('Carte recentrée sur l’itinéraire.');
              }}
            >
              Recentrer sur l’itinéraire
            </button>
            <button
              type="button"
              className="xp-secondary"
              style={{ marginBottom: 0 }}
              onClick={() => {
                setListMode((v) => !v);
                setMapMenuOpen(false);
              }}
            >
              {listMode ? 'Revenir à la vue carte' : 'Mode liste sans carte'}
            </button>
          </div>
        ) : null}
      </div>

      {/* ÉLÉMENT 2 : TIROIR EXPLORER (ou pilule 3 petits points en bas lorsque fermé) */}
      {sheetOpen ? (
        <ExplorerSheet
          title={activeSubDrawer ? activeSubDrawer.title : ''}
          subtitle={activeSubDrawer ? activeSubDrawer.subtitle : null}
          tabs={activeSubDrawer ? undefined : mainTabs}
          tab={tabIndex}
          onTab={(idx) => setTabIndex(idx)}
          detent={detent}
          onDetent={(d) => setDetent(d)}
          onBack={activeSubDrawer ? () => setSubDrawer(null) : undefined}
          onClose={() => {
            setSubDrawer(null);
            setSheetOpen(false);
          }}
          bottomInset={0}
          labelledBy="rcw-sheet-title"
          tabsBottom={false}
          mini={
            !activeSubDrawer && tabIndex === 2
              ? {
                  items: [
                    { id: 'terrain', label: 'Terrain', icon: 'mtn' },
                    { id: 'milieu', label: 'Milieu & Météo', icon: 'cloud' },
                    { id: 'chemin', label: `Sur le chemin (${knowledgePois.length})`, icon: 'pin' },
                  ],
                  value: analyserSection === 'terrain' ? 0 : analyserSection === 'milieu' ? 1 : 2,
                  onChange: (idx) =>
                    setAnalyserSection(idx === 0 ? 'terrain' : idx === 1 ? 'milieu' : 'chemin'),
                }
              : null
          }
        >
          {activeSubDrawer ? activeSubDrawer.body : null}
        </ExplorerSheet>
      ) : (
        <button
          type="button"
          className="xp-sheet-pill-launcher"
          data-testid="route-drawer-pill"
          aria-label="Ouvrir le tiroir d’itinéraire"
          onClick={() => {
            setSheetOpen(true);
            setDetent('mid');
          }}
        >
          <span className="xp-pill-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      )}

      {/* TIROIR SUPERPOSÉ HIÉRARCHIQUE (Étapes -> Catégories -> Sous-catégories avec +/- précision) */}
      {overlayDetail ? (
        <div className="rcw-overlay-sheet" data-testid="overlay-detail-drawer">
          {(() => {
            if (overlayDetail.kind === 'day') {
              const st = workspace.stages.find((s) => s.id === overlayDetail.stageId);
              if (!st) return null;
              const stM = computeStageMetrics(st, orderedPoints, workspace.sections);
              const currentOvernight: OvernightChipValue = st.overnightPlace?.type ?? 'none';
              const endPt = orderedPoints.find((p) => p.id === st.endPointId);
              return (
                <ExplorerSheet
                  title={`Jour ${st.dayNumber} · ${st.title}`}
                  subtitle={`${stM.distanceKm} km · Précision ${overlayDetail.precision}/3`}
                  tab={0}
                  onTab={() => undefined}
                  detent="mid"
                  onDetent={() => undefined}
                  onBack={() => setOverlayDetail(null)}
                  onClose={() => setOverlayDetail(null)}
                  bottomInset={0}
                >
                  <div className="rcw-stack">
                    <div className="rcw-precision-bar">
                      <button
                        type="button"
                        className="xp-chip"
                        disabled={overlayDetail.precision <= 1}
                        onClick={() =>
                          setOverlayDetail({
                            ...overlayDetail,
                            precision: Math.max(1, overlayDetail.precision - 1) as 1 | 2 | 3,
                          })
                        }
                      >
                        − Moins de précision
                      </button>
                      <span>{overlayDetail.precision === 1 ? 'Vue globale' : overlayDetail.precision === 2 ? 'Catégories' : 'Détails complets'}</span>
                      <button
                        type="button"
                        className="xp-chip"
                        disabled={overlayDetail.precision >= 3}
                        onClick={() =>
                          setOverlayDetail({
                            ...overlayDetail,
                            precision: Math.min(3, overlayDetail.precision + 1) as 1 | 2 | 3,
                          })
                        }
                      >
                        + Plus de précision
                      </button>
                    </div>
                    <XpMetrics
                      items={[
                        { label: 'Distance', value: `${stM.distanceKm} km` },
                        { label: 'D+', value: stM.ascentM != null ? `${stM.ascentM} m` : '—' },
                        { label: 'Durée', value: stM.durationMin != null ? `${stM.durationMin} min` : '—' },
                      ]}
                    />
                    {overlayDetail.precision >= 2 ? (
                      <>
                        <XpEyebrow>Nuitée & Hébergement</XpEyebrow>
                        <XpChips
                          ariaLabel="Type de nuitée"
                          value={currentOvernight}
                          items={[
                            { id: 'none', label: 'Journée' },
                            { id: 'refuge', label: 'Refuge' },
                            { id: 'bivouac', label: 'Bivouac' },
                            { id: 'gite', label: 'Gîte' },
                          ]}
                          onChange={(kind) => {
                            if (!canEditStages) return;
                            const typed = kind as OvernightChipValue;
                            void runOperation(
                              {
                                type: 'set_overnight',
                                stageId: st.id,
                                overnightPlace:
                                  typed === 'none'
                                    ? null
                                    : {
                                        id: `stay-${st.id}-${typed}`,
                                        name: typed === 'bivouac' ? 'Bivouac du col' : typed === 'refuge' ? 'Refuge gardé' : 'Gîte d’étape',
                                        type: typed,
                                        lat: endPt?.lat ?? 45.05,
                                        lon: endPt?.lon ?? 5.51,
                                        bookingStatus: 'planned',
                                        provenance: 'Saisie organisateur',
                                        lastVerifiedAt: new Date().toISOString(),
                                      },
                              },
                              { [st.id]: st.entityVersion },
                            );
                          }}
                        />
                      </>
                    ) : null}
                    {overlayDetail.precision >= 3 ? (
                      <>
                        <XpEyebrow>Notes & Export de l’étape</XpEyebrow>
                        <textarea
                          className="rcw-textarea"
                          rows={3}
                          value={stageNotesDraft}
                          onChange={(e) => setStageNotesDraft(e.target.value)}
                          placeholder="Ravitaillement, horaire refuge…"
                          disabled={!canEditStages}
                        />
                        <div className="rcw-inline-actions">
                          {canEditStages ? (
                            <button
                              type="button"
                              className="xp-primary"
                              onClick={() =>
                                void runOperation(
                                  { type: 'update_stage_note', stageId: st.id, notes: stageNotesDraft },
                                  { [st.id]: st.entityVersion },
                                )
                              }
                            >
                              Enregistrer
                            </button>
                          ) : null}
                          <button type="button" className="xp-secondary" onClick={() => handleDownloadGpx(st.id)}>
                            GPX Jour {st.dayNumber}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </ExplorerSheet>
              );
            }

            if (overlayDetail.kind === 'point') {
              const pt = orderedPoints.find((p) => p.id === overlayDetail.pointId);
              if (!pt) return null;
              return (
                <ExplorerSheet
                  title={pt.name || pt.kind}
                  subtitle={`${pt.lat.toFixed(4)}, ${pt.lon.toFixed(4)} · Précision ${overlayDetail.precision}/3`}
                  tab={0}
                  onTab={() => undefined}
                  detent="mid"
                  onDetent={() => undefined}
                  onBack={() => setOverlayDetail(null)}
                  onClose={() => setOverlayDetail(null)}
                  bottomInset={0}
                >
                  <div className="rcw-stack">
                    <div className="rcw-precision-bar">
                      <button
                        type="button"
                        className="xp-chip"
                        onClick={() =>
                          overlayDetail.precision <= 1 && overlayDetail.stageId
                            ? setOverlayDetail({ kind: 'day', stageId: overlayDetail.stageId, precision: 2 })
                            : setOverlayDetail({
                                ...overlayDetail,
                                precision: Math.max(1, overlayDetail.precision - 1) as 1 | 2 | 3,
                              })
                        }
                      >
                        − {overlayDetail.precision <= 1 && overlayDetail.stageId ? 'Remonter au jour' : 'Moins de précision'}
                      </button>
                      <button
                        type="button"
                        className="xp-chip"
                        disabled={overlayDetail.precision >= 3}
                        onClick={() =>
                          setOverlayDetail({
                            ...overlayDetail,
                            precision: Math.min(3, overlayDetail.precision + 1) as 1 | 2 | 3,
                          })
                        }
                      >
                        + Plus de précision
                      </button>
                    </div>
                    <XpMetrics
                      items={[
                        { label: 'Latitude', value: pt.lat.toFixed(4) },
                        { label: 'Longitude', value: pt.lon.toFixed(4) },
                        { label: 'Altitude', value: pt.eleM != null ? `${Math.round(pt.eleM)} m` : '—' },
                      ]}
                    />
                    {overlayDetail.precision >= 2 && canEditGeo ? (
                      <div className="rcw-inline-actions">
                        <button
                          type="button"
                          className="xp-primary"
                          onClick={() =>
                            void runOperation(
                              {
                                type: 'move_point',
                                pointId: pt.id,
                                lat: Number((pt.lat + 0.003).toFixed(5)),
                                lon: Number((pt.lon + 0.003).toFixed(5)),
                              },
                              { [pt.id]: pt.entityVersion },
                            )
                          }
                        >
                          Déplacer (+300 m)
                        </button>
                        {orderedPoints.length > 2 ? (
                          <button
                            type="button"
                            className="xp-secondary"
                            onClick={() => {
                              void runOperation({ type: 'delete_point', pointId: pt.id }, { [pt.id]: pt.entityVersion });
                              setOverlayDetail(null);
                            }}
                          >
                            Supprimer
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {overlayDetail.precision >= 3 && canComment ? (
                      <div className="xp-form">
                        <label>
                          Note / commentaire sur ce point
                          <input
                            type="text"
                            value={commentBody}
                            onChange={(e) => setCommentBody(e.target.value)}
                            placeholder="Source, passage, abri…"
                          />
                        </label>
                        <button type="button" className="xp-primary" onClick={() => void handleAddComment(pt.id)}>
                          Ancrer le commentaire
                        </button>
                      </div>
                    ) : null}
                  </div>
                </ExplorerSheet>
              );
            }

            if (overlayDetail.kind === 'poi') {
              const { poi } = overlayDetail;
              return (
                <ExplorerSheet
                  title={poi.name}
                  subtitle={`${poi.rawCategory} · ${poi.distanceToTrackM} m du tracé`}
                  tab={0}
                  onTab={() => undefined}
                  detent="mid"
                  onDetent={() => undefined}
                  onBack={() => setOverlayDetail(null)}
                  onClose={() => setOverlayDetail(null)}
                  bottomInset={0}
                >
                  <div className="rcw-stack">
                    <div className="rcw-precision-bar">
                      {overlayDetail.stageId ? (
                        <button
                          type="button"
                          className="xp-chip"
                          onClick={() =>
                            setOverlayDetail({ kind: 'day', stageId: overlayDetail.stageId!, precision: 2 })
                          }
                        >
                          − Remonter au jour
                        </button>
                      ) : <span />}
                      <button
                        type="button"
                        className="xp-chip"
                        onClick={() =>
                          setOverlayDetail({
                            ...overlayDetail,
                            precision: overlayDetail.precision === 1 ? 2 : 1,
                          })
                        }
                      >
                        {overlayDetail.precision === 1 ? '+ Plus de précision' : '− Vue simple'}
                      </button>
                    </div>
                    <XpMetrics
                      items={[
                        { label: 'Distance trace', value: `${poi.distanceToTrackM} m` },
                        { label: 'Altitude', value: poi.altitudeM != null ? `${Math.round(poi.altitudeM)} m` : '—' },
                        { label: 'Source', value: poi.source },
                      ]}
                    />
                    {overlayDetail.precision >= 2 && poi.details ? (
                      <p className="rcw-sub-note">{poi.details}</p>
                    ) : null}
                  </div>
                </ExplorerSheet>
              );
            }

            return (
              <ExplorerSheet
                title="Sac & Matériel lié"
                subtitle={`${workspace.kitItems.length} article(s)`}
                tab={0}
                onTab={() => undefined}
                detent="mid"
                onDetent={() => undefined}
                onBack={() => setOverlayDetail(null)}
                onClose={() => setOverlayDetail(null)}
                bottomInset={0}
              >
                <div className="rcw-stack">
                  <div className="rcw-precision-bar">
                    {overlayDetail.stageId ? (
                      <button
                        type="button"
                        className="xp-chip"
                        onClick={() =>
                          setOverlayDetail({ kind: 'day', stageId: overlayDetail.stageId!, precision: 2 })
                        }
                      >
                        − Remonter au jour
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      className="xp-chip"
                      onClick={() => {
                        setOverlayDetail(null);
                        openSubDrawer('kit');
                      }}
                    >
                      + Gérer tout le sac
                    </button>
                  </div>
                  <XpRows>
                    {workspace.kitItems.map((item) => (
                      <XpRow
                        key={item.id}
                        icon={item.shared ? 'users' : 'pack'}
                        tone={item.status === 'needs_revalidation' ? 'warn' : 'good'}
                        title={item.name}
                        sub={item.revalidationReason ?? (item.assigneeName ? `Porté par ${item.assigneeName}` : 'Non attribué')}
                        badge={{
                          label: item.status === 'needs_revalidation' ? 'À revalider' : 'OK',
                          tone: item.status === 'needs_revalidation' ? 'warn' : 'good',
                        }}
                        onClick={() =>
                          item.status === 'needs_revalidation' ? void handleRevalidateKitItem(item.id) : undefined
                        }
                      />
                    ))}
                  </XpRows>
                </div>
              </ExplorerSheet>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}

export default RouteCollabWorkspace;
