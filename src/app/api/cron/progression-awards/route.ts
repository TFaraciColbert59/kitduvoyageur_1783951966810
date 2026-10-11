import { NextRequest, NextResponse } from 'next/server';
import { consumeProgressionAwardIntents } from '@/features/progression/server/intentConsumer';

export const dynamic = 'force-dynamic';

/**
 * T07 — Worker des intentions durables d'attribution.
 *
 * Ce traitement relit des preuves applicatives : il n'est pas exécutable en
 * SQL pur. Deux canaux l'invoquent :
 *   - un planificateur HTTP avec `Authorization: Bearer ${CRON_SECRET}`
 *     (POST ou GET), ou `pg_net` si l'extension est activée et configurée ;
 *   - le drain opportuniste borné de `/api/progression` (trafic réel).
 * Le parcours utilisateur n'en dépend jamais : l'accélérateur best-effort
 * reste en place, l'intention garantit la reprise.
 */
const CONSUME_LIMIT = 50;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await consumeProgressionAwardIntents({ limit: CONSUME_LIMIT });
  return NextResponse.json(summary);
}

export const POST = handle;
export const GET = handle;
