import { executePlanningAction } from '../../_lib/actions';
import { readJson, toNextResponse } from '../../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/lodging/anchor — K2.31 : refuge comme fin d'étape. */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('lodging.anchor', await readJson(request)));
}
