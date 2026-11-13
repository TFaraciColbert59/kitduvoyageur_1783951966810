/**
 * Stockage local du brouillon de musculation (S2.32).
 *
 * Le serveur possède un contrat privé (migration `20261113122000`), mais le
 * brouillon local reste la source de vérité de l’appareil : il est écrit avant
 * toute synchronisation et survit à une coupure réseau. Le parseur refuse les
 * formes inconnues et ne réhydrate que des séries réellement saisies.
 *
 * Depuis la fin de S2.32, le brouillon et les tombes de suppression sont
 * **rattachés au compte** qui les a créés. Une déconnexion n’efface rien : le
 * carnet de ce compte reste sous sa clé et sera retrouvé à sa reconnexion. Un
 * autre compte sur le même appareil ne voit donc pas ce brouillon et ne peut
 * pas le pousser sur son propre compte. Les anciennes clés globales restent
 * lisibles comme brouillon « non rattaché » : l’écran propose explicitement de
 * le récupérer pour le compte courant, jamais silencieusement.
 */

import type {
  StrengthExercise,
  StrengthLoadUnit,
  StrengthLog,
  StrengthSet,
} from '../state/types';
import {
  isStrengthActivitySessionId,
  MAX_STRENGTH_EXERCISE_NAME,
  MAX_STRENGTH_LOAD,
  MAX_STRENGTH_REPS,
  STRENGTH_CLIENT_ID_PATTERN,
  STRENGTH_LOG_VERSION,
} from './model';

export const STRENGTH_STORAGE_KEY = 'lkdv.explorer.strength.v1';
export const STRENGTH_DELETION_STORAGE_KEY = 'lkdv.explorer.strength.deletions.v1';

const OWNER_KEY_INFIX = ':owner:';
const MAX_PENDING_DELETIONS = 20;
const OWNER_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface StrengthDeletion {
  id: string;
  deletedAt: number;
}

/**
 * Propriétaire actif des écritures locales. `null` = brouillon non rattaché
 * (avant connexion ou ancienne clé globale). Il est fixé par l’écran après
 * lecture de la session ; le stockage ne devine jamais un identifiant.
 */
let activeStrengthOwner: string | null = null;

function normalizeOwner(ownerId: string | null | undefined): string | null {
  if (typeof ownerId !== 'string') return null;
  const clean = ownerId.trim();
  return OWNER_PATTERN.test(clean) ? clean : null;
}

export function setStrengthStorageOwner(ownerId: string | null | undefined): void {
  activeStrengthOwner = normalizeOwner(ownerId);
}

export function getStrengthStorageOwner(): string | null {
  return activeStrengthOwner;
}

/** Clé de stockage du carnet pour un propriétaire ; sans propriétaire, la clé historique. */
export function strengthStorageKey(ownerId: string | null = activeStrengthOwner): string {
  const owner = normalizeOwner(ownerId);
  return owner ? `${STRENGTH_STORAGE_KEY}${OWNER_KEY_INFIX}${owner}` : STRENGTH_STORAGE_KEY;
}

function deletionStorageKey(ownerId: string | null = activeStrengthOwner): string {
  const owner = normalizeOwner(ownerId);
  return owner
    ? `${STRENGTH_DELETION_STORAGE_KEY}${OWNER_KEY_INFIX}${owner}`
    : STRENGTH_DELETION_STORAGE_KEY;
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
  const activitySessionId = isStrengthActivitySessionId(value.activitySessionId)
    ? value.activitySessionId
    : null;
  return {
    version: STRENGTH_LOG_VERSION,
    id: value.id,
    startedAt,
    updatedAt,
    exercises,
    ...(activitySessionId ? { activitySessionId } : {}),
  };
}

function readDraftAtKey(key: string): StrengthLog | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return parseStrengthLog(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readStrengthDraft(
  ownerId: string | null = activeStrengthOwner,
): StrengthLog | null {
  return readDraftAtKey(strengthStorageKey(ownerId));
}

/** Ancienne clé unique, antérieure au rattachement par compte. */
export function readLegacyStrengthDraft(): StrengthLog | null {
  return readDraftAtKey(STRENGTH_STORAGE_KEY);
}

/** `false` signifie que la valeur reste seulement en mémoire. */
export function writeStrengthDraft(
  log: StrengthLog,
  ownerId: string | null = activeStrengthOwner,
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(strengthStorageKey(ownerId), JSON.stringify(log));
    return true;
  } catch {
    return false;
  }
}

export function clearStrengthDraft(ownerId: string | null = activeStrengthOwner): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(strengthStorageKey(ownerId));
  } catch {
    // Rien à effacer, ou stockage indisponible.
  }
}

function clearLegacyStrengthDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STRENGTH_STORAGE_KEY);
  } catch {
    // Le brouillon non rattaché reste lisible ; aucune perte silencieuse.
  }
}

function parseDeletion(value: unknown): StrengthDeletion | null {
  if (!isRecord(value)) return null;
  if (!isClientId(value.id)) return null;
  if (!isFiniteNumber(value.deletedAt) || value.deletedAt <= 0) return null;
  return { id: value.id, deletedAt: value.deletedAt };
}

function readDeletionsAtKey(key: string): StrengthDeletion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
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

/**
 * Suppressions demandées mais pas encore acquittées par le serveur. Une entrée
 * empêche la restauration distante de faire réapparaître un carnet effacé.
 */
export function readStrengthDeletions(
  ownerId: string | null = activeStrengthOwner,
): StrengthDeletion[] {
  return readDeletionsAtKey(deletionStorageKey(ownerId));
}

export function readLegacyStrengthDeletions(): StrengthDeletion[] {
  return readDeletionsAtKey(STRENGTH_DELETION_STORAGE_KEY);
}

function writeDeletionsAtKey(items: StrengthDeletion[], key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const kept = items.slice(-MAX_PENDING_DELETIONS);
    if (kept.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(kept));
    }
    return true;
  } catch {
    return false;
  }
}

function writeStrengthDeletions(
  items: StrengthDeletion[],
  ownerId: string | null = activeStrengthOwner,
): boolean {
  return writeDeletionsAtKey(items, deletionStorageKey(ownerId));
}

function clearLegacyStrengthDeletions(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STRENGTH_DELETION_STORAGE_KEY);
  } catch {
    // La file historique reste disponible pour une prochaine tentative.
  }
}

/** `false` signifie que la suppression ne pourra pas être rejouée après rechargement. */
export function enqueueStrengthDeletion(
  id: string,
  now = Date.now(),
  ownerId: string | null = activeStrengthOwner,
): boolean {
  if (!isClientId(id)) return false;
  const current = readStrengthDeletions(ownerId).filter((item) => item.id !== id);
  if (current.length >= MAX_PENDING_DELETIONS) return false;
  return writeStrengthDeletions([...current, { id, deletedAt: now }], ownerId);
}

export function removeStrengthDeletion(
  id: string,
  ownerId: string | null = activeStrengthOwner,
): boolean {
  const current = readStrengthDeletions(ownerId);
  const next = current.filter((item) => item.id !== id);
  if (next.length === current.length) return true;
  return writeStrengthDeletions(next, ownerId);
}

export function hasPendingStrengthDeletion(
  id?: string,
  ownerId: string | null = activeStrengthOwner,
): boolean {
  const current = readStrengthDeletions(ownerId);
  return id ? current.some((item) => item.id === id) : current.length > 0;
}

/**
 * Reprend une fois les tombes de l’ancienne clé globale pour le compte qui se
 * connecte. Les identifiants sont aléatoires et la RPC de suppression ne peut
 * toucher que les carnets du propriétaire : une tombe étrangère répond
 * `deleted: false` et n’efface rien. La migration n’a lieu que si l’écriture
 * scopée réussit ; sinon l’ancienne file reste intacte.
 */
export function claimLegacyStrengthDeletions(
  ownerId: string | null = activeStrengthOwner,
): number {
  const owner = normalizeOwner(ownerId);
  if (!owner) return 0;
  const legacy = readLegacyStrengthDeletions();
  if (legacy.length === 0) return 0;

  const merged = new Map<string, StrengthDeletion>();
  for (const item of [...readStrengthDeletions(owner), ...legacy]) {
    const previous = merged.get(item.id);
    if (!previous || item.deletedAt >= previous.deletedAt) merged.set(item.id, item);
  }
  const next = [...merged.values()].sort((a, b) => a.deletedAt - b.deletedAt);
  if (!writeStrengthDeletions(next, owner)) return 0;
  clearLegacyStrengthDeletions();
  return legacy.length;
}

/**
 * Récupère explicitement le brouillon non rattaché pour le compte courant.
 * L’écriture scopée précède la suppression de l’ancienne clé : un quota plein
 * laisse le brouillon historique intact. Retourne `null` si la copie a échoué.
 */
export function adoptLegacyStrengthState(
  ownerId: string | null = activeStrengthOwner,
): StrengthLog | null {
  const owner = normalizeOwner(ownerId);
  if (!owner) return null;
  const legacy = readLegacyStrengthDraft();
  claimLegacyStrengthDeletions(owner);
  if (!legacy) return null;
  if (!writeStrengthDraft(legacy, owner)) return null;
  clearLegacyStrengthDraft();
  return legacy;
}
