import { describe, expect, it } from 'vitest';
import { buildRunningPlan } from '../domain/plans';
import { createExecution } from '../domain/sessionEngine';
import {
  clearWorkoutSession,
  loadWorkoutSession,
  saveWorkoutSession,
  WORKOUT_SESSION_STORAGE_KEY,
} from '../client/sessionStore';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('persistance locale de séance', () => {
  it('enregistre et relit une exécution avec sa séance', () => {
    const storage = memoryStorage();
    const session = buildRunningPlan('10k', 'intermediaire').weeks[0].sessions[0];
    const execution = createExecution(session, 1_000, 'exec-store');

    expect(saveWorkoutSession(execution, session, storage)).toBe(true);
    const stored = loadWorkoutSession(storage);

    expect(stored?.execution.executionId).toBe('exec-store');
    expect(stored?.session.id).toBe(session.id);
    expect(stored?.session.steps).toHaveLength(session.steps.length);
  });

  it('efface la séance', () => {
    const storage = memoryStorage();
    const session = buildRunningPlan('5k', 'debutant').weeks[0].sessions[0];
    const execution = createExecution(session, 0, 'exec-clear');
    saveWorkoutSession(execution, session, storage);

    clearWorkoutSession(storage);
    expect(storage.getItem(WORKOUT_SESSION_STORAGE_KEY)).toBeNull();
    expect(loadWorkoutSession(storage)).toBeNull();
  });

  it('refuse un JSON corrompu ou une version inconnue', () => {
    const storage = memoryStorage();
    storage.setItem(WORKOUT_SESSION_STORAGE_KEY, '{pas-json');
    expect(loadWorkoutSession(storage)).toBeNull();
    expect(storage.getItem(WORKOUT_SESSION_STORAGE_KEY)).toBeNull();

    storage.setItem(
      WORKOUT_SESSION_STORAGE_KEY,
      JSON.stringify({ version: 99 })
    );
    expect(loadWorkoutSession(storage)).toBeNull();
  });

  it('refuse une séance qui ne correspond pas à l’exécution', () => {
    const storage = memoryStorage();
    const session = buildRunningPlan('5k', 'debutant').weeks[0].sessions[0];
    const execution = createExecution(session, 0, 'exec-mismatch');
    storage.setItem(
      WORKOUT_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        execution,
        session: { ...session, id: 'autre' },
        savedAt: 0,
      })
    );

    expect(loadWorkoutSession(storage)).toBeNull();
  });

  it('ne promet rien sans stockage', () => {
    const session = buildRunningPlan('5k', 'debutant').weeks[0].sessions[0];
    const execution = createExecution(session, 0, 'exec-nostore');
    expect(saveWorkoutSession(execution, session, null)).toBe(false);
    expect(loadWorkoutSession(null)).toBeNull();
    expect(() => clearWorkoutSession(null)).not.toThrow();
  });
});
