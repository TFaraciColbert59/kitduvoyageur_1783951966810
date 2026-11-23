'use client';

import { Chip } from '@/features/compas/v5/ui/primitives';
import type { RouteShapeMode } from '../../../types';
import { useTrackTools } from '../useTrackTools';
import { useRouteWorkspace } from '../WorkspaceContext';
import { Block, Btn, Note } from './atoms';

const SHAPES: ReadonlyArray<{ id: RouteShapeMode; label: string; hint: string }> = [
  { id: 'one_way', label: 'Aller simple', hint: 'Du départ à l’arrivée' },
  { id: 'loop', label: 'Boucle', hint: 'Revient au départ' },
  { id: 'out_and_back', label: 'Aller-retour', hint: 'Même chemin dans les deux sens' },
];

/** 5.2 : aller simple, boucle ou aller-retour en un geste ; « Inverser le sens » refait horaires et nuits. */
export function ShapeTools() {
  const { workspace } = useRouteWorkspace();
  const tools = useTrackTools();
  const shape = workspace.shapeMode ?? 'one_way';
  const disabled = !tools.canEditGeo || tools.busy != null || tools.pointCount < 2;
  return (
    <Block title="Forme du parcours" testId="shape-tools">
      <div className="rts-chips" role="group" aria-label="Forme du parcours">
        {SHAPES.map((s) => (
          <Chip key={s.id} pressed={shape === s.id} disabled={disabled} onClick={() => void tools.setShape(s.id)} title={s.hint} data-testid={`shape-${s.id}`}>
            {s.label}
          </Chip>
        ))}
        <Chip disabled={disabled} onClick={() => void tools.reverse()} data-testid="reverse-route">
          Inverser le sens
        </Chip>
      </div>
      {tools.pointCount < 2 ? <Note>Posez au moins deux points pour choisir une forme.</Note> : <Note>Inverser le sens retourne le tracé, les journées et leurs horaires ; chaque nuit reste au lieu où elle était.</Note>}
    </Block>
  );
}

/** Tronçons qui attendent un calcul : un geste pour les recalculer tous. */
export function PendingRouting() {
  const tools = useTrackTools();
  const n = tools.pending.length;
  if (n === 0) return null;
  return (
    <Block testId="pending-routing">
      <Note tone="warn">
        {n === 1 ? '1 tronçon attend un calcul' : `${n} tronçons attendent un calcul`} : en attendant, il est affiché en ligne droite ou avec l’ancien tracé, pas comme calculé.
      </Note>
      <Btn tone="warn" disabled={!tools.canEditGeo || tools.busy != null} onClick={() => void tools.recalcPending(Number.POSITIVE_INFINITY, true)} testId="recalc-pending">
        {tools.busy ? 'Calcul en cours…' : 'Recalculer'}
      </Btn>
    </Block>
  );
}
