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
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'select_category', category })}
                  className="flex min-h-[72px] w-full flex-col items-start justify-center gap-1 rounded-xl bg-[var(--lkv-surface-raised,#FFFFFF)] px-4 py-3 text-left active:opacity-70"
                >
                  <Icon
                    name={display.icon}
                    size={20}
                    className="text-[var(--lkv-secondary,#17402C)]"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-[var(--lkv-text-primary,#0B1F17)]">
                    {display.label}
                  </span>
                </button>
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
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'select_severity', severity })}
                  className="flex min-h-[48px] w-full items-center justify-between rounded-xl bg-[var(--lkv-surface-raised,#FFFFFF)] px-4 py-2.5 text-left active:opacity-70"
                >
                  <span className="text-sm font-medium text-[var(--lkv-text-primary,#0B1F17)]">
                    {SEVERITY_LABELS[severity]}
                  </span>
                  {state.severity === severity && (
                    <Icon name="check" size={16} className="text-[var(--lkv-secondary,#17402C)]" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Passabilité">
            {PASSABILITIES.map((passability) => (
              <button
                key={passability}
                type="button"
                onClick={() => dispatch({ type: 'set_passability', passability })}
                aria-pressed={state.passability === passability}
                className={`min-h-[44px] rounded-full px-4 text-[13px] ${
                  state.passability === passability
                    ? 'bg-[var(--lkv-secondary,#17402C)] text-white'
                    : 'bg-[var(--lkv-surface-raised,#FFFFFF)] text-[var(--lkv-text-secondary,#4A5D52)]'
                }`}
              >
                {PASSABILITY_LABELS[passability]}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.step === 'confirm' && (
        <div className="py-4">
          <p className="text-sm text-[var(--lkv-text-secondary,#4A5D52)]">
            {state.category && categoryDisplay(state.category).label}
            {state.severity ? ` · ${SEVERITY_LABELS[state.severity]}` : ''}
            {state.passability ? ` · ${PASSABILITY_LABELS[state.passability]}` : ''}
          </p>
          <label
            htmlFor="terrain-report-description"
            className="mt-4 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted,#6B7A70)]"
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
            className="mt-2 w-full resize-none rounded-xl bg-[var(--lkv-surface-raised,#FFFFFF)] px-4 py-3 text-sm text-[var(--lkv-text-primary,#0B1F17)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-secondary,#17402C)]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !canSubmit(state)}
            className="mt-4 min-h-[50px] w-full rounded-xl bg-[var(--lkv-secondary,#17402C)] text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-50"
          >
            {busy ? 'Envoi…' : 'Signaler'}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'back' })}
            className="mt-2 min-h-[44px] w-full text-sm text-[var(--lkv-text-secondary,#4A5D52)]"
          >
            Retour
          </button>
        </div>
      )}

      {state.step === 'severity' && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'back' })}
          className="mb-2 min-h-[44px] w-full text-sm text-[var(--lkv-text-secondary,#4A5D52)]"
        >
          Retour
        </button>
      )}
    </Sheet>
  );
}
