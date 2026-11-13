import { parseExecution, validateSession } from '../domain/sessionEngine';
import {
  WORKOUT_CONTRACT_VERSION,
  type SessionExecution,
  type StructuredSession,
} from '../domain/types';

export const WORKOUT_SESSION_STORAGE_KEY = 'lkdv.workouts.active.v1';

export interface StoredWorkoutSession {
  version: typeof WORKOUT_CONTRACT_VERSION;
  execution: SessionExecution;
  session: StructuredSession;
  savedAt: number;
}

function defaultStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Persiste l'exécution locale **avec la séance complète**, pour qu'une séance
 * instantanée puisse être reprise sans reconstruire un historique absent.
 * Aucune donnée n'est envoyée au serveur.
 */
export function saveWorkoutSession(
  execution: SessionExecution,
  session: StructuredSession,
  storage: Storage | null = defaultStorage()
): boolean {
  if (!storage) return false;
  if (execution.sessionId !== session.id) return false;
  if (validateSession(session).length > 0) return false;
  const payload: StoredWorkoutSession = {
    version: WORKOUT_CONTRACT_VERSION,
    execution,
    session,
    savedAt: Date.now(),
  };
  try {
    storage.setItem(WORKOUT_SESSION_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadWorkoutSession(
  storage: Storage | null = defaultStorage()
): StoredWorkoutSession | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(WORKOUT_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearWorkoutSession(storage);
    return null;
  }

  const record = asRecord(parsed);
  if (!record || record.version !== WORKOUT_CONTRACT_VERSION) {
    clearWorkoutSession(storage);
    return null;
  }

  const executionResult = parseExecution(record.execution);
  const session = record.session as StructuredSession | undefined;
  if (!executionResult.ok || !session || validateSession(session).length > 0) {
    clearWorkoutSession(storage);
    return null;
  }
  if (session.id !== executionResult.execution.sessionId) {
    clearWorkoutSession(storage);
    return null;
  }

  return {
    version: WORKOUT_CONTRACT_VERSION,
    execution: executionResult.execution,
    session,
    savedAt: typeof record.savedAt === 'number' ? record.savedAt : 0,
  };
}

export function clearWorkoutSession(
  storage: Storage | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(WORKOUT_SESSION_STORAGE_KEY);
  } catch {
    // Un stockage indisponible ne doit jamais casser l'écran.
  }
}
