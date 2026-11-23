'use client';

import { V5Icon } from '@/features/compas/v5/ui/icons';
import { formatCoordinates } from '../../../pointEdit';
import { fmtKm } from '../../../fmt';
import { useRouteViewMode } from '../expertMode';
import { useTrackTools } from '../useTrackTools';
import { RouteRow, RouteRows } from '../ui/RouteRow';
import { useRouteWorkspace } from '../WorkspaceContext';
import { Block, Note } from './atoms';

const KIND_LABEL: Record<string, string> = { start: 'Départ', finish: 'Arrivée', via: 'Passage', stage_boundary: 'Fin d’étape', poi: 'Repère', camp: 'Nuit' };

/**
 * 5.3 et 5.6 : les points dans l'ordre du tracé, modifiables sans viser au doigt (nom, coordonnées, adresse)
 * et supprimables : les deux tronçons voisins se recousent en un seul, recalculé seul.
 */
export function PointList() {
  const { orderedPoints, workspace, setSelectedPointId, openSubDrawer } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const tools = useTrackTools();
  if (orderedPoints.length === 0) return null;
  const canDelete = tools.canEditGeo && orderedPoints.length > 2 && tools.busy == null;
  return (
    <Block title="Points du tracé" right={`${orderedPoints.length}`} testId="point-list">
      <RouteRows>
        {orderedPoints.map((p, i) => {
          const next = orderedPoints[i + 1];
          const sec = next ? workspace.sections.find((s) => s.fromPointId === p.id && s.toPointId === next.id) : null;
          const title = p.name || `${KIND_LABEL[p.kind] ?? 'Point'} ${i + 1}`;
          const detail = [expert ? formatCoordinates(p) : null, sec ? `${fmtKm(sec.distanceKm)} jusqu’au suivant` : null].filter(Boolean).join(' · ');
          return (
            <RouteRow
              key={p.id}
              icon={p.kind === 'start' ? 'flag' : p.kind === 'finish' ? 'flag' : 'locate'}
              title={`${i + 1}. ${title}`}
              subtitle={detail || null}
              testId={`point-row-${p.id}`}
              trailing={
                <span className="rts-actions" style={{ flexWrap: 'nowrap', gap: 4 }}>
                  <button
                    type="button"
                    className="rts-icon-btn"
                    aria-label={`Modifier ${title}`}
                    onClick={() => {
                      setSelectedPointId(p.id);
                      openSubDrawer('point');
                    }}
                  >
                    <V5Icon name="edit" size="s" />
                  </button>
                  <button type="button" className="rts-icon-btn" aria-label={`Supprimer ${title}`} disabled={!canDelete} onClick={() => void tools.deletePoint(p.id)}>
                    <V5Icon name="trash" size="s" />
                  </button>
                </span>
              }
            />
          );
        })}
      </RouteRows>
      {orderedPoints.length <= 2 ? <Note>Un itinéraire garde au moins deux points.</Note> : null}
    </Block>
  );
}
