'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

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
      className="fixed bottom-[var(--bottom-nav-height,0px)] left-0 right-0 z-30 bg-surface/90 backdrop-blur-xl border-t border-border/60 px-4 py-3 shadow-2xl transition-all"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Métriques synchrones */}
        <div className="flex items-center gap-6 w-full sm:w-auto justify-around sm:justify-start">
          {/* Budget */}
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl ${
                isBudgetOverflow
                  ? 'bg-[var(--lkv-danger)]/15 text-[var(--lkv-danger)]'
                  : 'bg-[var(--lkv-success)]/15 text-[var(--lkv-success)]'
              }`}
            >
              <Icon name="euro" className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-baseline space-x-1">
                <span className="font-mono text-base font-bold text-text-primary">
                  {totalBudgetEur} €
                </span>
                {maxBudgetEur > 0 && (
                  <span className="text-xs text-text-muted font-mono">/ {maxBudgetEur} €</span>
                )}
              </div>
              <div className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                <span>Budget estimé</span>
                {isBudgetOverflow && (
                  <span className="text-[var(--lkv-danger)] font-semibold flex items-center">
                    <Icon name="alert-triangle" className="w-3 h-3 inline mr-0.5" />
                    Dépassement budget
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-border/60" />

          {/* Poids du sac */}
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl ${
                isWeightOverflow
                  ? 'bg-[var(--lkv-warning)]/15 text-[var(--lkv-warning)]'
                  : 'bg-lkv-primary/15 text-lkv-primary'
              }`}
            >
              <Icon name="weight" className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-baseline space-x-1">
                <span className="font-mono text-base font-bold text-text-primary">
                  {totalWeightKg.toFixed(1)} kg
                </span>
                {maxWeightKg > 0 && (
                  <span className="text-xs text-text-muted font-mono">/ {maxWeightKg} kg</span>
                )}
              </div>
              <div className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                <span>Poids du sac</span>
                {isWeightOverflow && (
                  <span className="text-[var(--lkv-warning)] font-semibold flex items-center">
                    <Icon name="alert-triangle" className="w-3 h-3 inline mr-0.5" />
                    Sac trop lourd
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bouton de validation globale */}
        <div className="w-full sm:w-auto">
          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl font-medium text-sm bg-lkv-primary hover:opacity-90 text-white shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <Icon name="check-circle2" className="w-4 h-4" />
            <span>{isValidating ? 'Génération du carnet...' : 'Valider ce voyage'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
