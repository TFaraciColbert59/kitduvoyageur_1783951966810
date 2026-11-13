/**
 * Modèle pur du carnet musculation (S2.32).
 *
 * Règle fondatrice : aucune valeur n’est inventée. Une série porte les
 * répétitions réellement saisies et, si elle existe, la charge réellement
 * saisie. Sans charge, le volume reste `null` : le poids du corps n’est pas
 * déduit d’un profil, d’un historique ou d’une estimation.
 *
 * Le modèle ne connaît ni React, ni Supabase, ni le stockage : il peut être
 * rejoué tel quel et ne crée aucune dépendance externe.
 */

import type {
  StrengthExercise,
  StrengthLoadUnit,
  StrengthLog,
  StrengthSet,
} from '../state/types';

export const STRENGTH_LOG_VERSION = 1 as const;

/** Conversion exacte, utilisée uniquement pour afficher un volume en kg. */
export const LB_TO_KG = 0.453_592_37;

const MAX_EXERCISE_NAME_LENGTH = 80;
const MAX_REPS = 999;
const MAX_LOAD = 10_000;

export interface StrengthSetInput {
  reps: number;
  load: number | null;
  unit: StrengthLoadUnit;
}

export interface StrengthExerciseTotals {
  sets: number;
  reps: number;
  /** Somme des volumes des séries chargées, ou `null` si aucune charge. */
  volumeKg: number | null;
  loadedSets: number;
}

export interface StrengthLogTotals extends StrengthExerciseTotals {
  exercises: number;
}

function newId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `${prefix}-${cryptoApi.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createStrengthLog(now = Date.now()): StrengthLog {
  return {
    version: STRENGTH_LOG_VERSION,
    id: newId('strength'),
    startedAt: now,
    updatedAt: now,
    exercises: [],
  };
}

function cleanExerciseName(name: string): string | null {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > MAX_EXERCISE_NAME_LENGTH) return null;
  return clean;
}

function cleanSetInput(input: StrengthSetInput): StrengthSetInput | null {
  if (!Number.isInteger(input.reps) || input.reps < 1 || input.reps > MAX_REPS) {
    return null;
  }
  if (
    input.load !== null &&
    (!Number.isFinite(input.load) || input.load < 0 || input.load > MAX_LOAD)
  ) {
    return null;
  }
  if (input.unit !== 'kg' && input.unit !== 'lb') return null;
  return { reps: input.reps, load: input.load, unit: input.unit };
}

function touch(log: StrengthLog, exercises: StrengthExercise[], now: number): StrengthLog {
  return { ...log, exercises, updatedAt: now };
}

/** Ajoute un exercice nommé explicitement par l’utilisateur. */
export function addStrengthExercise(
  log: StrengthLog,
  name: string,
  options: { id?: string; now?: number } = {},
): { log: StrengthLog; exercise: StrengthExercise } | null {
  const clean = cleanExerciseName(name);
  if (!clean) return null;
  const now = options.now ?? Date.now();
  const exercise: StrengthExercise = {
    id: options.id ?? newId('exercise'),
    name: clean,
    sets: [],
  };
  return { log: touch(log, [...log.exercises, exercise], now), exercise };
}

export function removeStrengthExercise(log: StrengthLog, exerciseId: string): StrengthLog {
  const next = log.exercises.filter((exercise) => exercise.id !== exerciseId);
  if (next.length === log.exercises.length) return log;
  return touch(log, next, Date.now());
}

export function getStrengthExercise(
  log: StrengthLog,
  exerciseId: string,
): StrengthExercise | null {
  return log.exercises.find((exercise) => exercise.id === exerciseId) ?? null;
}

/** Ajoute une série à un exercice existant, sans créer d’exercice implicite. */
export function addStrengthSet(
  log: StrengthLog,
  exerciseId: string,
  input: StrengthSetInput,
  options: { id?: string; now?: number } = {},
): { log: StrengthLog; set: StrengthSet } | null {
  const clean = cleanSetInput(input);
  if (!clean) return null;
  if (!getStrengthExercise(log, exerciseId)) return null;
  const set: StrengthSet = {
    id: options.id ?? newId('set'),
    reps: clean.reps,
    load: clean.load,
    unit: clean.unit,
  };
  const exercises = log.exercises.map((exercise) =>
    exercise.id === exerciseId ? { ...exercise, sets: [...exercise.sets, set] } : exercise,
  );
  return { log: touch(log, exercises, options.now ?? Date.now()), set };
}

/** Remplace les valeurs d’une série ; une entrée invalide laisse le log intact. */
export function updateStrengthSet(
  log: StrengthLog,
  exerciseId: string,
  setId: string,
  input: StrengthSetInput,
  now = Date.now(),
): StrengthLog {
  const clean = cleanSetInput(input);
  if (!clean) return log;
  let changed = false;
  const exercises = log.exercises.map((exercise) => {
    if (exercise.id !== exerciseId) return exercise;
    const sets = exercise.sets.map((set) => {
      if (set.id !== setId) return set;
      changed = true;
      return { ...set, reps: clean.reps, load: clean.load, unit: clean.unit };
    });
    return changed ? { ...exercise, sets } : exercise;
  });
  return changed ? touch(log, exercises, now) : log;
}

export function removeStrengthSet(
  log: StrengthLog,
  exerciseId: string,
  setId: string,
): StrengthLog {
  let changed = false;
  const exercises = log.exercises.map((exercise) => {
    if (exercise.id !== exerciseId) return exercise;
    const sets = exercise.sets.filter((set) => set.id !== setId);
    if (sets.length === exercise.sets.length) return exercise;
    changed = true;
    return { ...exercise, sets };
  });
  return changed ? touch(log, exercises, Date.now()) : log;
}

/** Volume d’une série en kg, ou `null` quand la charge n’a pas été saisie. */
export function strengthSetVolumeKg(set: StrengthSet): number | null {
  if (set.load === null) return null;
  const kg = set.unit === 'lb' ? set.load * LB_TO_KG : set.load;
  return kg * set.reps;
}

export function strengthExerciseTotals(exercise: StrengthExercise): StrengthExerciseTotals {
  let reps = 0;
  let volumeKg: number | null = null;
  let loadedSets = 0;
  for (const set of exercise.sets) {
    reps += set.reps;
    const volume = strengthSetVolumeKg(set);
    if (volume !== null) {
      loadedSets += 1;
      volumeKg = (volumeKg ?? 0) + volume;
    }
  }
  return { sets: exercise.sets.length, reps, volumeKg, loadedSets };
}

export function strengthLogTotals(log: StrengthLog | null | undefined): StrengthLogTotals {
  if (!log) return { exercises: 0, sets: 0, reps: 0, volumeKg: null, loadedSets: 0 };
  let sets = 0;
  let reps = 0;
  let volumeKg: number | null = null;
  let loadedSets = 0;
  for (const exercise of log.exercises) {
    const totals = strengthExerciseTotals(exercise);
    sets += totals.sets;
    reps += totals.reps;
    loadedSets += totals.loadedSets;
    if (totals.volumeKg !== null) volumeKg = (volumeKg ?? 0) + totals.volumeKg;
  }
  return { exercises: log.exercises.length, sets, reps, volumeKg, loadedSets };
}

export function formatStrengthNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatStrengthLoad(set: StrengthSet): string {
  if (set.load === null) return 'Poids du corps';
  return `${formatStrengthNumber(set.load, 2)} ${set.unit}`;
}

export function formatStrengthVolume(volumeKg: number | null): string {
  if (volumeKg === null) return 'Non calculé';
  return `${formatStrengthNumber(volumeKg, 1)} kg`;
}
