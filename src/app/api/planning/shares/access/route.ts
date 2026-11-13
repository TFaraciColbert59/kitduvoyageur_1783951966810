import { executePlanningAction } from '../../_lib/actions';
import { readJson, toNextResponse } from '../../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/shares/access — P01 : décision fail-closed pour un visiteur. */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('shares.access', await readJson(request)));
}
