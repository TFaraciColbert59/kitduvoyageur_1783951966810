'use client';

import { useCallback, useState } from 'react';

export interface WizardState {
  step: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  next: () => void;
  back: () => void;
  go: (step: number) => void;
  reset: () => void;
}

/** Position dans un parcours en étapes, bornée à `[0, total - 1]`. */
export function clampStep(step: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(step, total - 1));
}

export function useWizard(total: number): WizardState {
  const [step, setStep] = useState(0);
  const safe = clampStep(step, total);

  const go = useCallback((target: number) => setStep(clampStep(target, total)), [total]);
  const next = useCallback(() => setStep((current) => clampStep(current + 1, total)), [total]);
  const back = useCallback(() => setStep((current) => clampStep(current - 1, total)), [total]);
  const reset = useCallback(() => setStep(0), []);

  return { step: safe, total, isFirst: safe === 0, isLast: safe === total - 1, next, back, go, reset };
}
