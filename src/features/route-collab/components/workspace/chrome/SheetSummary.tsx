'use client';

import { useRouteViewMode } from '../expertMode';
import { MetricTiles } from '../ui/MetricTiles';
import { useRouteWorkspace } from '../WorkspaceContext';

/** Bandeau de tête du tiroir : distance, D+, D−, durée (4.4) ; la méthode sous chaque chiffre en vue experte. */
export function SheetSummary() {
  const { workspace } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  return <MetricTiles workspace={workspace} expert={expert} />;
}
