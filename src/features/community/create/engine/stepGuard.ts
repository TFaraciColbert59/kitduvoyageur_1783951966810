'use client';

import { createContext, useContext } from 'react';

/**
 * Verrou d'étape : le moteur du formulaire sait quels champs portent chaque étape et peut les valider.
 * Le `StepPager` l'interroge avant d'avancer (glissement ou onglet d'étape) ; si l'étape courante est
 * incomplète, il reste en place et joue un petit rebond au lieu de passer.
 */
export interface StepGuard {
  /** `true` si les champs de l'étape sont valides (les erreurs s'affichent alors sur ces champs). */
  canLeave: (step: number) => Promise<boolean>;
}

export const StepGuardContext = createContext<StepGuard | null>(null);

export function useStepGuard(): StepGuard | null {
  return useContext(StepGuardContext);
}
