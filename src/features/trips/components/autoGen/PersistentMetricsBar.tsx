'use client';

import React from 'react';
import { Euro, Weight, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/85 dark:bg-stone-900/85 backdrop-blur-xl border-t border-stone-200 dark:border-stone-800 px-4 py-3 pb-[calc(12px+var(--bottom-nav-height,0px))] shadow-2xl transition-all"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Métriques synchrones */}
        <div className="flex items-center gap-6 w-full sm:w-auto justify-around sm:justify-start">
          {/* Budget */}
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl ${
                isBudgetOverflow
                  ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <Euro className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-baseline space-x-1">
                <span className="font-mono text-base font-bold text-stone-900 dark:text-stone-100">
                  {totalBudgetEur} €
                </span>
                {maxBudgetEur > 0 && (
                  <span className="text-xs text-stone-400 font-mono">/ {maxBudgetEur} €</span>
                )}
              </div>
              <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
                <span>Budget estimé</span>
                {isBudgetOverflow && (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center">
                    <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                    Dépassement budget
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-stone-200 dark:bg-stone-800" />

          {/* Poids du sac */}
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl ${
                isWeightOverflow
                  ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  : 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
              }`}
            >
              <Weight className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-baseline space-x-1">
                <span className="font-mono text-base font-bold text-stone-900 dark:text-stone-100">
                  {totalWeightKg.toFixed(1)} kg
                </span>
                {maxWeightKg > 0 && (
                  <span className="text-xs text-stone-400 font-mono">/ {maxWeightKg} kg</span>
                )}
              </div>
              <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
                <span>Poids du sac</span>
                {isWeightOverflow && (
                  <span className="text-sand-600 dark:text-sand-400 font-semibold flex items-center">
                    <AlertTriangle className="w-3 h-3 inline mr-0.5" />
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
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl font-medium text-sm bg-forest-600 hover:bg-forest-700 text-white shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isValidating ? 'Génération du carnet...' : 'Valider ce voyage'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
