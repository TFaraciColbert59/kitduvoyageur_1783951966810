'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Button } from '@/components/ui';

export interface PersistentMetricsBarProps {
  totalBudgetEur: number;
  maxBudgetEur?: number;
  totalWeightKg: number;
  maxWeightKg?: number;
  onValidate?: () => void;
  isValidating?: boolean;
}

export const PersistentMetricsBar: React.FC<PersistentMetricsBarProps> = ({
  totalBudgetEur,
  maxBudgetEur = 0,
  totalWeightKg,
  maxWeightKg = 14,
  onValidate,
  isValidating = false,
}) => {
  const { haptic } = useHapticFeedback();

  const isBudgetOverflow = maxBudgetEur > 0 && totalBudgetEur > maxBudgetEur;
  const isWeightOverflow = maxWeightKg > 0 && totalWeightKg > maxWeightKg;

  const handleValidate = () => {
    haptic('success');
    if (onValidate) onValidate();
  };

  return (
    <div
      data-budget-overflow={isBudgetOverflow ? 'true' : 'false'}
      data-weight-overflow={isWeightOverflow ? 'true' : 'false'}
      className="fixed bottom-[var(--bottom-nav-height,0px)] left-0 right-0 z-[var(--z-fab)] border-t border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] saturate-[var(--glass-sat)] px-4 py-3 shadow-elevation-3 backdrop-blur-[var(--glass-blur-sm)] transition-all"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-[var(--space-3)] sm:flex-row">
        {/* Métriques synchrones */}
        <div className="flex w-full items-center justify-around gap-[var(--space-6)] sm:w-auto sm:justify-start">
          {/* Budget */}
          <div className="flex items-center gap-[var(--space-2)]">
            <div
              className={`rounded-[var(--lkv-radius-sm)] p-[var(--space-2)] ${
                isBudgetOverflow
                  ? 'bg-[color:var(--lkv-danger)]/15 text-[color:var(--lkv-danger)]'
                  : 'bg-[color:var(--lkv-success)]/15 text-[color:var(--lkv-success)]'
              }`}
            >
              <Icon name="euro" size={16} />
            </div>
            <div>
              <div className="flex items-baseline gap-[var(--space-1)]">
                <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                  {totalBudgetEur} €
                </span>
                {maxBudgetEur > 0 && (
                  <span className="font-mono text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
                    / {maxBudgetEur} €
                  </span>
                )}
              </div>
              <div className="flex items-center gap-[var(--space-1)] text-[11px] font-medium text-[color:var(--lkv-text-muted)]">
                <span>Budget estimé</span>
                {isBudgetOverflow && (
                  <span className="flex items-center font-semibold text-[color:var(--lkv-danger)]">
                    <Icon name="alert-triangle" size={12} className="mr-0.5 inline" />
                    Dépassement budget
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-[color:var(--lkv-border)]" />

          {/* Poids du sac */}
          <div className="flex items-center gap-[var(--space-2)]">
            <div
              className={`rounded-[var(--lkv-radius-sm)] p-[var(--space-2)] ${
                isWeightOverflow
                  ? 'bg-[color:var(--lkv-warning)]/15 text-[color:var(--lkv-warning)]'
                  : 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-primary)]'
              }`}
            >
              <Icon name="weight" size={16} />
            </div>
            <div>
              <div className="flex items-baseline gap-[var(--space-1)]">
                <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                  {totalWeightKg.toFixed(1)} kg
                </span>
                {maxWeightKg > 0 && (
                  <span className="font-mono text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
                    / {maxWeightKg} kg
                  </span>
                )}
              </div>
              <div className="flex items-center gap-[var(--space-1)] text-[11px] font-medium text-[color:var(--lkv-text-muted)]">
                <span>Poids du sac</span>
                {isWeightOverflow && (
                  <span className="flex items-center font-semibold text-[color:var(--lkv-warning)]">
                    <Icon name="alert-triangle" size={12} className="mr-0.5 inline" />
                    Sac trop lourd
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bouton de validation globale */}
        <div className="w-full sm:w-auto">
          <Button
            type="button"
            onClick={handleValidate}
            loading={isValidating}
            icon={<Icon name="check-circle2" size={16} />}
            fullWidth
            className="sm:w-auto"
          >
            {isValidating ? 'Génération du carnet...' : 'Valider ce voyage'}
          </Button>
        </div>
      </div>
    </div>
  );
};
