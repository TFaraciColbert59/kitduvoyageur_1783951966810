import { executePlanningAction } from '../_lib/actions';
import { readJson, toNextResponse } from '../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/split — K2.29 : découpage d'un tracé continu. */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('split', await readJson(request)));
}
