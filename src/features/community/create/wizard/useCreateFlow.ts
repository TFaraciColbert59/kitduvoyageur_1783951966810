'use client';

import { useCallback, useState } from 'react';
import { useWizard, type WizardState } from './useWizard';

export interface CreateFlow<S extends string> {
  wizard: WizardState;
  current: S;
  busy: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Mécanique commune des formulaires en étapes : valide l'étape courante,
 * avance, et sur la dernière étape appelle `submit` en gérant `busy` et les
 * erreurs. `submit` lève une `Error` au message lisible en cas d'échec.
 */
export function useCreateFlow<S extends string>({
  steps,
  validate,
  submit,
}: {
  steps: readonly S[];
  validate: (step: S) => string | null;
  submit: () => Promise<void>;
}): CreateFlow<S> {
  const wizard = useWizard(steps.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = steps[wizard.step] as S;
  const { isLast, next, back, reset } = wizard;

  const run = useCallback(async () => {
    const problem = validate(current);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (!isLast) {
      next();
      return;
    }
    setBusy(true);
    try {
      await submit();
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }, [current, isLast, next, reset, submit, validate]);

  const onBack = useCallback(() => {
    setError(null);
    back();
  }, [back]);

  return { wizard, current, busy, error, setError, onNext: () => void run(), onBack };
}
