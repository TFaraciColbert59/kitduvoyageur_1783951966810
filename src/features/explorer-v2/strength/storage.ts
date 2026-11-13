/**
 * Stockage local du brouillon de musculation (S2.32).
 *
 * Le serveur possède désormais un contrat privé (migration `20261113122000`),
 * mais le brouillon local reste la source de vérité de l’appareil : il est
 * écrit avant toute synchronisation et survit à une coupure réseau. Le parseur
 * refuse les formes inconnues et ne réhydrate que des séries réellement
 * saisies. Une file de suppressions permet de rejouer un effacement demandé
 * hors ligne sans ressusciter le carnet depuis le serveur.
 */

import type {
  StrengthExercise,
  StrengthLoadUnit,
  StrengthLog,
  StrengthSet,
} from '../state/types';
import {
  MAX_STRENGTH_EXERCISE_NAME,
  MAX_STRENGTH_LOAD,
  MAX_STRENGTH_REPS,
  STRENGTH_CLIENT_ID_PATTERN,
  STRENGTH_LOG_VERSION,
} from './model';

export const STRENGTH_STORAGE_KEY = 'lkdv.explorer.strength.v1';
export const STRENGTH_DELETION_STORAGE_KEY = 'lkdv.explorer.strength.deletions.v1';

const MAX_PENDING_DELETIONS = 20;

export interface StrengthDeletion {
  id: string;
  deletedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isClientId(value: unknown): value is string {
  return typeof value === 'string' && STRENGTH_CLIENT_ID_PATTERN.test(value);
}

function parseUnit(value: unknown): StrengthLoadUnit | null {
  return value === 'kg' || value === 'lb' ? value : null;
}

function parseSet(value: unknown): StrengthSet | null {
  if (!isRecord(value)) return null;
  if (!isClientId(value.id)) return null;
  if (
    !Number.isInteger(value.reps) ||
    (value.reps as number) < 1 ||
    (value.reps as number) > MAX_STRENGTH_REPS
  ) {
    return null;
  }
  const unit = parseUnit(value.unit);
  if (!unit) return null;
  const load =
    value.load === null
      ? null
      : isFiniteNumber(value.load) && value.load >= 0 && value.load <= MAX_STRENGTH_LOAD
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
  if (!isClientId(value.id)) return null;
  if (typeof value.name !== 'string') return null;
  const name = value.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > MAX_STRENGTH_EXERCISE_NAME) return null;
  const sets = Array.isArray(value.sets)
    ? value.sets.map(parseSet).filter((set): set is StrengthSet => set !== null)
    : [];
  return { id: value.id, name, sets };
}

/** Lit une valeur stockée ; une forme invalide est ignorée, jamais réparée. */
export function parseStrengthLog(value: unknown): StrengthLog | null {
  if (!isRecord(value)) return null;
  if (value.version !== STRENGTH_LOG_VERSION) return null;
  if (!isClientId(value.id)) return null;
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

function parseDeletion(value: unknown): StrengthDeletion | null {
  if (!isRecord(value)) return null;
  if (!isClientId(value.id)) return null;
  if (!isFiniteNumber(value.deletedAt) || value.deletedAt <= 0) return null;
  return { id: value.id, deletedAt: value.deletedAt };
}

/**
 * Suppressions demandées mais pas encore acquittées par le serveur. Une entrée
 * empêche la restauration distante de faire réapparaître un carnet effacé.
 */
export function readStrengthDeletions(): StrengthDeletion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STRENGTH_DELETION_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseDeletion)
      .filter((item): item is StrengthDeletion => item !== null)
      .slice(-MAX_PENDING_DELETIONS);
  } catch {
    return [];
  }
}

function writeStrengthDeletions(items: StrengthDeletion[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const kept = items.slice(-MAX_PENDING_DELETIONS);
    if (kept.length === 0) {
      window.localStorage.removeItem(STRENGTH_DELETION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(STRENGTH_DELETION_STORAGE_KEY, JSON.stringify(kept));
    }
    return true;
  } catch {
    return false;
  }
}

/** `false` signifie que la suppression ne pourra pas être rejouée après rechargement. */
export function enqueueStrengthDeletion(id: string, now = Date.now()): boolean {
  if (!isClientId(id)) return false;
  const current = readStrengthDeletions().filter((item) => item.id !== id);
  if (current.length >= MAX_PENDING_DELETIONS) return false;
  return writeStrengthDeletions([...current, { id, deletedAt: now }]);
}

export function removeStrengthDeletion(id: string): boolean {
  const current = readStrengthDeletions();
  const next = current.filter((item) => item.id !== id);
  if (next.length === current.length) return true;
  return writeStrengthDeletions(next);
}

export function hasPendingStrengthDeletion(id?: string): boolean {
  const current = readStrengthDeletions();
  return id ? current.some((item) => item.id === id) : current.length > 0;
}
