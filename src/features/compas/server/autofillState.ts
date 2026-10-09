/**
 * État d'une préparation en cours, gardé dans `trips.metadata.compas`
 * (prises de phase, itinéraire écrit en attente du reste). Fonctions pures :
 * `autofillActions.ts` est un fichier d'actions serveur, qui ne peut exporter
 * que des fonctions asynchrones.
 *
 * Plan 2.6 : une préparation coupée (limite de la fonction, réseau) laisse un
 * état qu'« Annuler » retrouve et qu'une relance reprend, jamais des étapes
 * orphelines comptées comme celles de la personne.
 */

/** Itinéraire écrit, en attente du reste (nuits, trajet, kit, budget). */
export interface PendingRun {
  runId: string;
  stepIds: string[];
  routeSet: boolean;
  notes: string[];
  /** Dates posées par le préremplissage (meilleure période) : l'annulation les retire. */
  datesSet?: boolean;
  /** Heure (ms) à laquelle le reste a été pris en main. */
  restAt?: number;
  /** Préremplissages d'affilée restés sur l'itinéraire de secours (0 : itinéraire réel). */
  stagesFallback?: number;
}

export type AutofillPhase = 'steps' | 'rest' | 'all';

/** Durée d'une prise : la durée maximale d'une préparation en une passe. */
export const CLAIM_MS = 290_000;

function compasPart(meta: Record<string, unknown>): Record<string, unknown> {
  const c = meta.compas;
  return c && typeof c === 'object' && !Array.isArray(c) ? { ...(c as Record<string, unknown>) } : {};
}

export function readPending(meta: Record<string, unknown>): PendingRun | null {
  const p = compasPart(meta).autofill_pending as Partial<PendingRun> | undefined;
  if (!p || typeof p.runId !== 'string') return null;
  return {
    runId: p.runId,
    stepIds: Array.isArray(p.stepIds) ? p.stepIds.filter((x): x is string => typeof x === 'string') : [],
    routeSet: p.routeSet === true,
    datesSet: p.datesSet === true,
    restAt: typeof p.restAt === 'number' ? p.restAt : undefined,
    stagesFallback: Number.isInteger(p.stagesFallback) ? Number(p.stagesFallback) : 0,
    notes: Array.isArray(p.notes) ? p.notes.filter((x): x is string => typeof x === 'string') : [],
  };
}

export function withoutPending(c: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...c };
  delete rest.autofill_pending;
  delete rest.autofill_carry;
  return rest;
}

/** Les prises de phase sont rendues dès que la phase a écrit son résultat. */
export function withoutClaim(c: Record<string, unknown>): Record<string, unknown> {
  const { autofill_claim: _claim, ...rest } = c;
  void _claim;
  return rest;
}

/**
 * L'itinéraire déjà écrit qu'une préparation reprend : la phase « reste », et
 * aussi une passe unique relancée après une coupure (sans quoi elle repartait
 * sur les étapes orphelines comme si elles étaient à la personne).
 */
export function resumableRun(phase: AutofillPhase, pending: PendingRun | null): PendingRun | null {
  return phase === 'rest' || phase === 'all' ? pending : null;
}

/**
 * Passe unique : dès l'itinéraire écrit, il est inscrit comme en attente, et
 * le reste est pris (une relance pendant ce temps attend ; après une coupure,
 * la prise expire et la relance reprend ici).
 */
export function withStepsWritten(
  meta: Record<string, unknown>,
  run: Omit<PendingRun, 'restAt'>,
  now: number
): Record<string, unknown> {
  const c = compasPart(meta);
  const claims = (c.autofill_claim ?? {}) as Record<string, number>;
  return {
    ...meta,
    compas: { ...c, autofill_pending: { ...run, restAt: now }, autofill_claim: { ...claims, rest: now } },
  };
}

/** Une préparation en attente que plus rien ne fait avancer (coupée en route). */
export function pendingIsStale(pending: PendingRun, now: number): boolean {
  return pending.restAt != null && now - pending.restAt >= CLAIM_MS;
}
