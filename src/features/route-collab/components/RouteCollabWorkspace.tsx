'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { RouteSport } from '@/features/adventure-prep/routeProfiles';
import {
  activePoints,
  applyWorkspaceOperation,
  buildElevationProfile,
  exportWorkspaceGpx,
  parseGpxToWorkspaceEntities,
  publishWorkspaceRevision,
  workspaceTotals,
} from '../engine';
import {
  commitVerifiedPack,
  duplicateWorkspaceWithProvenance,
  enqueueOfflineOperation,
  finishActivityToCarnet,
  getActiveActivityLink,
  getCarnetReturnRecord,
  getLastVerifiedPack,
  listOfflineQueue,
  replayOfflineQueue,
  stagePackDownload,
  startActivityFromRevision,
  type CarnetReturnRecord,
} from '../offlinePackStore';
import { hasRoutePermission } from '../permissions';
import type {
  CollaborativeKitItem,
  DomainConflict,
  RouteOperationInput,
  RouteOperationRecord,
  RouteProposal,
  RouteRole,
  RouteWorkspaceState,
} from '../types';
import './routeCollab.css';

export type WorkspaceTab = 'tracer' | 'etapes' | 'analyser' | 'equipe' | 'depart';

export interface RouteCollabWorkspaceProps {
  initialWorkspace: RouteWorkspaceState;
  currentUserId: string;
  currentUserName: string;
  /** Pour les tests ou environnements sans WebGL. */
  forceNoWebGL?: boolean;
  onWorkspaceChange?: (next: RouteWorkspaceState) => void;
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
  forceNoWebGL = false,
  onWorkspaceChange,
}: RouteCollabWorkspaceProps) {
  const [workspace, setWorkspace] = useState<RouteWorkspaceState>(initialWorkspace);
  const [opLog, setOpLog] = useState<readonly RouteOperationRecord[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('tracer');
  const [listMode, setListMode] = useState<boolean>(forceNoWebGL);
  const [webglAvailable, setWebglAvailable] = useState<boolean>(!forceNoWebGL);
  const [online, setOnline] = useState<boolean>(true);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(
    initialWorkspace.stages[0]?.id ?? null,
  );
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [lastImpactText, setLastImpactText] = useState<string | null>(null);
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
  const [carnetRecord, setCarnetRecord] = useState<CarnetReturnRecord | null>(null);

  useEffect(() => {
    if (forceNoWebGL) {
      setWebglAvailable(false);
      setListMode(true);
      return;
    }
    const ok = detectWebGL();
    setWebglAvailable(ok);
    if (!ok) setListMode(true);
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

  const currentMember = useMemo(
    () => workspace.members.find((m) => m.userId === currentUserId) ?? null,
    [workspace.members, currentUserId],
  );
  const canEditGeo = hasRoutePermission(currentMember, 'route.edit_geometry');
  const canEditStages = hasRoutePermission(currentMember, 'route.edit_stages');
  const canComment = hasRoutePermission(currentMember, 'route.comment');
  const canPropose = hasRoutePermission(currentMember, 'route.propose');
  const canReview = hasRoutePermission(currentMember, 'route.review');
  const canPublish = hasRoutePermission(currentMember, 'route.publish');

  const orderedPoints = useMemo(() => activePoints(workspace), [workspace]);
  const totals = useMemo(() => workspaceTotals(workspace), [workspace]);
  const elevation = useMemo(() => buildElevationProfile(workspace), [workspace]);
  const selectedStage = useMemo(
    () => workspace.stages.find((s) => s.id === selectedStageId) ?? workspace.stages[0] ?? null,
    [workspace.stages, selectedStageId],
  );

  const verifiedPack = useMemo(
    () => getLastVerifiedPack(currentUserId, workspace.id),
    [currentUserId, workspace.id, workspace.updatedAt, workspace.publishedRevisionNo],
  );
  const offlineQueue = useMemo(
    () => listOfflineQueue(currentUserId, workspace.id),
    [currentUserId, workspace.id, workspace.updatedAt, online],
  );
  const activeActivity = useMemo(
    () => getActiveActivityLink(currentUserId),
    [currentUserId, workspace.updatedAt],
  );

  const commitState = useCallback(
    (next: RouteWorkspaceState) => {
      setWorkspace(next);
      onWorkspaceChange?.(next);
    },
    [onWorkspaceChange],
  );

  const runOperation = useCallback(
    (operation: RouteOperationInput, expectedVersions?: Record<string, number>) => {
      const opId = `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      if (!online) {
        enqueueOfflineOperation(currentUserId, {
          opId,
          workspaceId: workspace.id,
          baseSeq: workspace.headSeq,
          operation,
          expectedVersions: expectedVersions ?? {},
          queuedAt: new Date().toISOString(),
        });
        setStatusMessage('Hors ligne : modification ajoutée à la file locale persistante.');
        setWorkspace((prev) => ({ ...prev, updatedAt: new Date().toISOString() }));
        return;
      }

      const { result, nextOpLog } = applyWorkspaceOperation(
        workspace,
        opLog,
        {
          opId,
          baseSeq: workspace.headSeq,
          actorId: currentUserId,
          actorName: currentUserName,
          operation,
          expectedVersions,
        },
        new Date().toISOString(),
      );

      if (result.status === 'accepted') {
        setOpLog(nextOpLog);
        commitState(result.workspace);
        const imp = result.impact;
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
          parts.push(
            `Concernés : ${imp.affectedMembers.map((m) => m.displayName).join(', ')}`,
          );
        }
        setLastImpactText(parts.length > 0 ? parts.join(' · ') : 'Modification enregistrée.');
      } else if (result.status === 'conflict') {
        setActiveConflict({ conflict: result.conflicts[0], pendingOp: operation });
        commitState(result.currentWorkspace);
      } else if (result.status === 'denied') {
        setStatusMessage(result.reason);
      } else if (result.status === 'stale_routing_discarded') {
        setStatusMessage(result.reason);
      }
    },
    [commitState, currentUserId, currentUserName, online, opLog, workspace],
  );

  const handleReplayOffline = async () => {
    const res = await replayOfflineQueue(currentUserId, workspace.id, async (queued) => {
      const { result, nextOpLog } = applyWorkspaceOperation(
        workspace,
        opLog,
        {
          opId: queued.opId,
          baseSeq: queued.baseSeq,
          actorId: currentUserId,
          actorName: currentUserName,
          operation: queued.operation,
          expectedVersions: queued.expectedVersions,
        },
        new Date().toISOString(),
      );
      if (result.status === 'accepted') {
        setOpLog(nextOpLog);
        commitState(result.workspace);
      }
      return result;
    });
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
  };

  const handlePublish = () => {
    const res = publishWorkspaceRevision({
      workspace,
      actorId: currentUserId,
      actorName: currentUserName,
      expectedHeadSeq: workspace.headSeq,
      summary: `Publication v${(workspace.publishedRevisionNo ?? 0) + 1}`,
      nowIso: new Date().toISOString(),
    });
    if (res.status === 'blocked') {
      setStatusMessage(res.reason);
      return;
    }
    commitState(res.workspace);
    setStatusMessage(`Version ${res.revision.revisionNo} publiée et figée.`);
  };

  const handleDownloadPack = (simulateInterruption = false) => {
    const latestRev = workspace.revisions[workspace.revisions.length - 1];
    const latestPack = workspace.packs[workspace.packs.length - 1];
    if (!latestRev || !latestPack) {
      setStatusMessage('Publiez d’abord une version avant de télécharger le pack.');
      return;
    }
    stagePackDownload(currentUserId, latestPack, 1, 2);
    if (simulateInterruption || !online) {
      setStatusMessage(
        verifiedPack
          ? `Téléchargement v${latestPack.revisionNo} interrompu — la copie complète v${verifiedPack.revisionNo} reste utilisable hors ligne.`
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
    setStatusMessage(`Pack v${latestRev.revisionNo} téléchargé et vérifié localement.`);
    setWorkspace((prev) => ({ ...prev, updatedAt: new Date().toISOString() }));
  };

  const handleAddComment = () => {
    if (!commentBody.trim() || !canComment) return;
    const targetPt = orderedPoints.find((p) => p.id === selectedPointId) ?? orderedPoints[0];
    if (!targetPt) return;
    const nextComment = {
      id: `cmt-${Date.now().toString(36)}`,
      workspaceId: workspace.id,
      createdBy: currentUserId,
      authorName: currentUserName,
      body: commentBody.trim(),
      anchor: {
        anchorType: 'point' as const,
        entityId: targetPt.id,
        entityVersion: targetPt.entityVersion,
        originalLat: targetPt.lat,
        originalLon: targetPt.lon,
        maxRelocateMeters: 250,
      },
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
  };

  const handleCreateProposal = () => {
    if (!proposalTitle.trim() || !canPropose || orderedPoints.length === 0) return;
    const target = orderedPoints[Math.floor(orderedPoints.length / 2)];
    const prop: RouteProposal = {
      id: `prop-${Date.now().toString(36)}`,
      workspaceId: workspace.id,
      baseSeq: workspace.headSeq,
      createdBy: currentUserId,
      authorName: currentUserName,
      title: proposalTitle.trim(),
      rationale: proposalRationale.trim() || 'Variante proposée',
      scopeEntityIds: [target.id],
      operations: [
        {
          type: 'move_point',
          pointId: target.id,
          lat: Number((target.lat + 0.004).toFixed(5)),
          lon: Number((target.lon + 0.004).toFixed(5)),
        },
      ],
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
  };

  const handleAssignKitItem = (itemId: string, userId: string | null) => {
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

  const handleRevalidateKitItem = (itemId: string) => {
    const nextKit: CollaborativeKitItem[] = workspace.kitItems.map((item) =>
      item.id === itemId ? { ...item, status: 'confirmed', revalidationReason: null } : item,
    );
    commitState({ ...workspace, kitItems: nextKit, updatedAt: new Date().toISOString() });
  };

  const handleStartActivity = () => {
    const rev = verifiedPack?.revision ?? workspace.revisions[workspace.revisions.length - 1];
    if (!rev) {
      setStatusMessage('Aucune version publiée ou pack vérifié pour démarrer.');
      return;
    }
    startActivityFromRevision(currentUserId, rev, new Date().toISOString());
    setStatusMessage(`Activité démarrée avec la version ${rev.revisionNo} et le snapshot du kit.`);
    setWorkspace((prev) => ({ ...prev, updatedAt: new Date().toISOString() }));
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
    setStatusMessage('Nouveau brouillon indépendant créé avec provenance conservée.');
  };

  return (
    <div className="rcw" data-testid="route-collab-workspace">
      <header className="rcw-topbar">
        <div className="rcw-title">
          <span>{workspace.title}</span>
          <span className="rcw-badge">
            {workspace.status === 'published'
              ? `Publiée v${workspace.publishedRevisionNo}`
              : `Brouillon · seq ${workspace.headSeq}`}
          </span>
          {!online && <span className="rcw-badge rcw-badge--warn">Hors ligne</span>}
          {verifiedPack && (
            <span className="rcw-badge">
              Pack v{verifiedPack.manifest.revisionNo} prêt
              {workspace.publishedRevisionNo &&
              workspace.publishedRevisionNo > verifiedPack.manifest.revisionNo
                ? ` · v${workspace.publishedRevisionNo} disponible`
                : ''}
            </span>
          )}
        </div>
        <div className="rcw-actions">
          <button
            type="button"
            className="rcw-btn"
            onClick={() => setListMode((v) => !v)}
            aria-pressed={listMode}
          >
            {listMode ? 'Vue carte' : 'Vue liste sans carte'}
          </button>
          <button type="button" className="rcw-btn" onClick={() => setOnline((v) => !v)}>
            {online ? 'Simuler mode avion' : 'Revenir en ligne'}
          </button>
          <button type="button" className="rcw-btn" onClick={() => handleDownloadGpx()}>
            Export GPX complet
          </button>
          {canPublish && (
            <button type="button" className="rcw-btn rcw-btn--primary" onClick={handlePublish}>
              Publier v{(workspace.publishedRevisionNo ?? 0) + 1}
            </button>
          )}
        </div>
      </header>

      {lastImpactText && (
        <div className="rcw-impact-banner" role="status">
          <strong>Impact :</strong>
          <span>{lastImpactText}</span>
        </div>
      )}

      {statusMessage && (
        <div className="rcw-impact-banner" role="status">
          <span>{statusMessage}</span>
          <button type="button" className="rcw-btn" onClick={() => setStatusMessage(null)}>
            Fermer
          </button>
        </div>
      )}

      {activeConflict && (
        <div className="rcw-impact-banner" role="alertdialog" aria-label="Conflit détecté">
          <div>
            <strong>Conflit métier :</strong> {activeConflict.conflict.message}
            <div className="rcw-muted">
              Votre version : {activeConflict.conflict.yourSummary} · Actuel :{' '}
              {activeConflict.conflict.currentSummary}
            </div>
          </div>
          <div className="rcw-actions">
            <button type="button" className="rcw-btn" onClick={() => setActiveConflict(null)}>
              Garder actuel
            </button>
            <button
              type="button"
              className="rcw-btn rcw-btn--primary"
              onClick={() => {
                const op = activeConflict.pendingOp;
                setActiveConflict(null);
                runOperation(op);
              }}
            >
              Appliquer ma version
            </button>
          </div>
        </div>
      )}

      <div className="rcw-grid">
        {/* Colonne gauche : Arbre de route */}
        <aside className="rcw-pane" aria-label="Arbre d’itinéraire">
          <div className="rcw-row">
            <strong>Route &amp; Étapes</strong>
            <span className="rcw-muted">
              {totals.distanceKm} km · {totals.durationMin ?? '—'} min
            </span>
          </div>
          {totals.hasMissingElevation && (
            <span className="rcw-badge rcw-badge--warn">Altitude absente ou partielle</span>
          )}
          <div className="rcw-card">
            <strong>Étapes ({workspace.stages.length})</strong>
            {workspace.stages.map((st) => (
              <div key={st.id} className="rcw-row">
                <button
                  type="button"
                  className="rcw-btn"
                  aria-pressed={selectedStage?.id === st.id}
                  onClick={() => setSelectedStageId(st.id)}
                >
                  J{st.dayNumber} · {st.title}
                </button>
                <button
                  type="button"
                  className="rcw-btn"
                  onClick={() => handleDownloadGpx(st.id)}
                  aria-label={`Exporter GPX ${st.title}`}
                >
                  GPX
                </button>
              </div>
            ))}
          </div>

          <div className="rcw-card">
            <strong>Points ({orderedPoints.length})</strong>
            {orderedPoints.map((pt, idx) => (
              <div key={pt.id} className="rcw-row">
                <button
                  type="button"
                  className="rcw-btn"
                  onClick={() => setSelectedPointId(pt.id)}
                  aria-pressed={selectedPointId === pt.id}
                >
                  {idx + 1}. {pt.name || pt.kind} (v{pt.entityVersion})
                </button>
                {canEditGeo && orderedPoints.length > 2 && (
                  <button
                    type="button"
                    className="rcw-btn"
                    onClick={() =>
                      runOperation(
                        { type: 'delete_point', pointId: pt.id },
                        { [pt.id]: pt.entityVersion },
                      )
                    }
                    aria-label={`Supprimer ${pt.name || pt.id}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {canEditGeo && (
              <button
                type="button"
                className="rcw-btn"
                onClick={() => {
                  const last = orderedPoints[orderedPoints.length - 1];
                  runOperation({
                    type: 'insert_point',
                    pointId: `pt-${Date.now().toString(36)}`,
                    afterPointId: last?.id ?? null,
                    lat: (last?.lat ?? 45.0) + 0.01,
                    lon: (last?.lon ?? 5.5) + 0.01,
                    name: `Passage ${orderedPoints.length + 1}`,
                  });
                }}
              >
                + Ajouter un point
              </button>
            )}
          </div>
        </aside>

        {/* Colonne centre : Carte / Vue liste + Profil altimétrique */}
        <main className="rcw-center">
          <div className="rcw-map-box">
            {listMode || !webglAvailable ? (
              <div className="rcw-card" data-testid="list-mode-fallback">
                <strong>
                  Mode liste {!webglAvailable ? '(WebGL indisponible)' : 'actif'}
                </strong>
                <p className="rcw-muted">
                  Vous pouvez éditer les points, gérer les étapes, comparer les variantes et
                  consulter les vérifications sans rendu cartographique.
                </p>
                {workspace.sections.map((sec, idx) => (
                  <div key={sec.id} className="rcw-row">
                    <span>
                      Section {idx + 1} · {sec.mode} · {sec.distanceKm} km
                    </span>
                    {canEditGeo && (
                      <button
                        type="button"
                        className="rcw-btn"
                        onClick={() =>
                          runOperation(
                            {
                              type: 'set_section_mode',
                              sectionId: sec.id,
                              mode: sec.mode === 'manual' ? 'routed' : 'manual',
                            },
                            { [sec.id]: sec.entityVersion },
                          )
                        }
                      >
                        Passer en {sec.mode === 'manual' ? 'routé' : 'manuel'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <svg className="rcw-svg-trace" viewBox="0 0 400 180" aria-label="Aperçu du tracé">
                <polyline
                  fill="none"
                  stroke="#1d6b52"
                  strokeWidth="3"
                  points={orderedPoints
                    .map((p, i) => `${30 + i * (340 / Math.max(1, orderedPoints.length - 1))},${90 - (p.lat % 1) * 40}`)
                    .join(' ')}
                />
              </svg>
            )}
          </div>

          <section className="rcw-elev" aria-label="Profil altimétrique">
            <div className="rcw-row">
              <strong>Profil altimétrique</strong>
              <span className="rcw-muted">
                Source : {elevation.source} · Manquant : {Math.round(elevation.missingRatio * 100)}%
              </span>
            </div>
          </section>
        </main>

        {/* Colonne droite : Inspecteur contextuel */}
        <aside className="rcw-pane rcw-pane--right" aria-label="Inspecteur">
          {activeTab === 'tracer' && (
            <>
              <div className="rcw-card">
                <strong>Profil sportif &amp; tracé</strong>
                <select
                  className="rcw-input"
                  aria-label="Profil sportif"
                  value={workspace.sport}
                  disabled={!canEditGeo}
                  onChange={(e) =>
                    runOperation({
                      type: 'set_sport_profile',
                      sport: e.target.value as RouteSport,
                      routingOptions: workspace.routingOptions,
                    })
                  }
                >
                  <option value="marche">Randonnée / Marche</option>
                  <option value="route">Vélo route</option>
                  <option value="gravel">Gravel</option>
                  <option value="vtt">VTT</option>
                </select>
                {canEditGeo && (
                  <button
                    type="button"
                    className="rcw-btn"
                    onClick={() => runOperation({ type: 'reverse_route' })}
                  >
                    Inverser le sens du tracé
                  </button>
                )}
              </div>

              <div className="rcw-card">
                <strong>Importer un GPX</strong>
                <textarea
                  className="rcw-input"
                  rows={3}
                  placeholder="Collez un contenu GPX 1.1..."
                  value={gpxInput}
                  onChange={(e) => setGpxInput(e.target.value)}
                />
                <label className="rcw-row">
                  <span>Garder ma trace (géométrie préservée)</span>
                  <input
                    type="checkbox"
                    checked={keepOriginalGpx}
                    onChange={(e) => setKeepOriginalGpx(e.target.checked)}
                  />
                </label>
                <button
                  type="button"
                  className="rcw-btn"
                  disabled={!canEditGeo || !gpxInput.trim()}
                  onClick={handleImportGpx}
                >
                  Importer le GPX
                </button>
              </div>
            </>
          )}

          {activeTab === 'etapes' && selectedStage && (
            <div className="rcw-card">
              <strong>
                J{selectedStage.dayNumber} · {selectedStage.title}
              </strong>
              <label className="rcw-muted">
                Nombre de jours
                <input
                  type="number"
                  min={1}
                  max={15}
                  className="rcw-input"
                  value={workspace.stages.length}
                  disabled={!canEditStages}
                  onChange={(e) =>
                    runOperation({
                      type: 'split_days',
                      targetDays: Number(e.target.value) || 1,
                    })
                  }
                />
              </label>
              <label className="rcw-muted">
                Note d’étape
                <textarea
                  className="rcw-input"
                  rows={3}
                  value={selectedStage.notes}
                  disabled={!canEditStages}
                  onChange={(e) =>
                    runOperation(
                      { type: 'update_stage_note', stageId: selectedStage.id, notes: e.target.value },
                      { [selectedStage.id]: selectedStage.entityVersion },
                    )
                  }
                />
              </label>
              <div className="rcw-muted">
                Hébergement :{' '}
                {selectedStage.overnightPlace
                  ? `${selectedStage.overnightPlace.name} (${selectedStage.overnightPlace.bookingStatus})`
                  : 'Non défini'}
              </div>
            </div>
          )}

          {activeTab === 'analyser' && (
            <>
              <div className="rcw-card">
                <strong>Météo &amp; Terrain</strong>
                {selectedStage?.weatherSlice ? (
                  <div className="rcw-muted">
                    {selectedStage.weatherSlice.locationLabel} ·{' '}
                    {selectedStage.weatherSlice.forecastFor} ·{' '}
                    {selectedStage.weatherSlice.temperatureC ?? '—'} °C ·{' '}
                    {selectedStage.weatherSlice.status}
                  </div>
                ) : (
                  <div className="rcw-muted">Météo non déterminée pour ce créneau.</div>
                )}
              </div>
              <div className="rcw-card">
                <strong>Matériel du départ ({workspace.kitItems.length})</strong>
                {workspace.kitItems.map((item) => (
                  <div key={item.id} className="rcw-row">
                    <div>
                      <div>
                        {item.name} ({item.weightGrams ?? '—'} g)
                      </div>
                      <div className="rcw-muted">
                        {item.status === 'needs_revalidation'
                          ? `À revoir : ${item.revalidationReason}`
                          : item.assigneeName
                            ? `Porté par ${item.assigneeName}`
                            : 'Personnel'}
                      </div>
                    </div>
                    {item.shared && (
                      <select
                        aria-label={`Attribuer ${item.name}`}
                        className="rcw-input"
                        style={{ width: 120 }}
                        value={item.assigneeUserId ?? ''}
                        onChange={(e) => handleAssignKitItem(item.id, e.target.value || null)}
                      >
                        <option value="">Non attribué</option>
                        {workspace.members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    )}
                    {item.status === 'needs_revalidation' && (
                      <button
                        type="button"
                        className="rcw-btn"
                        onClick={() => handleRevalidateKitItem(item.id)}
                      >
                        Confirmer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'equipe' && (
            <>
              <div className="rcw-card">
                <strong>Membres ({workspace.members.length})</strong>
                {workspace.members.map((m) => (
                  <div key={m.userId} className="rcw-row">
                    <span>{m.displayName}</span>
                    <span className="rcw-badge">{m.revokedAt ? 'Révoqué' : m.role}</span>
                  </div>
                ))}
              </div>
              <div className="rcw-card">
                <strong>Propositions ({workspace.proposals.length})</strong>
                {workspace.proposals.map((p) => (
                  <div key={p.id} className="rcw-row">
                    <div>
                      <div>{p.title}</div>
                      <div className="rcw-muted">
                        {p.authorName} · {p.status}
                      </div>
                    </div>
                    {canReview && p.status === 'open' && (
                      <button
                        type="button"
                        className="rcw-btn rcw-btn--primary"
                        onClick={() => {
                          let working = workspace;
                          let log = opLog;
                          for (let i = 0; i < p.operations.length; i += 1) {
                            const res = applyWorkspaceOperation(
                              working,
                              log,
                              {
                                opId: `prop-${p.id}-${i}`,
                                baseSeq: working.headSeq,
                                actorId: currentUserId,
                                actorName: currentUserName,
                                operation: p.operations[i],
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
                              pr.id === p.id ? { ...pr, status: 'accepted' } : pr,
                            ),
                          });
                        }}
                      >
                        Accepter
                      </button>
                    )}
                  </div>
                ))}
                {canPropose && (
                  <>
                    <input
                      className="rcw-input"
                      placeholder="Titre de la proposition (ex. Détour refuge)"
                      value={proposalTitle}
                      onChange={(e) => setProposalTitle(e.target.value)}
                    />
                    <input
                      className="rcw-input"
                      placeholder="Motif"
                      value={proposalRationale}
                      onChange={(e) => setProposalRationale(e.target.value)}
                    />
                    <button type="button" className="rcw-btn" onClick={handleCreateProposal}>
                      Proposer un détour
                    </button>
                  </>
                )}
              </div>
              <div className="rcw-card">
                <strong>Commentaires ancrés ({workspace.comments.length})</strong>
                {workspace.comments.map((c) => (
                  <div key={c.id} className="rcw-muted">
                    <strong>{c.authorName} :</strong> {c.body}{' '}
                    {c.status === 'needs_relocation' && (
                      <span className="rcw-badge rcw-badge--warn">À relocaliser</span>
                    )}
                  </div>
                ))}
                {canComment && (
                  <div className="rcw-row">
                    <input
                      className="rcw-input"
                      placeholder="Ajouter un commentaire ancré..."
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                    />
                    <button type="button" className="rcw-btn" onClick={handleAddComment}>
                      Envoyer
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'depart' && (
            <>
              <div className="rcw-card">
                <strong>Pack hors ligne</strong>
                <div className="rcw-muted">
                  Sur cet appareil :{' '}
                  {verifiedPack ? `Version ${verifiedPack.manifest.revisionNo} vérifiée` : 'Aucun'}
                </div>
                <div className="rcw-actions">
                  <button
                    type="button"
                    className="rcw-btn rcw-btn--primary"
                    onClick={() => handleDownloadPack(false)}
                  >
                    Télécharger le pack
                  </button>
                  <button
                    type="button"
                    className="rcw-btn"
                    onClick={() => handleDownloadPack(true)}
                  >
                    Simuler coupure pack
                  </button>
                </div>
                {offlineQueue.length > 0 && (
                  <div className="rcw-row">
                    <span className="rcw-badge rcw-badge--warn">
                      {offlineQueue.length} opération(s) en attente
                    </span>
                    <button
                      type="button"
                      className="rcw-btn"
                      disabled={!online}
                      onClick={handleReplayOffline}
                    >
                      Synchroniser
                    </button>
                  </div>
                )}
              </div>

              <div className="rcw-card">
                <strong>Sortie &amp; Carnet</strong>
                {!activeActivity ? (
                  <button type="button" className="rcw-btn rcw-btn--primary" onClick={handleStartActivity}>
                    Démarrer l’activité avec cette version
                  </button>
                ) : (
                  <button type="button" className="rcw-btn rcw-btn--primary" onClick={handleFinishToCarnet}>
                    Terminer et ouvrir le carnet
                  </button>
                )}
                {carnetRecord && (
                  <div className="rcw-card">
                    <strong>Bilan Carnet</strong>
                    <div className="rcw-muted">
                      Version suivie : v{carnetRecord.plannedRevisionNo} · Distance :{' '}
                      {carnetRecord.recordedDistanceKm} km · Kit figé :{' '}
                      {carnetRecord.kitSnapshot.length} article(s)
                    </div>
                    <button type="button" className="rcw-btn" onClick={handleDuplicateFromCarnet}>
                      Reprendre cette sortie
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      <nav className="rcw-tabs" role="tablist" aria-label="Vues de préparation">
        {(
          [
            ['tracer', 'Tracer'],
            ['etapes', 'Étapes'],
            ['analyser', 'Analyser'],
            ['equipe', 'Équipe'],
            ['depart', 'Départ'],
          ] as Array<[WorkspaceTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="rcw-tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
