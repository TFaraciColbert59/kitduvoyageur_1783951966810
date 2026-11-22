import { Cap } from '@/features/compas/v5/ui/primitives';
import type { RouteWorkspaceState } from '../../../types';
import { routeFigures, type Figure } from './figures';
import { V5Scope } from './V5Scope';

/**
 * Tuiles chiffrées en tête du tiroir (4.4) : distance, D+, D−, durée. En vue experte, la méthode sous chaque
 * chiffre ; un inconnu dit sur combien de kilomètres il l'est (4.5).
 */
export function MetricTiles({
  workspace,
  expert,
}: {
  workspace: Pick<RouteWorkspaceState, 'sections' | 'points'>;
  expert: boolean;
}) {
  const figures = routeFigures(workspace);
  return (
    <V5Scope>
      <div className="rcw-tiles" data-testid="metric-tiles" data-expert={expert ? 'true' : 'false'}>
        {figures.map((f: Figure) => (
          <div key={f.id} className="rcw-tile" data-figure={f.id} data-known={f.known ? 'true' : 'false'}>
            <Cap>{f.label}</Cap>
            <b className="v5-num rcw-tile-value">{f.value}</b>
            {f.note ? <small className="rcw-tile-note">{f.note}</small> : null}
            {expert ? <small className="rcw-tile-method">{f.method}</small> : null}
          </div>
        ))}
      </div>
    </V5Scope>
  );
}
