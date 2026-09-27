import {
  PREP_STEPS,
  type AdventurePrepDraft,
  type PrepStepId,
} from '../types';

export function stepPosition(id: PrepStepId): number {
  return PREP_STEPS.indexOf(id) + 1;
}

/** Une etape est satisfaite quand les reponses necessaires sont saisies. */
export function isStepSatisfied(draft: AdventurePrepDraft, id: PrepStepId): boolean {
  if (id === 'destination') {
    return (
      !!draft.activities.primary &&
      !!draft.route.origin &&
      !!draft.calendar.durationDays &&
      draft.calendar.durationDays > 0
    );
  }
  if (id === 'itinerary') return draft.itinerary !== null;
  return false;
}

export function canOpenStep(draft: AdventurePrepDraft, id: PrepStepId): boolean {
  const index = PREP_STEPS.indexOf(id);
  if (index <= 0) return true;
  return isStepSatisfied(draft, PREP_STEPS[index - 1]);
}

export function firstUnsatisfiedStep(draft: AdventurePrepDraft): PrepStepId {
  return PREP_STEPS.find((id) => !isStepSatisfied(draft, id)) ?? 'departure';
}

export function stepCountDone(draft: AdventurePrepDraft): number {
  const done = new Set<PrepStepId>(draft.completedSteps);
  for (const id of PREP_STEPS) {
    if (isStepSatisfied(draft, id)) done.add(id);
  }
  return done.size;
}

export interface PrepProgress {
  current: number;
  total: number;
  label: string;
}

/** Progression en mots : « Étape 2 sur 3 », jamais « 66 % ». */
export function progressOf(draft: AdventurePrepDraft): PrepProgress {
  const current = stepPosition(draft.currentStep);
  return { current, total: PREP_STEPS.length, label: `Étape ${current} sur ${PREP_STEPS.length}` };
}
