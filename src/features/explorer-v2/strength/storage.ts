/**
 * Stockage local du brouillon de musculation (S2.32).
 *
 * Aucune table serveur ne décrit aujourd’hui les exercices et les séries.
 * Le brouillon est donc conservé dans `localStorage`, sous une clé versionnée,
 * et n’est jamais présenté comme une sortie enregistrée. Le parseur refuse les
 * formes inconnues et ne réhydrate que des séries réellement saisies.
 */

import type {
  StrengthExercise,
  StrengthLoadUnit,
  StrengthLog,
  StrengthSet,
} from '../state/types';
import { STRENGTH_LOG_VERSION } from './model';

export const STRENGTH_STORAGE_KEY = 'lkdv.explorer.strength.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseUnit(value: unknown): StrengthLoadUnit | null {
  return value === 'kg' || value === 'lb' ? value : null;
}

function parseSet(value: unknown): StrengthSet | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (
    !Number.isInteger(value.reps) ||
    (value.reps as number) < 1 ||
    (value.reps as number) > 999
  ) {
    return null;
  }
  const unit = parseUnit(value.unit);
  if (!unit) return null;
  const load =
    value.load === null
      ? null
      : isFiniteNumber(value.load) && value.load >= 0 && value.load <= 10_000
        ? value.load
        : undefined;
  if (load === undefined) return null;
  return {
    id: value.id,
    reps: value.reps as number,
    load,
    unit,
  };
}

function parseExercise(value: unknown): StrengthExercise | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (typeof value.name !== 'string') return null;
  const name = value.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80) return null;
  const sets = Array.isArray(value.sets)
    ? value.sets.map(parseSet).filter((set): set is StrengthSet => set !== null)
    : [];
  return { id: value.id, name, sets };
}

/** Lit une valeur stockée ; une forme invalide est ignorée, jamais réparée. */
export function parseStrengthLog(value: unknown): StrengthLog | null {
  if (!isRecord(value)) return null;
  if (value.version !== STRENGTH_LOG_VERSION) return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  const startedAt = value.startedAt;
  const updatedAt = value.updatedAt;
  if (!isFiniteNumber(startedAt) || startedAt <= 0) return null;
  if (!isFiniteNumber(updatedAt) || updatedAt <= 0) return null;
  if (!Array.isArray(value.exercises)) return null;
  const exercises = value.exercises
    .map(parseExercise)
    .filter((exercise): exercise is StrengthExercise => exercise !== null);
  return {
    version: STRENGTH_LOG_VERSION,
    id: value.id,
    startedAt,
    updatedAt,
    exercises,
  };
}

export function readStrengthDraft(): StrengthLog | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STRENGTH_STORAGE_KEY);
    if (!raw) return null;
    return parseStrengthLog(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** `false` signifie que la valeur reste seulement en mémoire. */
export function writeStrengthDraft(log: StrengthLog): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STRENGTH_STORAGE_KEY, JSON.stringify(log));
    return true;
  } catch {
    return false;
  }
}

export function clearStrengthDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STRENGTH_STORAGE_KEY);
  } catch {
    // Rien à effacer, ou stockage indisponible.
  }
}
