'use client';

import { useRouteWorkspace } from '../WorkspaceContext';
import { useRoutePillModel } from './useRoutePill';

/**
 * Tiroir fermé : le lanceur ne montre plus trois points muets mais ce que dit l'itinéraire (3.1), par exemple
 * « 3 j · 42 km · 2 180 m ». Le toucher rouvre le tiroir à la moitié.
 */
export function RouteLauncher() {
  const ws = useRouteWorkspace();
  const model = useRoutePillModel(ws);
  return (
    <button
      type="button"
      className="xp-sheet-pill-launcher rcw-launcher"
      data-testid="route-drawer-pill"
      data-light={model.light.level}
      aria-label={`Ouvrir le tiroir d’itinéraire. ${model.summary}. ${model.readiness.text}`}
      onClick={() => {
        ws.setSheetOpen(true);
        ws.setDetent('mid');
      }}
    >
      <span className="rcw-launcher-dot" aria-hidden="true" />
      <span className="rcw-launcher-text v5-num">{model.summary}</span>
    </button>
  );
}
