import { executePlanningAction } from '../../_lib/actions';
import { readJson, toNextResponse } from '../../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/boundary/commit — K2.30 : révisions N et N+1 atomiques. */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('boundary.commit', await readJson(request)));
}
