import { executePlanningAction } from '../../_lib/actions';
import { readJson, toNextResponse } from '../../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/weather/evaluate — météo explicite, jamais inventée. */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('weather.evaluate', await readJson(request)));
}
