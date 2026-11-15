/**
 * Lot A02 — types serveur de la surcouche de cycle de vie.
 *
 * Le contrat public (`@/features/compte/lifecycle`) reste la seule source de
 * vérité des structures. Ce fichier ne décrit que la persistance et les
 * options des adaptateurs.
 */

import type {
  ActivityLifecycleStatus,
  ActivityProvenanceOrigin,
  LifecycleActivityRecord,
} from '@/features/activity/lifecycle';

/** Ligne persistée : une surcouche A02 par (propriétaire, activité). */
export interface LifecycleOverlayRow {
  userId: string;
  activityId: string;
  parentActivityId: string | null;
  source: ActivityProvenanceOrigin;
  revision: number;
  lifecycleStatus: ActivityLifecycleStatus;
  deletedAt: string | null;
  purgeAfter: string | null;
  record: LifecycleActivityRecord;
  operationId: string | null;
  updatedAt: string;
}

/**
 * Port de persistance de la surcouche.
 *
 * Les implémentations doivent être bornées au propriétaire : `userId` est
 * toujours explicite et ne provient jamais du corps de la requête HTTP.
 */
export interface LifecycleOverlayStore {
  listOverlays(userId: string): Promise<LifecycleOverlayRow[]>;
  getOverlay(userId: string, activityId: string): Promise<LifecycleOverlayRow | null>;
  /** Écrit une surcouche et retourne l'état effectivement persisté. */
  saveOverlay(row: LifecycleOverlayRow): Promise<LifecycleOverlayRow>;
  /** Écrit plusieurs surcouches (fractionnement) de façon atomique si possible. */
  saveOverlays(rows: readonly LifecycleOverlayRow[]): Promise<LifecycleOverlayRow[]>;
  deleteOverlay(userId: string, activityId: string): Promise<void>;
}

/** Levée lorsqu'une écriture est demandée sans persistance disponible. */
export class LifecyclePersistenceUnavailableError extends Error {
  constructor(message = 'La persistance du cycle de vie est indisponible.') {
    super(message);
    this.name = 'LifecyclePersistenceUnavailableError';
  }
}

/** Levée lorsqu'une écriture concurrente a déjà fait avancer la révision. */
export class LifecycleRevisionConflictError extends Error {
  readonly currentRevision: number;

  constructor(currentRevision: number) {
    super('Cette activité a été modifiée entre-temps.');
    this.name = 'LifecycleRevisionConflictError';
    this.currentRevision = currentRevision;
  }
}

/** Levée lorsqu'aucune source ni surcouche ne porte l'activité demandée. */
export class LifecycleNotFoundError extends Error {
  constructor() {
    super('Activité introuvable.');
    this.name = 'LifecycleNotFoundError';
  }
}

export interface ListActivitiesOptions {
  /** Recherche libre (sport, date, lieu, tags, provenance) — S2.16. */
  query?: string;
  /** Inclure la corbeille (propriétaire uniquement) — S1.24. */
  includeDeleted?: boolean;
  /** Ne retourner que la corbeille. */
  deletedOnly?: boolean;
  limit?: number;
  requestSeq?: number;
  /** Injecté pour des tests déterministes. */
  nowMs?: number;
}

export interface ListActivitiesResult {
  items: LifecycleActivityRecord[];
  totalMatched: number;
  /** Nombre de suppressions dont la rétention de 30 jours est dépassée. */
  expiredDeletedCount: number;
  requestSeq: number;
}

/** Charge une source unique pour une activité donnée. */
export interface ActivitySourceSlice {
  record: LifecycleActivityRecord;
  /** Trace brute telle que stockée dans la table source. */
  sourcePointsCount: number;
}
