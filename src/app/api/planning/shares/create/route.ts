import { executePlanningAction } from '../../_lib/actions';
import { readJson, toNextResponse } from '../../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/shares/create — P01 : consentement et propriétaire vérifiés. */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('shares.create', await readJson(request)));
}
