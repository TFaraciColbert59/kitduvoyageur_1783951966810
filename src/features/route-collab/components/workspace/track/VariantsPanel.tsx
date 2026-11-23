'use client';

import { useMemo, useState } from 'react';
import { Chip } from '@/features/compas/v5/ui/primitives';
import { compareVariants } from '../../../variantCompare';
import type { VariantScope } from '../../../routeClient';
import { useTrackTools } from '../useTrackTools';
import { useRouteWorkspace } from '../WorkspaceContext';
import { Block, Btn, Note, Pill } from './atoms';

/**
 * 5.8 : jusqu'à trois variantes réelles (le routeur recalcule la portée avec une autre préférence de surface),
 * côte à côte avec le tracé actuel : km, D+, durée, surface ; puis « Appliquer ». Une variante périmée
 * (un point a bougé depuis son calcul) ne s'applique pas.
 */
export function VariantsPanel() {
  const { workspace, selectedSection, selectedStage, comparedVariantId, setComparedVariantId } = useRouteWorkspace();
  const tools = useTrackTools();
  const [scope, setScope] = useState<VariantScope>('section');
  const comparisons = useMemo(() => compareVariants(workspace), [workspace]);
  const id = scope === 'section' ? (selectedSection?.id ?? null) : scope === 'stage' ? (selectedStage?.id ?? null) : null;
  const scopeLabel = scope === 'section' ? 'le tronçon choisi' : scope === 'stage' ? `le jour ${selectedStage?.dayNumber ?? ''}` : 'tout l’itinéraire';
  const disabled = !tools.canEditGeo || tools.busy != null;
  return (
    <>
      <Block title="Comparer des variantes" testId="variants-panel">
        <div className="rts-chips" role="group" aria-label="Portée de la comparaison">
          <Chip pressed={scope === 'section'} onClick={() => setScope('section')}>
            Un tronçon
          </Chip>
          <Chip pressed={scope === 'stage'} onClick={() => setScope('stage')}>
            Une journée
          </Chip>
          <Chip pressed={scope === 'route'} onClick={() => setScope('route')}>
            Tout
          </Chip>
        </div>
        <Btn tone="primary" disabled={disabled} onClick={() => void tools.createVariants(scope, id)} testId="create-variants">
          {tools.busy === 'variantes' ? 'Calcul par le routeur…' : `Calculer des variantes pour ${scopeLabel}`}
        </Btn>
        <Note>Le routeur recalcule la portée avec une autre préférence de surface (sentiers, hors routes, revêtu). La surface mesurée n’est pas fournie : seule la préférence demandée est dite.</Note>
        {tools.variantNotes.map((n) => (
          <Note key={n}>{n}</Note>
        ))}
      </Block>

      {comparisons.length > 0 ? (
        <div className="rts-compare" data-testid="variants-compare">
          {comparisons.map((c) => {
            const active = comparedVariantId === c.variantId;
            return (
              <article key={c.variantId} className="rts-compare-card" data-stale={c.stale ? 'true' : 'false'}>
                <div className="rts-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <b>{c.title}</b>
                  {c.stale ? <Pill tone="warn">Périmée</Pill> : active ? <Pill tone="warn">Sur la carte</Pill> : <Pill>{c.status === 'proposed' ? 'Proposée' : 'Brouillon'}</Pill>}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th scope="col"> </th>
                      <th scope="col">Actuel</th>
                      <th scope="col">Variante</th>
                      <th scope="col">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.label}</td>
                        <td>{r.base}</td>
                        <td>{r.variant}</td>
                        <td className={r.tone ?? undefined}>{r.delta ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {c.stale ? <Note tone="warn">{c.stale}</Note> : null}
                <div className="rts-actions">
                  <Btn onClick={() => setComparedVariantId(active ? null : c.variantId)}>{active ? 'Masquer sur la carte' : 'Superposer sur la carte'}</Btn>
                  <Btn tone="primary" disabled={disabled || Boolean(c.stale)} onClick={() => void tools.applyVariant(c.variantId)} testId={`apply-${c.variantId}`}>
                    Appliquer
                  </Btn>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
