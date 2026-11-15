/**
 * Export local du carnet de musculation (S2.32).
 *
 * L’export RGPD du compte (`/api/account/export`) couvre les carnets déjà
 * synchronisés. Ce module produit le même contenu depuis l’appareil, sans
 * réseau, pour qu’un brouillon hors ligne ou non rattaché reste portable.
 * Aucun identifiant de compte ni de propriétaire n’est écrit dans le fichier.
 */

import type { StrengthExercise, StrengthLog, StrengthSet } from '../state/types';

export const STRENGTH_EXPORT_SCHEMA_VERSION = 's2.32-v1';

export interface StrengthExportBundle {
  schemaVersion: typeof STRENGTH_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  source: 'local';
  log: StrengthLog;
}

function cloneSet(set: StrengthSet): StrengthSet {
  return { ...set };
}

function cloneExercise(exercise: StrengthExercise): StrengthExercise {
  return { ...exercise, sets: exercise.sets.map(cloneSet) };
}

function cloneLog(log: StrengthLog): StrengthLog {
  return {
    ...log,
    exercises: log.exercises.map(cloneExercise),
  };
}

/** Construit un export stable, sans donnée déduite ni identifiant d’appareil. */
export function buildStrengthExport(
  log: StrengthLog,
  options: { now?: Date } = {},
): StrengthExportBundle {
  const now = options.now ?? new Date();
  return {
    schemaVersion: STRENGTH_EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    source: 'local',
    log: cloneLog(log),
  };
}

/** Nom de fichier daté ; jamais d’adresse électronique ni d’identifiant de compte. */
export function strengthExportFileName(now = new Date()): string {
  return `lkdv-carnet-musculation-${now.toISOString().slice(0, 10)}.json`;
}
