import { executePlanningAction } from '../_lib/actions';
import { readJson, toNextResponse } from '../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/search — K1.13 : bibliothèque filtrée P01. */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('search', await readJson(request)));
}
