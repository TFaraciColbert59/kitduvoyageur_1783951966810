import {
  WORKOUT_CONTRACT_VERSION,
  type SessionIntent,
  type SessionStep,
  type StepKind,
  type StructuredSession,
  type TargetKind,
  type TargetUnit,
  type WorkoutGoal,
  type WorkoutLevel,
  type WorkoutSport,
  type WorkoutTarget,
} from './types';

/** Allure `m:ss` à partir de secondes par kilomètre. */
export function formatPace(secondsPerKm: number): string {
  const total = Math.max(0, Math.round(secondsPerKm));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function range(min: number | null, max: number | null, suffix: string): string {
  if (min === null && max === null) return `libre${suffix ? ` · ${suffix}` : ''}`;
  if (min !== null && max !== null) {
    if (min === max) return `${min}${suffix}`;
    return `${min}–${max}${suffix}`;
  }
  if (min !== null) return `≥ ${min}${suffix}`;
  return `≤ ${max}${suffix}`;
}

function paceRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'allure libre';
  if (min !== null && max !== null) {
    if (min === max) return `${formatPace(min)} /km`;
    return `${formatPace(min)}–${formatPace(max)} /km`;
  }
  if (min !== null) return `≥ ${formatPace(min)} /km`;
  return `≤ ${formatPace(max as number)} /km`;
}

/**
 * Construit une cible formatée. Les bornes absentes restent `null` ; aucune
 * valeur de repli n'est inventée.
 */
export function makeTarget(
  kind: TargetKind,
  unit: TargetUnit,
  min: number | null,
  max: number | null
): WorkoutTarget {
  if (min !== null && !Number.isFinite(min)) {
    throw new Error(`Cible ${kind} : borne minimale non finie`);
  }
  if (max !== null && !Number.isFinite(max)) {
    throw new Error(`Cible ${kind} : borne maximale non finie`);
  }
  if (min !== null && max !== null && min > max) {
    throw new Error(`Cible ${kind} : borne minimale supérieure à la maximale`);
  }

  let label: string;
  switch (unit) {
    case 's_per_km':
      label = paceRange(min, max);
      break;
    case 'w':
      label = range(min, max, ' W');
      break;
    case 'bpm':
      label = range(min, max, ' bpm');
      break;
    case 'rpe':
      label = range(min, max, ' / 10');
      break;
    case 'rpm':
      label = range(min, max, ' rpm');
      break;
    default:
      label = range(min, max, '');
  }

  return {
    kind,
    unit,
    min,
    max,
    label,
    basis: 'lkdv_prescription',
  };
}

export function makeStep(input: {
  id: string;
  kind: StepKind;
  label: string;
  durationS: number;
  targets?: WorkoutTarget[];
  instruction?: string | null;
}): SessionStep {
  if (!input.id) throw new Error('Étape sans identifiant');
  if (!Number.isFinite(input.durationS) || input.durationS <= 0) {
    throw new Error(`Durée invalide pour l'étape ${input.id}`);
  }
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    durationS: Math.round(input.durationS),
    targets: input.targets ?? [],
    instruction: input.instruction ?? null,
  };
}

export interface SessionDraft {
  id: string;
  planId: string | null;
  sport: WorkoutSport;
  goal: WorkoutGoal;
  level: WorkoutLevel;
  week: number | null;
  title: string;
  intent: SessionIntent;
  steps: SessionStep[];
}

/** Valide et estampille une séance ; la durée totale est la somme réelle. */
export function finalizeSession(draft: SessionDraft): StructuredSession {
  if (!draft.id) throw new Error('Séance sans identifiant');
  if (!draft.steps.length) {
    throw new Error(`Séance ${draft.id} sans étape`);
  }
  const seen = new Set<string>();
  for (const step of draft.steps) {
    if (seen.has(step.id)) {
      throw new Error(`Étape dupliquée dans la séance ${draft.id} : ${step.id}`);
    }
    seen.add(step.id);
  }
  const totalDurationS = draft.steps.reduce(
    (sum, step) => sum + step.durationS,
    0
  );
  return {
    version: WORKOUT_CONTRACT_VERSION,
    id: draft.id,
    planId: draft.planId,
    sport: draft.sport,
    goal: draft.goal,
    level: draft.level,
    week: draft.week,
    title: draft.title,
    intent: draft.intent,
    steps: draft.steps,
    totalDurationS,
    provider: 'lkdv',
  };
}

export function sessionDurationS(session: StructuredSession): number {
  return session.steps.reduce((sum, step) => sum + step.durationS, 0);
}

export function formatDurationS(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  }
  if (minutes > 0) {
    return `${minutes} min${seconds > 0 ? ` ${String(seconds).padStart(2, '0')} s` : ''}`;
  }
  return `${seconds} s`;
}

export function formatClockS(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Cible principale d'une étape, ou `null` si l'étape n'en porte aucune. */
export function primaryTarget(step: SessionStep): WorkoutTarget | null {
  return step.targets[0] ?? null;
}
