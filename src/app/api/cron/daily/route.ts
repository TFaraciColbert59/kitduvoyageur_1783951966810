import { NextRequest, NextResponse } from 'next/server';

import { isCronAuthorized } from '@/lib/cron/auth';
import { runDailyTasks } from '@/lib/cron/dailyDispatcher';
import { buildDailyTasks } from '@/lib/cron/dailyTasks';

export const dynamic = 'force-dynamic';

/**
 * 300 s : le maximum d'une fonction Vercel Hobby
 * (https://vercel.com/docs/functions/limitations#max-duration, lue le 12 oct. 2026).
 * Le répartiteur borne son propre budget à 270 s (`DAILY_BUDGET_MS`).
 */
export const maxDuration = 300;

/**
 * GET /api/cron/daily — l'UNIQUE cron planifié (`vercel.json`, une fois par jour).
 *
 * Offre Hobby : « Hobby accounts are limited to cron jobs that run once per day »
 * et précision de ±59 min (https://vercel.com/docs/cron-jobs/usage-and-pricing,
 * lue le 12 oct. 2026). Cette route enchaîne donc, dans la limite de durée, les
 * tâches utiles et idempotentes des routes `/api/cron/*` (liste et ordre dans
 * `src/lib/cron/dailyTasks.ts`). Les autres routes restent appelables à la main.
 *
 * Autorisation : `Authorization: Bearer ${CRON_SECRET}`, que Vercel envoie tout
 * seul quand `CRON_SECRET` existe dans les variables du projet (action de Tony).
 * Vercel ne relance pas un cron en échec (« Vercel will not retry an invocation
 * if a cron job fails ») : le résumé et le code de réponse en gardent la trace.
 *
 * Réponse : noms de tâches, codes et compteurs seulement, aucune donnée personnelle.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !isCronAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await runDailyTasks(buildDailyTasks(request, secret));
  // 500 si une tâche a échoué : le journal des crons de Vercel le montre en rouge.
  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
}
