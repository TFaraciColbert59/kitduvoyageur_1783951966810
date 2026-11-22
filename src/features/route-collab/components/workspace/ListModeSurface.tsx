import { XpEyebrow, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import { computeStageMetrics } from './metrics';
import { useRouteWorkspace } from './WorkspaceContext';

/** Surface liste accessible, utilisée quand la carte WebGL est absente ou désactivée. */
export function ListModeSurface() {
  const {
    workspace,
    setSelectedStageId,
    selectedPointId,
    setSelectedPointId,
    orderedPoints,
    totals,
    openSubDrawer,
  } = useRouteWorkspace();
  return (
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
  );
}
