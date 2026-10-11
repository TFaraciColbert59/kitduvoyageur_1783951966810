import { NextRequest } from 'next/server';

import type { DailyTask } from './dailyDispatcher';

/**
 * Tâches du cron quotidien `/api/cron/daily` (plan 100, 1.1).
 *
 * Hobby = un seul tir par jour (voir `dailyDispatcher.ts`). Le répartiteur
 * appelle, dans le même processus, le gestionnaire de chaque route existante :
 * même autorisation, même logique, pas de copie. Chaque route reste appelable
 * à la main (`Authorization: Bearer ${CRON_SECRET}`).
 *
 * Ordre : d'abord ce qui protège la vie privée (positions en direct, retrait
 * de consentement, signalements), puis les files à vider, puis les rafraîchissements
 * de vues, le plus lourd à la fin (le budget de temps le saute au besoin).
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
}

export const DAILY_CRON_TASKS: readonly DailyCronTask[] = [
  // Vie privée d'abord.
  { name: 'expire-live-positions', method: 'GET', load: () => import('@/app/api/cron/expire-live-positions/route') },
  { name: 'process-adventure-events', method: 'POST', load: () => import('@/app/api/cron/process-adventure-events/route') },
  { name: 'expire-terrain-reports', method: 'POST', load: () => import('@/app/api/cron/expire-terrain-reports/route') },
  { name: 'cleanup-ephemeral-groups', method: 'GET', load: () => import('@/app/api/cron/cleanup-ephemeral-groups/route') },
  { name: 'cleanup-solo-crews', method: 'GET', load: () => import('@/app/api/cron/cleanup-solo-crews/route') },
  // Files à vider : les sorties traitées alimentent l'agrégat, l'outbox et les attributions.
  { name: 'process-hike-sessions', method: 'POST', load: () => import('@/app/api/cron/process-hike-sessions/route') },
  { name: 'aggregate-segments', method: 'POST', load: () => import('@/app/api/cron/aggregate-segments/route') },
  { name: 'progression-outbox', method: 'POST', load: () => import('@/app/api/cron/progression-outbox/route') },
  { name: 'progression-awards', method: 'POST', load: () => import('@/app/api/cron/progression-awards/route') },
  { name: 'leaderboard-refresh', method: 'POST', load: () => import('@/app/api/cron/leaderboard-refresh/route') },
  { name: 'finalize-kit-attributions', method: 'GET', load: () => import('@/app/api/cron/finalize-kit-attributions/route') },
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
  'process-ai-jobs':
    'appelle un fournisseur d’IA et peut dépasser la durée de la fonction ; l’IA est éteinte en production (SERVICES-GRATUITS.md) : à lancer à la main quand elle sera allumée',
  'refresh-country-guides':
    'génère des guides pays par IA (longs, payants hors offre gratuite), paramétrés par l’URL (scope, limit, countries) : à lancer à la main',
};

/** Route du répartiteur lui-même (ne s'enchaîne pas elle-même). */
export const DAILY_CRON_ROUTE = 'daily';

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
