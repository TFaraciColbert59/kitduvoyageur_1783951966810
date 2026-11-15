'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import {
  commitStageBoundaryMove,
  previewStageBoundaryMove,
  type MultiDayPlan,
} from '@/features/planning';
import {
  formatDistanceKm,
  formatElevationM,
} from './format';

const FIELD_CLASS =
  'h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface BoundaryEditorProps {
  plan: MultiDayPlan;
  nowIso: string;
  initialDay?: number;
  onPlanChange: (plan: MultiDayPlan) => void;
}

/**
 * K2.30 : déplacement de la fin d'une étape avec prévisualisation de l'impact
 * sur N et N+1, puis commit atomique des deux révisions.
 */
export function BoundaryEditor({ plan, nowIso, initialDay, onPlanChange }: BoundaryEditorProps) {
  const movableStages = plan.stages.slice(0, -1);
  const [dayNumber, setDayNumber] = useState(initialDay ?? movableStages[0]?.dayNumber ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentIndex = useMemo(
    () => plan.stages.findIndex((stage) => stage.dayNumber === dayNumber),
    [plan.stages, dayNumber],
  );
  const stageN = currentIndex >= 0 ? plan.stages[currentIndex] : null;
  const stageNext = currentIndex >= 0 ? plan.stages[currentIndex + 1] ?? null : null;
  const minIndex = stageN ? stageN.startPointIndex + 1 : 1;
  const maxIndex = stageNext ? stageNext.endPointIndex - 1 : 1;
  const [newEndIndex, setNewEndIndex] = useState(() =>
    stageN ? clamp(stageN.endPointIndex + 1, minIndex, maxIndex) : 1,
  );

  const preview =
    stageN && stageNext
      ? previewStageBoundaryMove(plan, dayNumber, newEndIndex, plan.revision)
      : null;

  const commit = () => {
    setError(null);
    setSuccess(null);
    const result = commitStageBoundaryMove(
      plan,
      dayNumber,
      newEndIndex,
      plan.revision,
      nowIso,
    );
    if (!result.ok) {
      setError(
        result.reason === 'revision_conflict'
          ? 'Le plan a changé entre-temps ; la prévisualisation a été actualisée.'
          : 'La borne choisie ne laisse pas assez de points aux deux étapes.',
      );
      return;
    }
    onPlanChange(result.plan);
    setSuccess(
      `Bornes des jours ${dayNumber} et ${dayNumber + 1} mises à jour (révision ${result.plan.revision}).`,
    );
  };

  if (!stageN || !stageNext) {
    return (
      <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
        La dernière étape ne peut pas être déplacée : elle n’a pas de journée suivante.
      </p>
    );
  }

  return (
    <div className="space-y-[var(--space-3)]">
      <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
        Le déplacement ajuste la fin du jour N et le début du jour N+1 dans la même révision. Les
        autres journées restent inchangées.
      </p>

      <div className="grid gap-[var(--space-3)] sm:grid-cols-2">
        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Journée à ajuster</span>
          <select
            className={FIELD_CLASS}
            value={dayNumber}
            onChange={(event) => {
              const nextDay = Number.parseInt(event.target.value, 10);
              const nextIndex = plan.stages.findIndex((stage) => stage.dayNumber === nextDay);
              const nextStage = plan.stages[nextIndex];
              const nextStageNext = plan.stages[nextIndex + 1];
              setDayNumber(nextDay);
              if (nextStage && nextStageNext) {
                setNewEndIndex(
                  clamp(
                    nextStage.endPointIndex + 1,
                    nextStage.startPointIndex + 1,
                    nextStageNext.endPointIndex - 1,
                  ),
                );
              }
              setError(null);
              setSuccess(null);
            }}
          >
            {movableStages.map((stage) => (
              <option key={stage.dayNumber} value={stage.dayNumber}>
                Jour {stage.dayNumber} → {stage.dayNumber + 1}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>
            Nouvelle fin (point {newEndIndex} sur {minIndex}–{maxIndex})
          </span>
          <input
            type="number"
            min={minIndex}
            max={maxIndex}
            className={FIELD_CLASS}
            value={newEndIndex}
            onChange={(event) =>
              setNewEndIndex(clamp(Number.parseInt(event.target.value, 10) || minIndex, minIndex, maxIndex))
            }
          />
        </label>
      </div>

      <label className="block space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
        <span>Position de la borne</span>
        <input
          type="range"
          min={minIndex}
          max={maxIndex}
          step={1}
          value={newEndIndex}
          onChange={(event) => setNewEndIndex(Number.parseInt(event.target.value, 10))}
          className="h-[var(--control-height-md)] w-full accent-[color:var(--lkv-action)]"
        />
      </label>

      {preview ? (
        <div className="space-y-[var(--space-2)]">
          {preview.revisionConflict && (
            <p
              role="alert"
              className="rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-warning)] bg-[color:var(--lkv-warning-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-warning-dark)]"
            >
              Conflit de révision : le plan attendu n’est plus la version courante.
            </p>
          )}
          <div className="grid gap-[var(--space-2)] sm:grid-cols-2">
            <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border-subtle)] p-[var(--space-3)]">
              <div className="flex items-center justify-between gap-[var(--space-2)]">
                <Badge tone="sage">Jour {preview.dayN.dayNumber}</Badge>
                <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  rév. {preview.dayN.previousRevision} → {preview.dayN.nextRevision}
                </span>
              </div>
              <p className="mt-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                {formatDistanceKm(preview.dayN.previousDistanceKm)} →{' '}
                {formatDistanceKm(preview.dayN.nextDistanceKm)}
              </p>
              <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                +{formatElevationM(preview.dayN.previousElevationGainM)} →{' '}
                {formatElevationM(preview.dayN.nextElevationGainM)}
              </p>
            </div>
            {preview.dayNext && (
              <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border-subtle)] p-[var(--space-3)]">
                <div className="flex items-center justify-between gap-[var(--space-2)]">
                  <Badge tone="info">Jour {preview.dayNext.dayNumber}</Badge>
                  <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    rév. {preview.dayNext.previousRevision} → {preview.dayNext.nextRevision}
                  </span>
                </div>
                <p className="mt-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                  {formatDistanceKm(preview.dayNext.previousDistanceKm)} →{' '}
                  {formatDistanceKm(preview.dayNext.nextDistanceKm)}
                </p>
                <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                  +{formatElevationM(preview.dayNext.previousElevationGainM)} →{' '}
                  {formatElevationM(preview.dayNext.nextElevationGainM)}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          La borne choisie ne produit pas de prévisualisation valide.
        </p>
      )}

      {error && (
        <p role="alert" className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-success)]">
          {success}
        </p>
      )}

      <div className="flex items-center gap-[var(--space-2)]">
        <Button
          variant="primary"
          size="sm"
          icon={<ArrowLeftRight aria-hidden="true" size={14} />}
          onClick={commit}
          disabled={!preview || preview.revisionConflict}
        >
          Confirmer le décalage
        </Button>
        <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
          Révision courante : {plan.revision}
        </span>
      </div>
    </div>
  );
}

export default BoundaryEditor;
