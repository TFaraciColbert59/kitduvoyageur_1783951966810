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
  /** Ce que l'itinéraire écrit vaut (voir `ItineraryReport`) : repris tel quel par la phase « reste ». */
  itinerary?: ItineraryReport;
}

/**
 * Ce que vaut l'itinéraire écrit, rangé dans les métadonnées de préparation (jamais déduit d'une note) :
 *  - `complete` : la carte a répondu et l'itinéraire est assez fourni (ou voulu sur un seul lieu) ;
 *  - `poor_zone` : la carte a répondu, la zone n'a simplement que très peu de lieux habités ;
 *  - `source_silent` : la carte n'a pas répondu (Overpass, Photon, Geoapify muets) : l'itinéraire est
 *    incomplet et sera rejoué à une ouverture suivante (`retryParts`), sans écraser ce que la personne a saisi.
 */
export type ItineraryState = 'complete' | 'poor_zone' | 'source_silent';

export interface ItineraryReport {
  state: ItineraryState;
  /** Lieux distincts de l'itinéraire écrit. */
  places: number;
  /** Ce que chaque source a répondu (diagnostic court, jamais affiché). */
  sources?: string[];
}

export const ITINERARY_STATES: readonly ItineraryState[] = ['complete', 'poor_zone', 'source_silent'];

/** Relit un état gardé dans les métadonnées (jamais fait confiance à ce qui y est écrit). */
export function readItinerary(raw: unknown): ItineraryReport | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (!ITINERARY_STATES.includes(r.state as ItineraryState)) return undefined;
  return {
    state: r.state as ItineraryState,
    places: Number.isInteger(r.places) && Number(r.places) >= 0 ? Number(r.places) : 0,
    ...(Array.isArray(r.sources) ? { sources: r.sources.filter((x): x is string => typeof x === 'string').slice(0, 6).map((x) => x.slice(0, 60)) } : {}),
  };
}

/**
 * Un itinéraire est « mince » quand il tient sur moins de lieux que ses jours n'en demandent (trois au plus) :
 * séjour sur place (forme « base ») excepté, un seul lieu y est voulu. Un jour seul n'est jamais mince.
 */
export function thinItinerary(distinct: number, days: number, shape: string | null): boolean {
  return shape !== 'base' && days >= 2 && distinct < Math.min(days, 3);
}

/** Délai avant de rejouer un itinéraire resté sans carte : jamais dans la minute qui suit l'échec. */
export const SOURCE_RETRY_AFTER_MS = 120_000;

/**
 * Faut-il rejouer l'itinéraire ? Seulement s'il est resté « incomplet faute de source » et que
 * l'échec date de plus de `SOURCE_RETRY_AFTER_MS` : l'ouverture qui suit tout de suite la préparation
 * ne rejoue rien (la carte vient de se taire), la suivante le fait une fois.
 */
export function sourceRetryDue(itinerary: ItineraryReport | undefined, runAt: unknown, now: number): boolean {
  if (itinerary?.state !== 'source_silent') return true;
  const at = typeof runAt === 'string' ? Date.parse(runAt) : NaN;
  return Number.isFinite(at) && now - at >= SOURCE_RETRY_AFTER_MS;
}

export type AutofillPhase = 'steps' | 'rest' | 'all';

/** Durée d'une prise : la durée maximale d'une préparation en une passe. */
export const CLAIM_MS = 290_000;

/**
 * Avance tolérée d'une heure de prise sur l'horloge d'une autre exécution (deux fonctions serveur
 * ne sont pas au même instant à la seconde près). Une heure plus avancée que cela n'a pas pu être
 * écrite par une préparation : `trips.metadata` est écrit par tout éditeur du voyage, et une
 * prise datée du futur tenait sinon la préparation, « Annuler » et la réadaptation à jamais.
 */
export const CLOCK_SKEW_MS = 60_000;

/** Une prise de phase vivante : écrite il y a moins de `CLAIM_MS`, et pas datée du futur. */
export function claimIsLive(at: unknown, now: number): boolean {
  if (typeof at !== 'number' || !Number.isFinite(at)) return false;
  const age = now - at;
  return age >= -CLOCK_SKEW_MS && age < CLAIM_MS;
}

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
    ...(readItinerary(p.itinerary) ? { itinerary: readItinerary(p.itinerary) } : {}),
    notes: Array.isArray(p.notes) ? p.notes.filter((x): x is string => typeof x === 'string') : [],
  };
}

export function withoutPending(c: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...c };
  delete rest.autofill_pending;
  delete rest.autofill_carry;
  return rest;
}

/**
 * Dates ou enveloppe posées par la PERSONNE : elles lui appartiennent désormais. Le drapeau
 * `datesSet` / `budgetSet` (« posé par le préremplissage ») est effacé dans la même écriture des
 * métadonnées, sans quoi « Annuler la préparation » ou la réadaptation (changement de groupe)
 * remettait à vide ce qu'elle venait de saisir. Efface aussi la copie de la préparation en attente
 * (`datesSet`) ; rend `c` lui-même quand il n'y a rien à retirer.
 */
export function withoutAutofillFlag(
  c: Record<string, unknown>,
  flag: 'datesSet' | 'budgetSet'
): Record<string, unknown> {
  let next = c;
  for (const slot of ['autofill', 'autofill_pending'] as const) {
    const run = c[slot];
    if (!run || typeof run !== 'object' || Array.isArray(run) || !(flag in run)) continue;
    const { [flag]: _gone, ...rest } = run as Record<string, unknown>;
    void _gone;
    if (next === c) next = { ...c };
    next[slot] = rest;
  }
  return next;
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
  return pending.restAt != null && (now - pending.restAt >= CLAIM_MS || pending.restAt - now > CLOCK_SKEW_MS);
}

/** Une prise de phase encore valable : une exécution de la préparation tient ce voyage. */
function hasFreshClaim(meta: Record<string, unknown>, now: number): boolean {
  const claims = compasPart(meta).autofill_claim;
  if (!claims || typeof claims !== 'object') return false;
  return Object.values(claims).some((at) => claimIsLive(at, now));
}

/**
 * Une préparation dont l'itinéraire attend le reste ET que quelqu'un prépare encore : reprise
 * en main depuis moins de `CLAIM_MS`, ou prise de phase fraîche. Passé ce délai l'exécution est
 * morte (la fonction s'arrête à 300 s) : l'attente est « coupée », et s'annule. Un itinéraire en
 * attente sans reprise en main ni prise fraîche (orphelin d'une phase « steps » seule) n'est pas
 * vivant non plus.
 */
export function pendingIsLive(meta: Record<string, unknown>, now: number): boolean {
  const pending = readPending(meta);
  if (!pending) return false;
  const takenOver = pending.restAt != null && !pendingIsStale(pending, now);
  return takenOver || hasFreshClaim(meta, now);
}
