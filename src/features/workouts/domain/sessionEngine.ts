import { sessionDurationS } from './sessionFactory';
import {
  WORKOUT_CONTRACT_VERSION,
  type SessionExecution,
  type SessionExecutionStatus,
  type SessionStep,
  type StructuredSession,
} from './types';

const DEFAULT_RESUME_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ExecutionParseResult =
  | { ok: true; execution: SessionExecution }
  | { ok: false; reason: 'invalid' | 'version' };

export interface StepPosition {
  index: number;
  step: SessionStep;
  stepElapsedS: number;
}

/** Valide une séance avant exécution ou envoi. Retourne les erreurs lisibles. */
export function validateSession(session: StructuredSession): string[] {
  const errors: string[] = [];
  if (session.version !== WORKOUT_CONTRACT_VERSION) {
    errors.push('Version de contrat inconnue.');
  }
  if (!session.id) errors.push('Séance sans identifiant.');
  if (session.sport !== 'course' && session.sport !== 'velo') {
    errors.push('Sport inconnu.');
  }
  if (!session.steps.length) errors.push('Séance sans étape.');
  const seen = new Set<string>();
  for (const step of session.steps) {
    if (!step.id) errors.push('Étape sans identifiant.');
    if (seen.has(step.id)) errors.push(`Étape dupliquée : ${step.id}.`);
    seen.add(step.id);
    if (!Number.isFinite(step.durationS) || step.durationS <= 0) {
      errors.push(`Durée invalide pour l’étape ${step.id}.`);
    }
  }
  if (sessionDurationS(session) !== session.totalDurationS) {
    errors.push('Durée totale incohérente avec les étapes.');
  }
  return errors;
}

export function isValidSession(session: StructuredSession): boolean {
  return validateSession(session).length === 0;
}

function makeExecutionId(sessionId: string, now: number): string {
  const cryptoRef =
    typeof globalThis !== 'undefined'
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return `${sessionId}:${now}`;
}

export function createExecution(
  session: StructuredSession,
  now: number,
  executionId?: string
): SessionExecution {
  const errors = validateSession(session);
  if (errors.length > 0) {
    throw new Error(`Séance invalide : ${errors.join(' ')}`);
  }
  return {
    version: WORKOUT_CONTRACT_VERSION,
    executionId: executionId ?? makeExecutionId(session.id, now),
    sessionId: session.id,
    sport: session.sport,
    status: 'running',
    elapsedS: 0,
    startedAt: now,
    runningSince: now,
    pausedAt: null,
    completedAt: null,
    updatedAt: now,
  };
}

function locateStep(
  session: StructuredSession,
  elapsedS: number
): StepPosition | null {
  if (elapsedS >= session.totalDurationS) return null;
  let cursor = 0;
  for (let index = 0; index < session.steps.length; index += 1) {
    const step = session.steps[index];
    if (elapsedS < cursor + step.durationS) {
      return { index, step, stepElapsedS: elapsedS - cursor };
    }
    cursor += step.durationS;
  }
  return null;
}

/** Fait avancer l'exécution de `delta` secondes actives, sans dépasser la fin. */
export function advanceExecution(
  execution: SessionExecution,
  session: StructuredSession,
  now: number
): SessionExecution {
  if (execution.status !== 'running') return execution;
  const runningSince = execution.runningSince ?? now;
  const deltaS = Math.max(0, (now - runningSince) / 1000);
  const total = session.totalDurationS;
  const elapsedS = Math.min(total, execution.elapsedS + deltaS);
  const completed = elapsedS >= total;
  return {
    ...execution,
    elapsedS,
    status: completed ? 'completed' : 'running',
    runningSince: completed ? null : now,
    completedAt: completed ? now : null,
    updatedAt: now,
  };
}

export function pauseExecution(
  execution: SessionExecution,
  session: StructuredSession,
  now: number
): SessionExecution {
  const advanced = advanceExecution(execution, session, now);
  if (advanced.status !== 'running') return advanced;
  return {
    ...advanced,
    status: 'paused',
    pausedAt: now,
    runningSince: null,
    updatedAt: now,
  };
}

export function resumeExecution(
  execution: SessionExecution,
  now: number
): SessionExecution {
  if (execution.status !== 'paused') return execution;
  return {
    ...execution,
    status: 'running',
    pausedAt: null,
    runningSince: now,
    updatedAt: now,
  };
}

/** Saute l'étape courante ; une pause reste une pause. */
export function skipStep(
  execution: SessionExecution,
  session: StructuredSession,
  now: number
): SessionExecution {
  const position = locateStep(session, execution.elapsedS);
  if (!position) {
    return {
      ...execution,
      status: 'completed',
      elapsedS: session.totalDurationS,
      runningSince: null,
      completedAt: execution.completedAt ?? now,
      updatedAt: now,
    };
  }
  const nextElapsed = session.steps
    .slice(0, position.index + 1)
    .reduce((sum, step) => sum + step.durationS, 0);
  const completed = nextElapsed >= session.totalDurationS;
  const paused = execution.status === 'paused';
  return {
    ...execution,
    elapsedS: nextElapsed,
    status: completed ? 'completed' : paused ? 'paused' : 'running',
    runningSince: completed || paused ? null : now,
    pausedAt: completed ? null : execution.pausedAt,
    completedAt: completed ? now : null,
    updatedAt: now,
  };
}

export function currentStepPosition(
  execution: SessionExecution,
  session: StructuredSession
): StepPosition | null {
  return locateStep(session, execution.elapsedS);
}

export function currentStep(
  execution: SessionExecution,
  session: StructuredSession
): SessionStep | null {
  return currentStepPosition(execution, session)?.step ?? null;
}

export function nextStep(
  execution: SessionExecution,
  session: StructuredSession
): SessionStep | null {
  const position = locateStep(session, execution.elapsedS);
  if (!position) return null;
  return session.steps[position.index + 1] ?? null;
}

export function stepElapsedS(
  execution: SessionExecution,
  session: StructuredSession
): number {
  const position = locateStep(session, execution.elapsedS);
  return position?.stepElapsedS ?? session.steps.at(-1)?.durationS ?? 0;
}

export function sessionProgress(
  execution: SessionExecution,
  session: StructuredSession
): number {
  if (session.totalDurationS <= 0) return 1;
  return Math.max(0, Math.min(1, execution.elapsedS / session.totalDurationS));
}

export function remainingS(
  execution: SessionExecution,
  session: StructuredSession
): number {
  return Math.max(0, session.totalDurationS - execution.elapsedS);
}

export function isExecutionResumable(
  execution: SessionExecution,
  now: number,
  ttlMs: number = DEFAULT_RESUME_TTL_MS
): boolean {
  if (execution.status === 'completed') return false;
  if (!Number.isFinite(execution.elapsedS)) return false;
  return now - execution.updatedAt <= ttlMs;
}

const STATUSES: readonly SessionExecutionStatus[] = [
  'running',
  'paused',
  'completed',
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Relit une exécution locale ; une version inconnue n'est jamais interprétée. */
export function parseExecution(value: unknown): ExecutionParseResult {
  if (value === null || typeof value !== 'object') {
    return { ok: false, reason: 'invalid' };
  }
  const record = value as Record<string, unknown>;
  if (record.version !== WORKOUT_CONTRACT_VERSION) {
    return { ok: false, reason: 'version' };
  }
  if (
    typeof record.executionId !== 'string' ||
    typeof record.sessionId !== 'string' ||
    (record.sport !== 'course' && record.sport !== 'velo') ||
    typeof record.status !== 'string' ||
    !(STATUSES as readonly string[]).includes(record.status) ||
    !isFiniteNumber(record.elapsedS) ||
    record.elapsedS < 0 ||
    !isFiniteNumber(record.startedAt) ||
    !isFiniteNumber(record.updatedAt) ||
    (record.runningSince !== null && !isFiniteNumber(record.runningSince)) ||
    (record.pausedAt !== null && !isFiniteNumber(record.pausedAt)) ||
    (record.completedAt !== null && !isFiniteNumber(record.completedAt))
  ) {
    return { ok: false, reason: 'invalid' };
  }
  return {
    ok: true,
    execution: {
      version: WORKOUT_CONTRACT_VERSION,
      executionId: record.executionId,
      sessionId: record.sessionId,
      sport: record.sport,
      status: record.status as SessionExecutionStatus,
      elapsedS: record.elapsedS,
      startedAt: record.startedAt,
      runningSince: record.runningSince as number | null,
      pausedAt: record.pausedAt as number | null,
      completedAt: record.completedAt as number | null,
      updatedAt: record.updatedAt,
    },
  };
}

export function serializeExecution(execution: SessionExecution): string {
  return JSON.stringify(execution);
}
