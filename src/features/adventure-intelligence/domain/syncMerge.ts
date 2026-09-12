/**
 * Phase 6 — Fusion champ par champ des opérations de synchronisation (pur).
 *
 * Politique explicite, jamais un « dernier écrivain gagne » global qui écraserait
 * des données terrain non rejouées :
 *
 * Sessions (`hike_sessions`) :
 *   • `ended_at`          — maximum des instants non nuls (une arrivée ne
 *                           recule jamais, même rejouée dans le désordre) ;
 *   • métriques monotones — `distance_km`, `duration_seconds`,
 *                           `elevation_gain_m` : maximum des valeurs finies
 *                           (aucune régression depuis un rejeu obsolète) ;
 *   • `positions_timed`   — UNION dédupliquée par horodatage, ordonnée, bornée ;
 *   • `poi_events`        — UNION dédupliquée (nom + instant), bornée ;
 *   • identités (route_id, kit_id, carnet_id) — premier non nul conservé,
 *                           jamais écrasé par un rejeu plus pauvre ;
 *   • `started_at`        — immuable (clé métier de la session).
 *
 * Décisions (`adventure_plan_decisions`) :
 *   • type/proposition/impact — immuables après création ;
 *   • statut — le plus récent `decided_at`/`created_at` gagne, sauf résurrection
 *     interdite : un statut terminal (`rejected`, `expired`) n'est jamais
 *     ramené à `proposed`/`confirmed` par une opération plus ancienne.
 *
 * Aucune I/O, aucune horloge implicite : entièrement testable.
 */

/** Longueur maximale des positions fusionnées (aligné sur la borne serveur). */
export const MAX_SESSION_MERGE_POSITIONS = 5000;
/** Longueur maximale des POI fusionnés (aligné sur la borne serveur). */
export const MAX_SESSION_MERGE_POI_EVENTS = 200;

export interface SessionMergeExisting {
  startedAt: string;
  endedAt: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  elevationGainM: number | null;
  positions: readonly unknown[];
  poiEvents: readonly unknown[];
  routeId: number | null;
  kitId: string | null;
  carnetId: string | null;
}

export interface SessionMergeIncoming {
  createdAt: string;
  endedAt: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  elevationGainM: number | null;
  positions: readonly unknown[];
  poiEvents: readonly unknown[];
  routeId: number | null;
  kitId: string | null;
  carnetId: string | null;
}

export interface SessionMergedFields {
  ended_at: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  elevation_gain_m: number | null;
  positions_timed: unknown[] | null;
  poi_events: unknown[];
  route_id: number | null;
  kit_id: string | null;
  carnet_id: string | null;
}

export interface SessionMergeResult {
  fields: SessionMergedFields;
  changedFields: string[];
  detail: string;
}

/** Nombre maximal de positions persistées (aligné sur la borne serveur). */
export const MAX_OFFLINE_SESSION_POSITIONS = MAX_SESSION_MERGE_POSITIONS;

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function maxMonotonic(left: number | null, right: number | null): number | null {
  if (left == null) return right;
  if (right == null) return left;
  return Math.max(left, right);
}

function laterIso(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (!Number.isFinite(leftMs)) return right;
  if (!Number.isFinite(rightMs)) return left;
  return rightMs > leftMs ? right : left;
}

function timestampOf(entry: unknown): number | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const record = entry as { timestamp?: unknown };
  if (typeof record.timestamp === 'number' && Number.isFinite(record.timestamp)) {
    return record.timestamp;
  }
  if (typeof record.timestamp === 'string') {
    const parsed = Date.parse(record.timestamp);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function stableEntryKey(entry: unknown): string {
  try {
    return JSON.stringify(entry) ?? String(entry);
  } catch {
    return String(entry);
  }
}

/**
 * Union dédupliquée des listes : première occurrence conservée, ordre
 * chronologique quand les horodatages sont exploitables, sinon ordre stable
 * (existant puis nouveau). Bornée aux dernières entrées.
 */
function unionEntries(
  existing: readonly unknown[],
  incoming: readonly unknown[],
  maxEntries: number
): unknown[] {
  const seen = new Set<string>();
  const merged: { entry: unknown; sortKey: number | null; index: number }[] = [];
  let index = 0;
  for (const entry of [...existing, ...incoming]) {
    const key = stableEntryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ entry, sortKey: timestampOf(entry), index });
    index += 1;
  }
  merged.sort((left, right) => {
    if (left.sortKey != null && right.sortKey != null && left.sortKey !== right.sortKey) {
      return left.sortKey - right.sortKey;
    }
    return left.index - right.index;
  });
  return merged.slice(-maxEntries).map((item) => item.entry);
}

function firstNonNull<T>(existing: T | null, incoming: T | null): T | null {
  return existing != null ? existing : incoming;
}

/**
 * Fusionne une session existante et une opération entrante champ par champ.
 * `changedFields` liste les colonnes réellement modifiées (diagnostic/journal).
 */
export function mergeSessionFields(
  existing: SessionMergeExisting,
  incoming: SessionMergeIncoming
): SessionMergeResult {
  const positions = unionEntries(
    existing.positions,
    incoming.positions,
    MAX_SESSION_MERGE_POSITIONS
  );
  const poiEvents = unionEntries(
    existing.poiEvents,
    incoming.poiEvents,
    MAX_SESSION_MERGE_POI_EVENTS
  );
  const fields: SessionMergedFields = {
    ended_at: laterIso(existing.endedAt, incoming.endedAt),
    distance_km: maxMonotonic(finiteOrNull(existing.distanceKm), finiteOrNull(incoming.distanceKm)),
    duration_seconds: maxMonotonic(
      finiteOrNull(existing.durationSeconds),
      finiteOrNull(incoming.durationSeconds)
    ),
    elevation_gain_m: maxMonotonic(
      finiteOrNull(existing.elevationGainM),
      finiteOrNull(incoming.elevationGainM)
    ),
    positions_timed: positions.length >= 2 ? positions : null,
    poi_events: poiEvents,
    route_id: firstNonNull(existing.routeId, incoming.routeId),
    kit_id: firstNonNull(existing.kitId, incoming.kitId),
    carnet_id: firstNonNull(existing.carnetId, incoming.carnetId),
  };

  const before: Record<string, unknown> = {
    ended_at: existing.endedAt,
    distance_km: finiteOrNull(existing.distanceKm),
    duration_seconds: finiteOrNull(existing.durationSeconds),
    elevation_gain_m: finiteOrNull(existing.elevationGainM),
    positions_timed: existing.positions.length >= 2 ? existing.positions : null,
    poi_events: existing.poiEvents,
    route_id: existing.routeId,
    kit_id: existing.kitId,
    carnet_id: existing.carnetId,
  };
  const changedFields = Object.keys(fields).filter((field) => {
    const previous = before[field];
    const next = (fields as unknown as Record<string, unknown>)[field];
    return JSON.stringify(previous) !== JSON.stringify(next);
  });

  return {
    fields,
    changedFields,
    detail:
      changedFields.length === 0
        ? 'session_conservee_plus_recente'
        : `session_fusion_champ_par_champ:${changedFields.join(',')}`,
  };
}

export type DecisionStatus = 'proposed' | 'confirmed' | 'rejected' | 'expired';

const TERMINAL_DECISION_STATUSES: readonly DecisionStatus[] = ['rejected', 'expired'];

/** Un statut terminal ne peut jamais être « ressuscité » par une opération. */
export function isTerminalDecisionStatus(status: DecisionStatus): boolean {
  return TERMINAL_DECISION_STATUSES.includes(status);
}

export interface DecisionMergeExisting {
  status: DecisionStatus;
  decidedAt: string | null;
  createdAt: string | null;
}

export interface DecisionMergeIncoming {
  status: DecisionStatus;
  decidedAt: string | null;
  createdAt: string;
}

export interface DecisionMergeResult {
  status: DecisionStatus;
  decidedAt: string;
  detail: string;
  changed: boolean;
}

function referenceTime(primary: string | null, fallback: string | null): number | null {
  const primaryMs = primary ? Date.parse(primary) : Number.NaN;
  if (Number.isFinite(primaryMs)) return primaryMs;
  const fallbackMs = fallback ? Date.parse(fallback) : Number.NaN;
  return Number.isFinite(fallbackMs) ? fallbackMs : null;
}

/**
 * Fusionne le statut d'une décision : le plus récent gagne, sauf résurrection
 * interdite d'un statut terminal. La proposition et l'impact restent immuables
 * (chemin d'insertion uniquement).
 */
export function mergeDecisionFields(
  existing: DecisionMergeExisting,
  incoming: DecisionMergeIncoming
): DecisionMergeResult {
  const existingTime = referenceTime(existing.decidedAt, existing.createdAt);
  const incomingTime = referenceTime(incoming.decidedAt, incoming.createdAt);
  const incomingIsNewer =
    existingTime == null || (incomingTime != null && incomingTime >= existingTime);
  const resurrection =
    isTerminalDecisionStatus(existing.status) && !isTerminalDecisionStatus(incoming.status);

  if (!incomingIsNewer || resurrection) {
    return {
      status: existing.status,
      decidedAt: existing.decidedAt ?? incoming.decidedAt ?? incoming.createdAt,
      detail: resurrection ? 'decision_terminale_conservee' : 'decision_conservee_plus_recente',
      changed: false,
    };
  }

  return {
    status: incoming.status,
    decidedAt: incoming.decidedAt ?? incoming.createdAt,
    detail: 'decision_mise_a_jour_plus_recente',
    changed: incoming.status !== existing.status,
  };
}
