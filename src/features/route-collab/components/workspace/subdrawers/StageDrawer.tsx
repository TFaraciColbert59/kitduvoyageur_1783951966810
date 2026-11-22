import { XpChips, XpEmpty, XpEyebrow, XpMetrics } from '@/features/explorer-v2/sheet/blocks';
import { OVERNIGHT_LABELS, type OvernightChipValue } from '../labels';
import { computeStageMetrics } from '../metrics';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function stageDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  const st = ws.selectedStage;
  if (!st) return { title: 'Détail d’étape', subtitle: 'Aucune étape' };
  const metrics = computeStageMetrics(st, ws.orderedPoints, ws.workspace.sections);
  const currentOvernight: OvernightChipValue = st.overnightPlace?.type ?? 'none';
  return {
    title: `Jour ${st.dayNumber} · ${st.title}`,
    subtitle: `${metrics.distanceKm} km · ${OVERNIGHT_LABELS[currentOvernight]}`,
  };
}

export function StageDrawer() {
  const {
    workspace,
    stageNotesDraft,
    setStageNotesDraft,
    canEditStages,
    orderedPoints,
    selectedStage,
    runOperation,
    handleDownloadGpx,
  } = useRouteWorkspace();
  const st = selectedStage;
  if (!st) {
    return <XpEmpty title="Aucune étape définie" />;
  }
  const metrics = computeStageMetrics(st, orderedPoints, workspace.sections);
  const endPt =
    orderedPoints.find((p) => p.id === st.endPointId) ?? orderedPoints[orderedPoints.length - 1];
  const currentOvernight: OvernightChipValue = st.overnightPlace?.type ?? 'none';
  return (
    <div className="rcw-stack" data-testid="subdrawer-stage">
      <Banners />
      <XpMetrics
        items={[
          { label: 'Distance', value: `${metrics.distanceKm} km` },
          { label: 'D+', value: metrics.ascentM != null ? `${metrics.ascentM} m` : 'Inconnu' },
          {
            label: 'Durée',
            value: metrics.durationMin != null ? `${metrics.durationMin} min` : '—',
          },
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
            { [st.id]: st.entityVersion }
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
                { [st.id]: st.entityVersion }
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
                { [st.id]: st.entityVersion }
              )
            }
          >
            Enregistrer la note
          </button>
        ) : null}
        <button type="button" className="xp-secondary" onClick={() => handleDownloadGpx(st.id)}>
          Exporter GPX Jour {st.dayNumber}
        </button>
      </div>
    </div>
  );
}
