/**
 * Répartiteur du cron quotidien (plan 100, 1.1).
 *
 * Offre Hobby de Vercel (page « Usage & Pricing for Cron Jobs », lue le
 * 12 oct. 2026, https://vercel.com/docs/cron-jobs/usage-and-pricing) : 100 crons
 * par projet, MAIS « Hobby accounts are limited to cron jobs that run once per
 * day » (une expression plus fréquente fait échouer le déploiement) et une
 * précision « Per-hour (±59 min) ». Un tir par jour, donc UN seul cron qui
 * enchaîne les tâches utiles. Durée d'une fonction Hobby : 300 s au plus
 * (https://vercel.com/docs/functions/limitations#max-duration, lue le même jour).
 *
 * Contrat :
 * - les tâches tournent l'une après l'autre, dans l'ordre donné ;
 * - une tâche qui échoue (réponse non 2xx, exception) est journalisée et
 *   n'arrête pas les suivantes ;
 * - une tâche qui dépasse son délai ne peut pas être interrompue (un gestionnaire
 *   ne reçoit aucun signal d'arrêt) : elle continue en arrière-plan. Pour que deux
 *   tâches ne tournent jamais en même temps, on N'EN LANCE AUCUNE autre ensuite ;
 *   les suivantes sont sautées (`after_timeout`) et repartent au prochain tir ;
 * - le budget total est borné : une tâche qui ne peut plus tenir est sautée
 *   (elle repart au prochain tir, les tâches sont idempotentes) ;
 * - pour qu'une queue de liste ne soit pas sautée tous les jours quand le budget
 *   s'épuise, les tâches non épinglées partent d'un rang différent chaque jour
 *   (`rotation`). Les tâches épinglées (vie privée) restent toujours en tête et
 *   dans l'ordre ; le reste est idempotent, un enchaînement pris dans un autre
 *   ordre se rattrape au tir suivant ;
 * - le résumé ne porte que des noms de tâches, des codes et des compteurs :
 *   jamais un message d'erreur, un identifiant ni une donnée personnelle.
 */

/** Marge laissée sous les 300 s de la fonction pour répondre et journaliser. */
export const DAILY_BUDGET_MS = 270_000;
/** Délai maximal d'une tâche : une tâche lente ne mange pas tout le budget. */
export const DAILY_TASK_TIMEOUT_MS = 90_000;
/** Temps restant minimal pour lancer une tâche. */
export const DAILY_MIN_START_MS = 10_000;

export type DailyTaskStatus = 'ok' | 'failed' | 'timeout' | 'skipped';

export interface DailyTask {
  /** Nom court de la route (`refresh-kit-scores`), jamais une donnée. */
  name: string;
  /** Exécute la tâche et rend la réponse HTTP de sa route. */
  run: () => Promise<Response>;
  /** Tâche toujours lancée en tête, dans l'ordre donné (vie privée) : jamais décalée par la rotation. */
  pinned?: boolean;
}

export interface DailyTaskReport {
  name: string;
  status: DailyTaskStatus;
  durationMs: number;
  httpStatus?: number;
  /** Code court : `http_503`, `exception`, `timeout`, `budget`, `after_timeout`. */
  reason?: string;
  /** Compteurs numériques ou booléens du premier niveau de la réponse. */
  counters?: Record<string, number | boolean>;
}

export interface DailySummary {
  /** Faux si au moins une tâche a échoué ou dépassé son délai (une tâche sautée n'est pas une panne). */
  ok: boolean;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  durationMs: number;
  budgetMs: number;
  tasks: DailyTaskReport[];
}

export interface DailyLogEvent {
  task: string;
  status: DailyTaskStatus;
  reason: string;
}

export interface DailyOptions {
  budgetMs?: number;
  taskTimeoutMs?: number;
  minStartMs?: number;
  /**
   * Décalage de départ des tâches non épinglées (par exemple le numéro du jour).
   * Entier ; 0 = ordre donné.
   */
  rotation?: number;
  /** Journal d'un échec (par défaut `console.error`). */
  log?: (event: DailyLogEvent) => void;
}

/** Jeton interne : la course contre le délai a été perdue. */
const TIMED_OUT = Symbol('timeout');

const COUNTER_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/**
 * Compteurs d'une réponse : seuls les nombres finis et les booléens du premier
 * niveau, sous une clé simple. Une chaîne, un tableau ou un objet (identifiant,
 * e-mail, message libre) ne sort jamais.
 */
export function summarizeBody(body: unknown): Record<string, number | boolean> | undefined {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const counters: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!COUNTER_KEY.test(key)) continue;
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      counters[key] = value;
    }
  }
  return Object.keys(counters).length > 0 ? counters : undefined;
}

function defaultLog(event: DailyLogEvent): void {
  console.error('[cron/daily] tâche en échec', event);
}

async function execute(task: DailyTask): Promise<{ httpStatus: number; counters?: Record<string, number | boolean> }> {
  const response = await task.run();
  const body: unknown = await response.json().catch(() => undefined);
  return { httpStatus: response.status, counters: summarizeBody(body) };
}

/** Épinglées d'abord (ordre donné), puis les autres décalées de `rotation` rangs. */
export function orderTasks(tasks: readonly DailyTask[], rotation = 0): DailyTask[] {
  const pinned = tasks.filter((t) => t.pinned);
  const rest = tasks.filter((t) => !t.pinned);
  if (rest.length === 0) return pinned;
  const offset = ((Math.trunc(rotation) % rest.length) + rest.length) % rest.length;
  return [...pinned, ...rest.slice(offset), ...rest.slice(0, offset)];
}

export async function runDailyTasks(tasks: readonly DailyTask[], options: DailyOptions = {}): Promise<DailySummary> {
  const budgetMs = options.budgetMs ?? DAILY_BUDGET_MS;
  const taskTimeoutMs = options.taskTimeoutMs ?? DAILY_TASK_TIMEOUT_MS;
  const minStartMs = options.minStartMs ?? DAILY_MIN_START_MS;
  const log = options.log ?? defaultLog;

  const startedAt = Date.now();
  const reports: DailyTaskReport[] = [];

  /** Une tâche a dépassé son délai et tourne peut-être encore : on n'en lance plus. */
  let abandoned = false;

  for (const task of orderTasks(tasks, options.rotation ?? 0)) {
    if (abandoned) {
      reports.push({ name: task.name, status: 'skipped', durationMs: 0, reason: 'after_timeout' });
      continue;
    }
    const remaining = budgetMs - (Date.now() - startedAt);
    if (remaining < minStartMs) {
      reports.push({ name: task.name, status: 'skipped', durationMs: 0, reason: 'budget' });
      continue;
    }

    const timeoutMs = Math.min(taskTimeoutMs, remaining);
    const taskStartedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
    });

    let report: DailyTaskReport;
    try {
      const outcome = await Promise.race([Promise.resolve().then(() => execute(task)), deadline]);
      const durationMs = Date.now() - taskStartedAt;
      if (outcome === TIMED_OUT) {
        report = { name: task.name, status: 'timeout', durationMs, reason: 'timeout' };
        abandoned = true;
      } else if (outcome.httpStatus >= 200 && outcome.httpStatus < 300) {
        report = { name: task.name, status: 'ok', durationMs, httpStatus: outcome.httpStatus };
      } else {
        report = {
          name: task.name,
          status: 'failed',
          durationMs,
          httpStatus: outcome.httpStatus,
          reason: `http_${outcome.httpStatus}`,
        };
      }
      if (outcome !== TIMED_OUT && outcome.counters) report.counters = outcome.counters;
    } catch {
      // Ni message ni pile : l'erreur d'une base peut citer un identifiant.
      report = { name: task.name, status: 'failed', durationMs: Date.now() - taskStartedAt, reason: 'exception' };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }

    if (report.status === 'failed' || report.status === 'timeout') {
      log({ task: report.name, status: report.status, reason: report.reason ?? report.status });
    }
    reports.push(report);
  }

  const failed = reports.filter((r) => r.status === 'failed' || r.status === 'timeout').length;
  const skipped = reports.filter((r) => r.status === 'skipped').length;
  return {
    ok: failed === 0,
    total: reports.length,
    succeeded: reports.filter((r) => r.status === 'ok').length,
    failed,
    skipped,
    durationMs: Date.now() - startedAt,
    budgetMs,
    tasks: reports,
  };
}
