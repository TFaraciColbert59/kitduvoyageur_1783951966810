import { executePlanningAction } from '../../_lib/actions';
import { readJson, toNextResponse } from '../../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/stages/launch — K2.32 : « Démarrer cette étape ». */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('stages.launch', await readJson(request)));
}
