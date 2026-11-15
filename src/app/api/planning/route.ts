import { NextResponse } from 'next/server';
import { executePlanningAction, PLANNING_ACTIONS } from './_lib/actions';
import { readJson, toNextResponse } from './_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/planning — capacités du module.
 * Le contrat est volontairement sans état : les routes calculent, l'appelant
 * persiste et applique ses propres contrôles d'accès.
 */
export async function GET() {
  return NextResponse.json({
    module: 'planning',
    lot: 'R04',
    contract: 'src/features/planning/index.ts',
    persistence: 'stateless',
    timezone: 'IANA explicite obligatoire',
    privacy: 'P01 fail-closed',
    actions: PLANNING_ACTIONS,
  });
}

/**
 * POST /api/planning — répartiteur `{ action, payload }`.
 * Les routes dédiées restent la voie recommandée ; ce point d'entrée sert aux
 * clients qui préfèrent une seule URL.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (
    body === null ||
    typeof body !== 'object' ||
    !('action' in body) ||
    typeof (body as { action?: unknown }).action !== 'string'
  ) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Corps attendu : { action, payload }.' },
      { status: 400 },
    );
  }

  const { action, payload } = body as { action: string; payload?: unknown };
  return toNextResponse(executePlanningAction(action, payload ?? {}));
}
