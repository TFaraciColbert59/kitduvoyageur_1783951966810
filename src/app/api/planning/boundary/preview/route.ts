import { executePlanningAction } from '../../_lib/actions';
import { readJson, toNextResponse } from '../../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/boundary/preview — K2.30 : prévisualisation N/N+1. */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('boundary.preview', await readJson(request)));
}
