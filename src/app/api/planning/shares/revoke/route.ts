import { executePlanningAction } from '../../_lib/actions';
import { readJson, toNextResponse } from '../../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/shares/revoke — P01 : révocation immédiate par le propriétaire. */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('shares.revoke', await readJson(request)));
}
