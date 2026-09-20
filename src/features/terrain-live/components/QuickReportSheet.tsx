'use client';

/**
 * A5 — Création d'un signalement en 3 gestes.
 *
 * Bottom sheet iOS : catégorie → gravité/passabilité → confirmation.
 * Un seul choix par écran, 44 px minimum, animation limitée à
 * `transform`/`opacity`, `prefers-reduced-motion` honoré.
 */
import { useCallback, useEffect, useReducer } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, Chip } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import type {
  TerrainPassability,
  TerrainReportCategory,
  TerrainSeverity,
} from '@/features/adventure-intelligence/schemas/live.schema';
import {
  canSubmit,
  createTerrainFlowState,
  terrainFlowReducer,
} from '@/features/adventure-intelligence/domain/terrainReportFlow';
import {
  MVP_TERRAIN_CATEGORIES,
  PASSABILITY_LABELS,
  SEVERITY_LABELS,
  categoryDisplay,
} from '../lib/terrainDisplay';

export interface QuickReportSubmission {
  category: TerrainReportCategory;
  severity: TerrainSeverity;
  passability: TerrainPassability | null;
  description: string;
  hasPhoto: boolean;
}

export interface QuickReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (submission: QuickReportSubmission) => void;
  busy?: boolean;
}

const SEVERITIES: TerrainSeverity[] = ['info', 'warning', 'critical'];
const PASSABILITIES: TerrainPassability[] = ['passable', 'difficult', 'impassable', 'unknown'];

export default function QuickReportSheet({
  open,
  onOpenChange,
  onSubmit,
  busy = false,
}: QuickReportSheetProps) {
  const [state, dispatch] = useReducer(terrainFlowReducer, undefined, createTerrainFlowState);

  useEffect(() => {
    if (!open) dispatch({ type: 'cancel' });
  }, [open]);

  const submit = useCallback(() => {
    if (!state.category || !state.severity || busy) return;
    onSubmit({
      category: state.category,
      severity: state.severity,
      passability: state.passability,
      description: state.description,
      hasPhoto: state.hasPhoto,
    });
  }, [busy, onSubmit, state]);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dragToDismiss
      title={
        state.step === 'category'
          ? 'Que se passe-t-il ?'
          : state.step === 'severity'
            ? 'C’est important ?'
            : 'Vérifie et envoie'
      }
    >
      {state.step === 'category' && (
        <ul className="grid grid-cols-2 gap-2 py-4">
          {MVP_TERRAIN_CATEGORIES.map((category) => {
            const display = categoryDisplay(category);
            return (
              <li key={category}>
                <Button
                  variant="secondary"
                  onClick={() => dispatch({ type: 'select_category', category })}
                  className="flex min-h-[72px] w-full flex-col items-start justify-center gap-1 rounded-[var(--lkv-radius-md)] px-4 py-3 text-left"
                >
                  <Icon
                    name={display.icon}
                    size={20}
                    className="text-[color:var(--lkv-primary)]"
                    aria-hidden="true"
                  />
                  <span className="text-[length:var(--lkv-text-body-sm)] font-medium">
                    {display.label}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {state.step === 'severity' && (
        <div className="py-4">
          <ul className="space-y-2">
            {SEVERITIES.map((severity) => (
              <li key={severity}>
                <Button
                  variant="secondary"
                  fullWidth
                  aria-pressed={state.severity === severity}
                  onClick={() => dispatch({ type: 'select_severity', severity })}
                  className="justify-between px-4 text-left"
                >
                  <span className="text-[length:var(--lkv-text-body-sm)] font-medium">
                    {SEVERITY_LABELS[severity]}
                  </span>
                  {state.severity === severity && (
                    <Icon name="check" size={16} className="text-[color:var(--lkv-primary)]" aria-hidden="true" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Passabilité">
            {PASSABILITIES.map((passability) => (
              <Chip
                key={passability}
                selected={state.passability === passability}
                onClick={() => dispatch({ type: 'set_passability', passability })}
                className="min-h-[44px] px-4"
              >
                {PASSABILITY_LABELS[passability]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {state.step === 'confirm' && (
        <div className="py-4">
          <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
            {state.category && categoryDisplay(state.category).label}
            {state.severity ? ` · ${SEVERITY_LABELS[state.severity]}` : ''}
            {state.passability ? ` · ${PASSABILITY_LABELS[state.passability]}` : ''}
          </p>
          <label
            htmlFor="terrain-report-description"
            className="mt-4 block text-[length:var(--lkv-text-caption-1)] font-medium uppercase tracking-[0.12em] text-[color:var(--lkv-text-muted)]"
          >
            Commentaire (optionnel)
          </label>
          <textarea
            id="terrain-report-description"
            value={state.description}
            onChange={(event) =>
              dispatch({ type: 'set_description', description: event.target.value })
            }
            maxLength={1000}
            rows={2}
            className="mt-2 w-full resize-none rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-4 py-3 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
          />
          <Button
            variant="primary"
            fullWidth
            onClick={submit}
            disabled={busy || !canSubmit(state)}
            className="mt-4 min-h-[50px]"
          >
            {busy ? 'Envoi…' : 'Signaler'}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => dispatch({ type: 'back' })}
            className="mt-2"
          >
            Retour
          </Button>
        </div>
      )}

      {state.step === 'severity' && (
        <Button
          variant="ghost"
          fullWidth
          onClick={() => dispatch({ type: 'back' })}
          className="mb-2"
        >
          Retour
        </Button>
      )}
    </Sheet>
  );
}
