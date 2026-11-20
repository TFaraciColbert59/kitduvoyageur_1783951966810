import { NextRequest } from 'next/server';

import { DAILY_BUDGET_MS, DAILY_MIN_START_MS, DAILY_TASK_TIMEOUT_MS, type DailyTask } from './dailyDispatcher';

/**
 * Tâches du cron quotidien `/api/cron/daily` (plan 100, 1.1 & Lot P3).
 *
 * Hobby = un seul tir par jour (voir `dailyDispatcher.ts`). Le répartiteur
 * appelle, dans le même processus, le gestionnaire de chaque route existante :
 * même autorisation, même logique, pas de copie. Chaque route reste appelable
 * à la main (`Authorization: Bearer ${CRON_SECRET}`).
 *
 * Ordre : d'abord ce qui protège la vie privée (positions en direct, retrait
 * de consentement, signalements : tâches `pinned`, toujours en tête), puis les files
 * à vider, puis les rafraîchissements de vues. Le reste tourne dans un ordre décalé
 * chaque jour (`rotation`) : si le budget de temps s'épuise, ce n'est pas toujours la
 * même queue de liste qui est sautée.
 * Toutes ces tâches sont idempotentes : un tir manqué ou doublé (Vercel peut
 * « occasionally invoke the same scheduled run more than once ») ne casse rien.
 */

type RouteModule = Record<string, unknown>;

export interface DailyCronTask {
  /** Nom du dossier sous `src/app/api/cron/`. */
  name: string;
  /** Méthode exportée par la route et appelée ici. */
  method: 'GET' | 'POST';
  load: () => Promise<RouteModule>;
  /** Vie privée : toujours en tête, jamais décalée par la rotation quotidienne. */
  pinned?: boolean;
}

export const DAILY_CRON_TASKS: readonly DailyCronTask[] = [
  // Vie privée d'abord.
  { name: 'expire-live-positions', pinned: true, method: 'GET', load: () => import('@/app/api/cron/expire-live-positions/route') },
  { name: 'process-adventure-events', pinned: true, method: 'POST', load: () => import('@/app/api/cron/process-adventure-events/route') },
  { name: 'expire-terrain-reports', pinned: true, method: 'POST', load: () => import('@/app/api/cron/expire-terrain-reports/route') },
  { name: 'cleanup-ephemeral-groups', pinned: true, method: 'GET', load: () => import('@/app/api/cron/cleanup-ephemeral-groups/route') },
  { name: 'cleanup-solo-crews', pinned: true, method: 'GET', load: () => import('@/app/api/cron/cleanup-solo-crews/route') },
  // Files à vider : les sorties traitées alimentent l'agrégat et l'outbox.
  { name: 'process-hike-sessions', method: 'POST', load: () => import('@/app/api/cron/process-hike-sessions/route') },
  { name: 'aggregate-segments', method: 'POST', load: () => import('@/app/api/cron/aggregate-segments/route') },
  { name: 'progression-outbox', method: 'POST', load: () => import('@/app/api/cron/progression-outbox/route') },
  { name: 'progression-awards', method: 'POST', load: () => import('@/app/api/cron/progression-awards/route') },
  { name: 'leaderboard-refresh', method: 'POST', load: () => import('@/app/api/cron/leaderboard-refresh/route') },
  // Hygiène de données : purge des stories expirées non archivées (V2 phase 06 ;
  // idempotente, lots de 200, archives et Highlights préservés).
  { name: 'purge-stories', method: 'GET', load: () => import('@/app/api/cron/purge-stories/route') },
  // Vues matérialisées.
  { name: 'refresh-kit-scores', method: 'GET', load: () => import('@/app/api/cron/refresh-kit-scores/route') },
  { name: 'refresh-atlas-density', method: 'GET', load: () => import('@/app/api/cron/refresh-atlas-density/route') },
  // Comparaison silencieuse : ne lit rien tant qu'aucun drapeau shadow n'est allumé.
  { name: 'run-adventure-shadows', method: 'POST', load: () => import('@/app/api/cron/run-adventure-shadows/route') },
];

/**
 * Routes `/api/cron/*` volontairement HORS du tir quotidien, avec la raison.
 * Un test casse si une route de `src/app/api/cron/` n'est ni dans
 * `DAILY_CRON_TASKS` ni ici : on ne laisse plus une route oubliée.
 */
export const MANUAL_ONLY_CRON_ROUTES: Readonly<Record<string, string>> = {
  'finalize-kit-attributions':
    'verse des crédits boutique (finalize_kit_attributions) : la reprise au remboursement (reverse_kit_attribution_by_session) ne reprend que le solde restant (GREATEST(0, …)) alors que le registre écrit le débit entier, et le webhook Stripe avale l’erreur du reversement (supabase.rpc renvoie l’erreur, il ne la lève pas) : un tir automatique peut payer ce qu’on ne sait pas reprendre. À lancer à la main, sur décision de Tony, après correction de ces deux points',
  'process-ai-jobs':
    'appelle un fournisseur d’IA (l’essai NVIDIA n’est pas autorisé en production tant qu’aucune offre conforme n’existe à 0 €, docs/compas/SERVICES-GRATUITS.md) et traite jusqu’à 10 jobs à la suite, ce qui peut dépasser le budget d’un tir : à lancer à la main, sur décision de Tony',
  'refresh-country-guides':
    'génère des guides pays par IA (même réserve sur l’essai NVIDIA), en lots longs paramétrés par l’URL (scope, limit, countries) : à lancer à la main, sur décision de Tony',
};

/** Route du répartiteur lui-même (ne s'enchaîne pas elle-même). */
export const DAILY_CRON_ROUTE = 'daily';

// ─────────────────────────────────────────────────────────────────────────────
// LOT P3 — LOTISSEMENT IDEMPOTENT DU SHADOW MODE EFFORT (BUDGET 270 s / ~155 s)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Budget disponible nominal restant (~155 s sur les 270 s de `DAILY_BUDGET_MS`,
 * audité en P0 lorsque l'ensemble des tâches nominales s'exécute).
 */
export const DAILY_AVAILABLE_EFFORT_SHADOW_BUDGET_MS = 155_000;

/** Taille d'un sous-lot idempotent (141 `hike_sessions` => 6 lots de 25 max). */
export const EFFORT_SHADOW_BATCH_SIZE = 25;

/** Plafond de sessions évaluées par exécution quotidienne. */
export const EFFORT_SHADOW_MAX_SESSIONS_PER_TICK = 150;

export interface EffortShadowBatchPlan<T> {
  batches: T[][];
  batchSize: number;
  totalCandidateCount: number;
  plannedSessionCount: number;
  deferredCount: number;
  effectiveBudgetMs: number;
  minRemainingMs: number;
}

export interface EffortShadowBatchOptions {
  batchSize?: number;
  maxSessions?: number;
  totalBudgetMs?: number;
  availableBudgetMs?: number;
  taskTimeoutMs?: number;
  minRemainingMs?: number;
}

/**
 * Découpe une collection de `hike_sessions` (ex. les 141 sessions de production)
 * en lots idempotents bornés par le budget disponible (~155 s sur 270 s) et
 * le délai maximal d'une tâche du répartiteur (`DAILY_TASK_TIMEOUT_MS = 90 s`).
 */
export function planEffortShadowDailyBatches<T>(
  sessions: readonly T[],
  options: EffortShadowBatchOptions = {}
): EffortShadowBatchPlan<T> {
  const batchSize = Math.max(1, Math.trunc(options.batchSize ?? EFFORT_SHADOW_BATCH_SIZE));
  const maxSessions = Math.max(
    1,
    Math.trunc(options.maxSessions ?? EFFORT_SHADOW_MAX_SESSIONS_PER_TICK)
  );
  const totalBudgetMs = Math.max(1_000, options.totalBudgetMs ?? DAILY_BUDGET_MS);
  const availableBudgetMs = Math.max(
    1_000,
    Math.min(totalBudgetMs, options.availableBudgetMs ?? DAILY_AVAILABLE_EFFORT_SHADOW_BUDGET_MS)
  );
  const taskTimeoutMs = Math.max(1_000, options.taskTimeoutMs ?? DAILY_TASK_TIMEOUT_MS);
  const minRemainingMs = Math.max(500, options.minRemainingMs ?? DAILY_MIN_START_MS);
  const effectiveBudgetMs = Math.min(totalBudgetMs, availableBudgetMs, taskTimeoutMs);

  const selected = sessions.slice(0, maxSessions);
  const batches: T[][] = [];
  for (let i = 0; i < selected.length; i += batchSize) {
    batches.push(selected.slice(i, i + batchSize));
  }

  return {
    batches,
    batchSize,
    totalCandidateCount: sessions.length,
    plannedSessionCount: selected.length,
    deferredCount: Math.max(0, sessions.length - selected.length),
    effectiveBudgetMs,
    minRemainingMs,
  };
}

export interface EffortShadowBatchRunSummary {
  totalCandidates: number;
  batchesPlanned: number;
  batchesCompleted: number;
  persisted: number;
  skippedDuplicate: number;
  skippedNoConsent: number;
  skippedFlagDisabled: number;
  failed: number;
  deferredByBudget: number;
  elapsedMs: number;
  effectiveBudgetMs: number;
  withinAvailableBudget: boolean;
}

/**
 * Exécute par lots idempotents l'évaluation shadow `effort-score-v1` des
 * `hike_sessions` dans le budget restant (~155 s sur 270 s).
 * Si le temps restant descend sous `minRemainingMs`, les lots restants sont
 * différés proprement au tir suivant sans provoquer de timeout.
 */
export async function runIdempotentEffortShadowBatches<TSession extends { id: string }>(params: {
  sessions: readonly TSession[];
  evaluateSession: (session: TSession) => Promise<{
    status:
      | 'persisted'
      | 'skipped_flag_disabled'
      | 'skipped_no_consent'
      | 'skipped_duplicate_snapshot'
      | 'failed';
    snapshotHash?: string;
  }>;
  options?: EffortShadowBatchOptions;
  nowMs?: () => number;
  seenSnapshotHashes?: Set<string>;
}): Promise<EffortShadowBatchRunSummary> {
  const clock = params.nowMs ?? (() => Date.now());
  const startedAt = clock();
  const plan = planEffortShadowDailyBatches(params.sessions, params.options);
  const seenHashes = params.seenSnapshotHashes ?? new Set<string>();

  let batchesCompleted = 0;
  let persisted = 0;
  let skippedDuplicate = 0;
  let skippedNoConsent = 0;
  let skippedFlagDisabled = 0;
  let failed = 0;
  let evaluatedCount = 0;
  let stoppedForBudget = false;

  for (const batch of plan.batches) {
    const elapsedBeforeBatch = clock() - startedAt;
    const remainingBeforeBatch = plan.effectiveBudgetMs - elapsedBeforeBatch;
    if (remainingBeforeBatch < plan.minRemainingMs) {
      stoppedForBudget = true;
      break;
    }

    for (const session of batch) {
      const elapsedBeforeSession = clock() - startedAt;
      if (plan.effectiveBudgetMs - elapsedBeforeSession < plan.minRemainingMs) {
        stoppedForBudget = true;
        break;
      }

      evaluatedCount += 1;
      try {
        const outcome = await params.evaluateSession(session);
        if (outcome.status === 'persisted') {
          if (outcome.snapshotHash && seenHashes.has(outcome.snapshotHash)) {
            skippedDuplicate += 1;
          } else {
            if (outcome.snapshotHash) seenHashes.add(outcome.snapshotHash);
            persisted += 1;
          }
        } else if (outcome.status === 'skipped_duplicate_snapshot') {
          skippedDuplicate += 1;
        } else if (outcome.status === 'skipped_no_consent') {
          skippedNoConsent += 1;
        } else if (outcome.status === 'skipped_flag_disabled') {
          skippedFlagDisabled += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    if (stoppedForBudget) break;
    batchesCompleted += 1;
  }

  const elapsedMs = Math.max(0, clock() - startedAt);
  const deferredByBudget = Math.max(0, params.sessions.length - evaluatedCount);

  return {
    totalCandidates: params.sessions.length,
    batchesPlanned: plan.batches.length,
    batchesCompleted,
    persisted,
    skippedDuplicate,
    skippedNoConsent,
    skippedFlagDisabled,
    failed,
    deferredByBudget,
    elapsedMs,
    effectiveBudgetMs: plan.effectiveBudgetMs,
    withinAvailableBudget:
      elapsedMs <= (params.options?.availableBudgetMs ?? DAILY_AVAILABLE_EFFORT_SHADOW_BUDGET_MS),
  };
}

/**
 * Les tâches du jour, prêtes à tourner : chacune appelle le gestionnaire de sa
 * route avec l'en-tête `Authorization: Bearer` du secret déjà vérifié.
 * Le secret reste en mémoire : il n'est ni journalisé ni renvoyé.
 */
export function buildDailyTasks(
  request: NextRequest,
  secret: string,
  registry: readonly DailyCronTask[] = DAILY_CRON_TASKS
): DailyTask[] {
  return registry.map((entry) => ({
    name: entry.name,
    pinned: entry.pinned === true,
    run: async () => {
      const routeModule = await entry.load();
      const handler = routeModule[entry.method];
      if (typeof handler !== 'function') throw new TypeError(`route sans ${entry.method}`);
      const internal = new NextRequest(new URL(`/api/cron/${entry.name}`, request.url), {
        method: entry.method,
        headers: { authorization: `Bearer ${secret}` },
      });
      return (await handler(internal)) as Response;
    },
  }));
}
