import { XpEmpty } from '@/features/explorer-v2/sheet/blocks';
import { OVERNIGHT_LABELS, type OvernightChipValue } from '../labels';
import { computeStageMetrics, formatStageKm } from '../metrics';
import { DayView } from '../stages/DayView';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function stageDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  const st = ws.selectedStage;
  if (!st) return { title: 'Détail d’étape', subtitle: 'Aucune étape' };
  const metrics = computeStageMetrics(st, ws.orderedPoints, ws.workspace.sections);
  const currentOvernight: OvernightChipValue = st.overnightPlace?.type ?? 'none';
  const kindLabel = st.kind === 'rest' ? 'Jour de repos' : st.kind === 'short' ? 'Étape courte' : null;
  return {
    title: `Jour ${st.dayNumber} · ${st.title}`,
    subtitle: kindLabel ?? `${metrics.distanceKnown ? formatStageKm(metrics) : 'Distance inconnue'} · ${OVERNIGHT_LABELS[currentOvernight]}`,
  };
}

/** Tiroir « Jour » : la lecture du Compas v5 (`drawers/day.tsx`) étendue aux étapes de l'itinéraire (6.9). */
export function StageDrawer() {
  const { selectedStage } = useRouteWorkspace();
  if (!selectedStage) {
    return <XpEmpty title="Aucune étape définie" />;
  }
  return (
    <>
      <Banners />
      <DayView key={selectedStage.id} stage={selectedStage} />
    </>
  );
}
