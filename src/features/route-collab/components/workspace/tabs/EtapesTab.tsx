import { Plus } from 'lucide-react';
import { computeSmartStageRecommendations } from '../../../routeAnalysis';
import { StageShareBar } from '../../RouteAnalysisVisuals';
import { OVERNIGHT_LABELS, type OvernightChipValue } from '../labels';
import { computeStageMetrics } from '../metrics';
import { Banners } from '../Banners';
import { useRouteWorkspace } from '../WorkspaceContext';

export function EtapesTab() {
  const {
    workspace,
    setFocusCoord,
    knowledgePois,
    nearbyRoutes,
    setFocusedPoiId,
    setOverlayDetail,
    setSelectedStageId,
    canEditStages,
    orderedPoints,
    totals,
    runOperation,
    handleSplitIntoDays,
  } = useRouteWorkspace();
  const isMultiDay = workspace.stages.length > 1;
  return (
    <div className="rcw-stack" data-testid="tab-panel-etapes">
      <Banners />

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

            {isMultiDay ? (
              <StageShareBar stageDistanceKm={stM.distanceKm} totalDistanceKm={totals.distanceKm} />
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
                                lat:
                                  rec.poi?.lat ?? stagePoints[stagePoints.length - 1]?.lat ?? 45.05,
                                lon:
                                  rec.poi?.lon ?? stagePoints[stagePoints.length - 1]?.lon ?? 5.51,
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

            <button
              type="button"
              className="lkdv-cv2c-moment-empty rcw-moment-add-compact"
              onClick={() => {
                setSelectedStageId(st.id);
                setOverlayDetail({ kind: 'day', stageId: st.id, precision: 3 });
              }}
              aria-label="Ajouter un moment ou une étape"
            >
              <span className="lkdv-cv2c-moment-empty-icon">
                <Plus size={18} aria-hidden="true" />
              </span>
              <span>Ajouter un moment</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
