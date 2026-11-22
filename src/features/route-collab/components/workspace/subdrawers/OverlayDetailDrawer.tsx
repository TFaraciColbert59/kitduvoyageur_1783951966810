import { ExplorerSheet } from '@/features/explorer-v2/sheet/ExplorerSheet';
import { XpChips, XpEyebrow, XpMetrics, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import type { OvernightChipValue } from '../labels';
import { computeStageMetrics } from '../metrics';
import { useRouteWorkspace } from '../WorkspaceContext';

/** Tiroir superposé hiérarchique (Étapes -> Catégories -> Sous-catégories avec +/- précision). */
export function OverlayDetailDrawer() {
  const {
    workspace,
    overlayDetail,
    setOverlayDetail,
    commentBody,
    setCommentBody,
    stageNotesDraft,
    setStageNotesDraft,
    canEditGeo,
    canEditStages,
    canComment,
    orderedPoints,
    openSubDrawer,
    runOperation,
    handleDownloadGpx,
    handleAddComment,
    handleRevalidateKitItem,
  } = useRouteWorkspace();
  if (!overlayDetail) return null;
  return (
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
                  <span>
                    {overlayDetail.precision === 1
                      ? 'Vue globale'
                      : overlayDetail.precision === 2
                        ? 'Catégories'
                        : 'Détails complets'}
                  </span>
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
                    {
                      label: 'Durée',
                      value: stM.durationMin != null ? `${stM.durationMin} min` : '—',
                    },
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
                          { [st.id]: st.entityVersion }
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
                              { [st.id]: st.entityVersion }
                            )
                          }
                        >
                          Enregistrer
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="xp-secondary"
                        onClick={() => handleDownloadGpx(st.id)}
                      >
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
                        ? setOverlayDetail({
                            kind: 'day',
                            stageId: overlayDetail.stageId,
                            precision: 2,
                          })
                        : setOverlayDetail({
                            ...overlayDetail,
                            precision: Math.max(1, overlayDetail.precision - 1) as 1 | 2 | 3,
                          })
                    }
                  >
                    −{' '}
                    {overlayDetail.precision <= 1 && overlayDetail.stageId
                      ? 'Remonter au jour'
                      : 'Moins de précision'}
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
                    {
                      label: 'Altitude',
                      value: pt.eleM != null ? `${Math.round(pt.eleM)} m` : '—',
                    },
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
                          { [pt.id]: pt.entityVersion }
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
                          void runOperation(
                            { type: 'delete_point', pointId: pt.id },
                            { [pt.id]: pt.entityVersion }
                          );
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
                        setOverlayDetail({
                          kind: 'day',
                          stageId: overlayDetail.stageId!,
                          precision: 2,
                        })
                      }
                    >
                      − Remonter au jour
                    </button>
                  ) : (
                    <span />
                  )}
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
                    {
                      label: 'Altitude',
                      value: poi.altitudeM != null ? `${Math.round(poi.altitudeM)} m` : '—',
                    },
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
                      setOverlayDetail({
                        kind: 'day',
                        stageId: overlayDetail.stageId!,
                        precision: 2,
                      })
                    }
                  >
                    − Remonter au jour
                  </button>
                ) : (
                  <span />
                )}
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
                    sub={
                      item.revalidationReason ??
                      (item.assigneeName ? `Porté par ${item.assigneeName}` : 'Non attribué')
                    }
                    badge={{
                      label: item.status === 'needs_revalidation' ? 'À revalider' : 'OK',
                      tone: item.status === 'needs_revalidation' ? 'warn' : 'good',
                    }}
                    onClick={() =>
                      item.status === 'needs_revalidation'
                        ? void handleRevalidateKitItem(item.id)
                        : undefined
                    }
                  />
                ))}
              </XpRows>
            </div>
          </ExplorerSheet>
        );
      })()}
    </div>
  );
}
