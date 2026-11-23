'use client';

import { RouteRow, RouteRows, type RouteRowState } from '../ui';
import { useRouteWorkspace } from '../WorkspaceContext';
import { stageFacts } from './pillModel';

/**
 * Colonne des étapes du bureau (4.9) : les jours à côté de la carte et du détail, dès 1 024 px. Chaque ligne est
 * une `RouteRow` (même recette que dans le tiroir) ; un toucher choisit le jour et centre la carte dessus.
 */
export function StageColumn() {
  const { workspace, selectedStage, setSelectedStageId, setFocusCoord, orderedPoints } = useRouteWorkspace();
  const stages = workspace.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  return (
    <aside className="rcw-stage-col" data-testid="stage-column" aria-label="Étapes">
      <h2 className="rcw-stage-col-title">Étapes</h2>
      {stages.length === 0 ? (
        <p className="v5-note">Aucune étape : « Dis-le » ou l’onglet Étapes découpe le tracé en jours.</p>
      ) : (
        <RouteRows testId="stage-column-rows">
          {stages.map((st, i) => {
            const f = stageFacts(workspace, st);
            const isLast = i === stages.length - 1;
            let state: RouteRowState | undefined;
            if (!f.known) state = 'unknown';
            else if (!isLast && !st.overnightPlace) state = 'to_check';
            else if (st.overnightPlace?.bookingStatus === 'confirmed') state = 'confirmed';
            const night = st.overnightPlace ? st.overnightPlace.name : isLast ? 'Arrivée' : 'Nuit à trouver';
            return (
              <RouteRow
                key={st.id}
                icon="flag"
                title={`Jour ${st.dayNumber} · ${st.title}`}
                subtitle={`${f.km} · ${f.ascent} · ${night}`}
                state={state}
                testId={`stage-column-row-${st.dayNumber}`}
                ariaLabel={`Jour ${st.dayNumber} : ${f.km}, ${f.ascent}`}
                current={selectedStage?.id === st.id}
                onClick={() => {
                  setSelectedStageId(st.id);
                  const start = orderedPoints.find((p) => p.id === st.startPointId);
                  if (start) setFocusCoord([start.lon, start.lat]);
                }}
              />
            );
          })}
        </RouteRows>
      )}
    </aside>
  );
}
