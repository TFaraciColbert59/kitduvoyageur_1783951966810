'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface StepIndicatorProps {
  totalSteps: number;
  currentStep: number;
  stepLabels?: string[];
  className?: string;
  variant?: 'bars' | 'capsules';
}

/**
 * StepIndicator — Indicateur de progression multi-étapes canonique (Lot 2).
 * Conforme aux Human Interface Guidelines Apple pour les assistants de configuration
 * et parcours séquentiels (/voyages/nouveau, studios, checkout).
 */
export function StepIndicator({
  totalSteps,
  currentStep,
  stepLabels,
  className = '',
  variant = 'bars',
}: StepIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i);
  const currentStepNumber = Math.min(Math.max(currentStep, 0), totalSteps - 1) + 1;
  const currentLabel = stepLabels?.[currentStep] || `Étape ${currentStepNumber} sur ${totalSteps}`;

  return (
    <div
      role="progressbar"
      aria-label="Progression du parcours"
      aria-valuenow={currentStepNumber}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-valuetext={currentLabel}
      className={cn('w-full select-none', className)}
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-[color:var(--glass-secondary)]">
          {currentLabel}
        </span>
        <span className="tabular-nums font-bold text-[color:var(--glass-label)]">
          {currentStepNumber} / {totalSteps}
        </span>
      </div>

      <div className="flex w-full items-center gap-1.5">
        {steps.map((idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;

          if (variant === 'capsules') {
            return (
              <div
                key={idx}
                className={cn(
                  'h-2 flex-1 rounded-full border transition-all duration-300',
                  isDone
                    ? 'border-transparent bg-[color:var(--glass-label)]'
                    : isCurrent
                    ? 'border-[color:var(--glass-rim)] bg-[color:var(--g3-bg)] shadow-sm'
                    : 'border-[color:var(--glass-rim)] bg-[color:var(--glass-bg-subtle)]'
                )}
              />
            );
          }

          // 'bars' (défaut)
          return (
            <div
              key={idx}
              className={cn(
                'h-[3px] flex-1 rounded-full transition-all duration-300',
                isDone
                  ? 'bg-[color:var(--glass-label-secondary)]'
                  : isCurrent
                  ? 'bg-[color:var(--glass-label)]'
                  : 'bg-[color:var(--glass-bg-prominent)]'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export default StepIndicator;
